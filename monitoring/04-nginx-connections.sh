#!/usr/bin/env bash
###############################################################################
# 04-nginx-connections.sh – Nginx connection & request monitor
#
# Monitors the frontend nginx container:
#   - Active connections (from nginx stub_status if available)
#   - Access log analysis (response times, status codes, request counts)
#   - Worker process count and memory
#
# Falls back to Docker-level network stats if stub_status not available.
#
# Resource cost: minimal (docker exec + log parsing).
###############################################################################
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="${SCRIPT_DIR}/logs"
INTERVAL="${1:-15}"
OUTFILE="${LOG_DIR}/nginx-connections-$(date +%Y%m%d_%H%M%S).csv"
CONTAINER="quantimage2-frontend-web-1"

mkdir -p "$LOG_DIR"

echo "=== Nginx Connection Monitor ==="
echo "  Container: ${CONTAINER}"
echo "  Interval : ${INTERVAL}s"
echo "  Output   : ${OUTFILE}"
echo "  Press Ctrl+C to stop."
echo ""

# Check if container exists
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
    echo "WARNING: Container '${CONTAINER}' not found. Looking for alternatives..."
    CONTAINER=$(docker ps --format '{{.Names}}' | grep -i "quantimage2.*frontend\|quantimage2.*web" | head -1)
    if [[ -z "$CONTAINER" ]]; then
        echo "ERROR: No frontend container found. Exiting."
        exit 1
    fi
    echo "  Using container: ${CONTAINER}"
fi

# Try to enable stub_status in nginx (non-destructive)
echo "Attempting to enable nginx stub_status..."
docker exec "$CONTAINER" sh -c '
    if ! grep -q stub_status /etc/nginx/conf.d/default.conf 2>/dev/null; then
        # Add stub_status endpoint (only accessible from inside container)
        cat >> /etc/nginx/conf.d/monitoring.conf << "CONF"
server {
    listen 8080;
    server_name localhost;
    location /nginx_status {
        stub_status on;
        allow 127.0.0.1;
        deny all;
    }
}
CONF
        nginx -s reload 2>/dev/null || true
        echo "stub_status enabled on :8080/nginx_status"
    else
        echo "stub_status already configured"
    fi
' 2>/dev/null || echo "  (Could not enable stub_status - will use fallback metrics)"

STUB_STATUS_AVAILABLE=false
if docker exec "$CONTAINER" wget -qO- http://127.0.0.1:8080/nginx_status 2>/dev/null | grep -q "Active"; then
    STUB_STATUS_AVAILABLE=true
    echo "  stub_status: AVAILABLE"
else
    echo "  stub_status: NOT AVAILABLE (using fallback)"
fi

header="timestamp,active_connections,reading,writing,waiting,total_requests,nginx_workers,nginx_mem_rss_kb,connections_per_sec,requests_since_last"
echo "$header" > "$OUTFILE"

prev_total_requests=0
prev_ts_epoch=0

while true; do
    ts=$(date '+%Y-%m-%d %H:%M:%S')
    ts_epoch=$(date +%s)

    active=0; reading=0; writing=0; waiting=0; total_requests=0

    if [[ "$STUB_STATUS_AVAILABLE" == "true" ]]; then
        # Parse nginx stub_status output
        status=$(docker exec "$CONTAINER" wget -qO- http://127.0.0.1:8080/nginx_status 2>/dev/null || echo "")
        if [[ -n "$status" ]]; then
            active=$(echo "$status" | awk '/^Active/{print $3}')
            reading=$(echo "$status" | awk '/Reading/{print $2}')
            writing=$(echo "$status" | awk '/Reading/{print $4}')
            waiting=$(echo "$status" | awk '/Reading/{print $6}')
            total_requests=$(echo "$status" | awk 'NR==3{print $3}')
        fi
    fi

    # Worker processes info
    nginx_workers=$(docker exec "$CONTAINER" sh -c 'ps aux 2>/dev/null | grep -c "nginx: worker" || echo 0' 2>/dev/null || echo 0)
    nginx_mem=$(docker exec "$CONTAINER" sh -c 'ps aux 2>/dev/null | awk "/nginx/{sum+=\$6} END{print sum}"' 2>/dev/null || echo 0)

    # Calculate rates
    if [[ $prev_ts_epoch -gt 0 ]]; then
        elapsed=$((ts_epoch - prev_ts_epoch))
        if [[ $elapsed -gt 0 && $total_requests -gt 0 ]]; then
            requests_delta=$((total_requests - prev_total_requests))
            conn_per_sec=$(awk "BEGIN{printf \"%.1f\", $requests_delta / $elapsed}")
        else
            conn_per_sec=0
            requests_delta=0
        fi
    else
        conn_per_sec=0
        requests_delta=0
    fi

    prev_total_requests=$total_requests
    prev_ts_epoch=$ts_epoch

    echo "${ts},${active},${reading},${writing},${waiting},${total_requests},${nginx_workers},${nginx_mem},${conn_per_sec},${requests_delta}" >> "$OUTFILE"

    # --- Analyze recent access logs (last INTERVAL seconds) ---
    recent_log_stats=""
    log_analysis=$(docker exec "$CONTAINER" sh -c "
        if [[ -f /var/log/nginx/access.log ]]; then
            tail -100 /var/log/nginx/access.log 2>/dev/null | awk '{
                status[\$9]++; total++
            } END {
                printf \"reqs=%d\", total
                for (s in status) printf \" %s=%d\", s, status[s]
            }'
        else
            echo 'no_log'
        fi
    " 2>/dev/null || echo "log_error")

    # Terminal output
    printf "\n[%s] Nginx Status\n" "$ts"
    if [[ "$STUB_STATUS_AVAILABLE" == "true" ]]; then
        printf "  Active: %-4s  Reading: %-4s  Writing: %-4s  Waiting: %-4s\n" \
            "$active" "$reading" "$writing" "$waiting"
        printf "  Total Requests: %-10s  Req/s: %-6s  Delta: %s\n" \
            "$total_requests" "$conn_per_sec" "$requests_delta"
    fi
    printf "  Workers: %-4s  RSS: %s KB\n" "$nginx_workers" "$nginx_mem"

    if [[ "$log_analysis" != "no_log" && "$log_analysis" != "log_error" ]]; then
        printf "  Recent log: %s\n" "$log_analysis"
    fi

    sleep "$INTERVAL"
done
