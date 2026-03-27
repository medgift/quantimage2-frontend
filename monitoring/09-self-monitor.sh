#!/usr/bin/env bash
###############################################################################
# 09-self-monitor.sh – Self-resource usage tracker for monitoring scripts
#
# Tracks the CPU/memory footprint of all running monitoring scripts to ensure
# they don't become the cause of performance issues.
#
# Writes to logs/self-monitor-<timestamp>.csv
#
# Resource cost: ~0.1% CPU (single ps + awk per interval).
###############################################################################
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="${SCRIPT_DIR}/logs"
INTERVAL="${1:-30}"
OUTFILE="${LOG_DIR}/self-monitor-$(date +%Y%m%d_%H%M%S).csv"

mkdir -p "$LOG_DIR"

header="timestamp,script_name,pid,cpu%,mem%,rss_kb,vsz_kb,elapsed"
echo "$header" > "$OUTFILE"

echo "=== Self Resource Monitor ==="
echo "  Tracking: monitoring/*.sh processes"
echo "  Interval: ${INTERVAL}s"
echo "  Output  : ${OUTFILE}"
echo "  Press Ctrl+C to stop."
echo ""

while true; do
    ts=$(date '+%Y-%m-%d %H:%M:%S')

    total_cpu=0
    total_rss=0
    count=0

    printf "\n[%s] Monitoring Scripts Resource Usage\n" "$ts"
    printf "  %-35s %7s %7s %10s %10s\n" "SCRIPT" "CPU%" "MEM%" "RSS_KB" "VSZ_KB"
    printf "  %s\n" "$(printf '─%.0s' {1..75})"

    # Find all monitoring script processes (bash scripts in this directory)
    # Also include their child processes (sleep, docker, curl, awk)
    while IFS= read -r line; do
        pid=$(echo "$line" | awk '{print $1}')
        cpu=$(echo "$line" | awk '{print $2}')
        mem=$(echo "$line" | awk '{print $3}')
        rss=$(echo "$line" | awk '{print $4}')
        vsz=$(echo "$line" | awk '{print $5}')
        elapsed=$(echo "$line" | awk '{print $6}')
        cmd=$(echo "$line" | awk '{for(i=7;i<=NF;i++) printf "%s ", $i; print ""}' | head -c 60)

        # Extract script name from command
        script_name=$(echo "$cmd" | grep -oP '\d+-[a-z-]+\.sh' || echo "$cmd")

        echo "${ts},${script_name},${pid},${cpu},${mem},${rss},${vsz},${elapsed}" >> "$OUTFILE"

        printf "  %-35s %7s %7s %10s %10s\n" \
            "${script_name:0:35}" "$cpu" "$mem" "$rss" "$vsz"

        total_cpu=$(awk "BEGIN{printf \"%.1f\", $total_cpu + $cpu}")
        total_rss=$((total_rss + rss))
        count=$((count + 1))

    done < <(ps aux | grep -E "monitoring/[0-9]+-.*\.sh" | grep -v "grep\|$$\|09-self-monitor" | awk '{printf "%s %s %s %s %s %s ", $2,$3,$4,$6,$5,$10; for(i=11;i<=NF;i++) printf "%s ", $i; print ""}')

    # Also track child processes (docker, curl, etc.) spawned by monitoring scripts
    child_cpu=0
    child_rss=0
    while IFS= read -r line; do
        pid=$(echo "$line" | awk '{print $1}')
        ppid=$(echo "$line" | awk '{print $2}')
        cpu=$(echo "$line" | awk '{print $3}')
        rss=$(echo "$line" | awk '{print $5}')
        cmd=$(echo "$line" | awk '{for(i=7;i<=NF;i++) printf "%s ", $i}' | head -c 40)

        # Check if parent is a monitoring script
        parent_cmd=$(ps -p "$ppid" -o args= 2>/dev/null || echo "")
        if echo "$parent_cmd" | grep -q "monitoring/"; then
            child_cpu=$(awk "BEGIN{printf \"%.1f\", $child_cpu + $cpu}")
            child_rss=$((child_rss + rss))
        fi
    done < <(ps aux | grep -E "docker|curl|awk|sleep" | grep -v "grep" | awk '{printf "%s %s %s %s %s %s ", $2,$3,$4,$6,$5,$10; for(i=11;i<=NF;i++) printf "%s ", $i; print ""}' 2>/dev/null || true)

    total_cpu=$(awk "BEGIN{printf \"%.1f\", $total_cpu + $child_cpu}")
    total_rss=$((total_rss + child_rss))
    total_rss_mb=$(awk "BEGIN{printf \"%.1f\", $total_rss / 1024}")

    printf "  %s\n" "$(printf '─%.0s' {1..75})"
    printf "  %-35s %7s         %10s\n" "TOTAL (scripts + children)" "${total_cpu}%" "${total_rss_mb} MB"
    echo ""

    # Alert thresholds
    if (( $(awk "BEGIN{print ($total_cpu > 10) ? 1 : 0}") )); then
        printf "  \033[31m⚠ WARNING: Monitoring scripts using >10%% CPU! Consider increasing intervals.\033[0m\n"
    fi
    if [[ $total_rss -gt 524288 ]]; then  # 512 MB
        printf "  \033[31m⚠ WARNING: Monitoring scripts using >512 MB RAM!\033[0m\n"
    fi

    # Summary line for quick reference
    echo "${ts},TOTAL,,${total_cpu},,${total_rss},,," >> "$OUTFILE"

    sleep "$INTERVAL"
done
