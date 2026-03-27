#!/usr/bin/env bash
###############################################################################
# 02-docker-containers.sh – Docker container resource monitor
#
# Tracks CPU%, memory, network I/O, and PIDs for all quantimage2-* containers
# plus Traefik and Keycloak. Uses `docker stats --no-stream` (single snapshot).
#
# Resource cost: ~1-2% CPU per sample (docker stats API call).
###############################################################################
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="${SCRIPT_DIR}/logs"
INTERVAL="${1:-15}"        # seconds between samples (default 15)
OUTFILE="${LOG_DIR}/docker-containers-$(date +%Y%m%d_%H%M%S).csv"

mkdir -p "$LOG_DIR"

# Containers to monitor (pattern match)
PATTERNS="quantimage2|keycloak-keycloak-1|ehealth-traefik|kheops"

header="timestamp,container,cpu%,mem_usage,mem_limit,mem%,net_in,net_out,block_in,block_out,pids"
echo "$header" > "$OUTFILE"

echo "=== Docker Container Monitor ==="
echo "  Interval : ${INTERVAL}s"
echo "  Patterns : ${PATTERNS}"
echo "  Output   : ${OUTFILE}"
echo "  Press Ctrl+C to stop."
echo ""

while true; do
    ts=$(date '+%Y-%m-%d %H:%M:%S')

    # Get all matching container names
    containers=$(docker ps --format '{{.Names}}' | grep -E "$PATTERNS" | sort)

    if [[ -z "$containers" ]]; then
        echo "[${ts}] WARNING: No matching containers found"
        sleep "$INTERVAL"
        continue
    fi

    # Single docker stats call for all containers (efficient)
    stats_output=$(docker stats --no-stream --format '{{.Name}},{{.CPUPerc}},{{.MemUsage}},{{.MemPerc}},{{.NetIO}},{{.BlockIO}},{{.PIDs}}' $containers 2>/dev/null || true)

    if [[ -n "$stats_output" ]]; then
        # Print header periodically
        printf "\n[%s] %-42s %7s %12s / %-12s %6s %12s / %-12s %5s\n" \
            "$ts" "CONTAINER" "CPU%" "MEM_USED" "MEM_LIMIT" "MEM%" "NET_IN" "NET_OUT" "PIDS"
        printf "%s\n" "$(printf '─%.0s' {1..130})"

        while IFS=',' read -r name cpu mem_usage mem_pct net_io block_io pids; do
            # Parse mem usage (format: "123.4MiB / 1.5GiB")
            mem_used=$(echo "$mem_usage" | awk -F'/' '{gsub(/^ +| +$/,"",$1); print $1}')
            mem_limit=$(echo "$mem_usage" | awk -F'/' '{gsub(/^ +| +$/,"",$2); print $2}')
            # Parse net I/O (format: "1.23MB / 4.56MB")
            net_in=$(echo "$net_io" | awk -F'/' '{gsub(/^ +| +$/,"",$1); print $1}')
            net_out=$(echo "$net_io" | awk -F'/' '{gsub(/^ +| +$/,"",$2); print $2}')
            # Parse block I/O
            block_in=$(echo "$block_io" | awk -F'/' '{gsub(/^ +| +$/,"",$1); print $1}')
            block_out=$(echo "$block_io" | awk -F'/' '{gsub(/^ +| +$/,"",$2); print $2}')

            echo "${ts},${name},${cpu},${mem_used},${mem_limit},${mem_pct},${net_in},${net_out},${block_in},${block_out},${pids}" >> "$OUTFILE"

            # Terminal display
            printf "  %-42s %7s %12s / %-12s %6s %12s / %-12s %5s\n" \
                "$name" "$cpu" "$mem_used" "$mem_limit" "$mem_pct" "$net_in" "$net_out" "$pids"
        done <<< "$stats_output"
    fi

    sleep "$INTERVAL"
done
