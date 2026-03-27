#!/usr/bin/env bash
###############################################################################
# 10-backend-health.sh – Backend service health & queue monitor
#
# Monitors the backend services that directly affect frontend responsiveness:
#   - Flask backend container health (CPU, memory, response time)
#   - Celery worker status (extraction + training queues)
#   - Redis queue depths
#   - MySQL connection count & memory
#
# This helps correlate frontend slowness with backend bottlenecks.
#
# Resource cost: ~3 docker exec calls per interval.
###############################################################################
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="${SCRIPT_DIR}/logs"
INTERVAL="${1:-20}"
OUTFILE="${LOG_DIR}/backend-health-$(date +%Y%m%d_%H%M%S).csv"

mkdir -p "$LOG_DIR"

BACKEND_CONTAINER="quantimage2-backend-1"
CELERY_EXTRACTION="quantimage2-celery_extraction-1"
CELERY_TRAINING="quantimage2-celery_training-1"
REDIS_CONTAINER="quantimage2-redis-1"
DB_CONTAINER="quantimage2-db-1"

header="timestamp,backend_cpu%,backend_mem_mb,backend_pids,celery_ext_cpu%,celery_ext_mem_mb,celery_train_cpu%,celery_train_mem_mb,redis_mem_mb,redis_connected_clients,redis_keys,db_connections,db_mem_mb,celery_queue_depth"
echo "$header" > "$OUTFILE"

echo "=== Backend Health Monitor ==="
echo "  Monitoring: Backend, Celery workers, Redis, MySQL"
echo "  Interval : ${INTERVAL}s"
echo "  Output   : ${OUTFILE}"
echo "  Press Ctrl+C to stop."
echo ""

get_container_stats() {
    local container="$1"
    docker stats --no-stream --format '{{.CPUPerc}},{{.MemUsage}},{{.PIDs}}' "$container" 2>/dev/null || echo "0%,0B / 0B,0"
}

parse_mem_mb() {
    # Convert memory string like "123.4MiB" or "1.2GiB" to MB
    echo "$1" | awk '{
        gsub(/[[:space:]]/, "")
        if (match($0, /([0-9.]+)GiB/, m)) printf "%.1f", m[1]*1024
        else if (match($0, /([0-9.]+)MiB/, m)) printf "%.1f", m[1]
        else if (match($0, /([0-9.]+)KiB/, m)) printf "%.1f", m[1]/1024
        else printf "0"
    }'
}

while true; do
    ts=$(date '+%Y-%m-%d %H:%M:%S')

    # --- Backend Flask ---
    backend_stats=$(get_container_stats "$BACKEND_CONTAINER")
    backend_cpu=$(echo "$backend_stats" | cut -d, -f1 | tr -d '%')
    backend_mem_raw=$(echo "$backend_stats" | cut -d, -f2 | cut -d/ -f1)
    backend_mem=$(parse_mem_mb "$backend_mem_raw")
    backend_pids=$(echo "$backend_stats" | cut -d, -f3)

    # --- Celery Extraction ---
    celery_ext_stats=$(get_container_stats "$CELERY_EXTRACTION")
    celery_ext_cpu=$(echo "$celery_ext_stats" | cut -d, -f1 | tr -d '%')
    celery_ext_mem_raw=$(echo "$celery_ext_stats" | cut -d, -f2 | cut -d/ -f1)
    celery_ext_mem=$(parse_mem_mb "$celery_ext_mem_raw")

    # --- Celery Training ---
    celery_train_stats=$(get_container_stats "$CELERY_TRAINING")
    celery_train_cpu=$(echo "$celery_train_stats" | cut -d, -f1 | tr -d '%')
    celery_train_mem_raw=$(echo "$celery_train_stats" | cut -d, -f2 | cut -d/ -f1)
    celery_train_mem=$(parse_mem_mb "$celery_train_mem_raw")

    # --- Redis ---
    redis_info=$(docker exec "$REDIS_CONTAINER" redis-cli INFO 2>/dev/null || echo "")
    redis_mem=$(echo "$redis_info" | grep "^used_memory_human:" | cut -d: -f2 | tr -d '\r' | awk '{gsub(/[KBM]/,"",$1); print $1}' || echo "0")
    redis_clients=$(echo "$redis_info" | grep "^connected_clients:" | cut -d: -f2 | tr -d '\r' || echo "0")
    redis_keys=$(docker exec "$REDIS_CONTAINER" redis-cli DBSIZE 2>/dev/null | grep -oP '\d+' || echo "0")

    # Celery queue depth (pending tasks)
    celery_queue=$(docker exec "$REDIS_CONTAINER" redis-cli LLEN celery 2>/dev/null | grep -oP '\d+' || echo "0")

    # --- MySQL ---
    db_connections=$(docker exec "$DB_CONTAINER" sh -c 'mysql -u root -p"$MYSQL_ROOT_PASSWORD" -e "SHOW STATUS LIKE \"Threads_connected\";" 2>/dev/null | tail -1 | awk "{print \$2}"' 2>/dev/null || echo "0")
    db_stats=$(get_container_stats "$DB_CONTAINER")
    db_mem_raw=$(echo "$db_stats" | cut -d, -f2 | cut -d/ -f1)
    db_mem=$(parse_mem_mb "$db_mem_raw")

    echo "${ts},${backend_cpu},${backend_mem},${backend_pids},${celery_ext_cpu},${celery_ext_mem},${celery_train_cpu},${celery_train_mem},${redis_mem},${redis_clients},${redis_keys},${db_connections},${db_mem},${celery_queue}" >> "$OUTFILE"

    # Terminal output
    printf "\n[%s] Backend Health\n" "$ts"
    printf "  %-25s CPU: %6s%%   Mem: %8s MB   PIDs: %s\n" "Flask Backend" "$backend_cpu" "$backend_mem" "$backend_pids"
    printf "  %-25s CPU: %6s%%   Mem: %8s MB\n" "Celery Extraction" "$celery_ext_cpu" "$celery_ext_mem"
    printf "  %-25s CPU: %6s%%   Mem: %8s MB\n" "Celery Training" "$celery_train_cpu" "$celery_train_mem"
    printf "  %-25s Mem: %8s     Clients: %-4s  Keys: %-6s  Queue: %s\n" "Redis" "$redis_mem" "$redis_clients" "$redis_keys" "$celery_queue"
    printf "  %-25s Mem: %8s MB   Connections: %s\n" "MySQL" "$db_mem" "$db_connections"

    # Alerts
    if (( $(awk "BEGIN{print ($backend_cpu > 80) ? 1 : 0}") )); then
        printf "  \033[31m⚠ Backend CPU > 80%%! API responses will be slow.\033[0m\n"
    fi
    if [[ "${celery_queue:-0}" -gt 10 ]]; then
        printf "  \033[33m⚠ Celery queue depth: %s (tasks waiting)\033[0m\n" "$celery_queue"
    fi
    if (( $(awk "BEGIN{print ($celery_train_cpu > 90) ? 1 : 0}") )); then
        printf "  \033[33m⚠ Celery Training at high CPU – model training in progress\033[0m\n"
    fi

    sleep "$INTERVAL"
done
