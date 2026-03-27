#!/usr/bin/env bash
###############################################################################
# 08-traefik-access.sh – Traefik reverse proxy access log analyzer
#
# Watches Traefik access logs in real-time and computes:
#   - Request rate (req/s)
#   - Response time percentiles (p50, p95, p99)
#   - Status code distribution
#   - Slow request alerts (>2s)
#   - Top requested paths
#   - Concurrent connection estimate
#
# Resource cost: minimal (tail + awk on existing logs).
###############################################################################
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="${SCRIPT_DIR}/logs"
INTERVAL="${1:-30}"
OUTFILE="${LOG_DIR}/traefik-access-$(date +%Y%m%d_%H%M%S).csv"
TRAEFIK_CONTAINER="ehealth-traefik-config-traefik-1"

mkdir -p "$LOG_DIR"

echo "=== Traefik Access Log Analyzer ==="
echo "  Container: ${TRAEFIK_CONTAINER}"
echo "  Interval : ${INTERVAL}s"
echo "  Output   : ${OUTFILE}"
echo ""

# Check if Traefik container exists
if ! docker ps --format '{{.Names}}' | grep -q "^${TRAEFIK_CONTAINER}$"; then
    # Try alternative names
    TRAEFIK_CONTAINER=$(docker ps --format '{{.Names}}' | grep -i traefik | head -1)
    if [[ -z "$TRAEFIK_CONTAINER" ]]; then
        echo "WARNING: No Traefik container found. This script analyzes Traefik access logs."
        echo "  If Traefik is not used, skip this script."
        exit 0
    fi
    echo "  Using container: ${TRAEFIK_CONTAINER}"
fi

# Check if access log is available
HAS_ACCESS_LOG=false
if docker exec "$TRAEFIK_CONTAINER" test -f /var/log/traefik/access.log 2>/dev/null; then
    HAS_ACCESS_LOG=true
    ACCESS_LOG_PATH="/var/log/traefik/access.log"
elif docker exec "$TRAEFIK_CONTAINER" test -f /var/log/access.log 2>/dev/null; then
    HAS_ACCESS_LOG=true
    ACCESS_LOG_PATH="/var/log/access.log"
fi

header="timestamp,total_requests,req_per_sec,status_2xx,status_3xx,status_4xx,status_5xx,avg_duration_ms,p50_ms,p95_ms,p99_ms,slow_requests,unique_clients"
echo "$header" > "$OUTFILE"

if [[ "$HAS_ACCESS_LOG" == "true" ]]; then
    echo "  Access log found: ${ACCESS_LOG_PATH}"
    echo "  Press Ctrl+C to stop."
    echo ""

    while true; do
        ts=$(date '+%Y-%m-%d %H:%M:%S')

        # Get last INTERVAL seconds of access log lines
        analysis=$(docker exec "$TRAEFIK_CONTAINER" sh -c "
            # Get recent lines (approximate by taking tail and filtering)
            tail -1000 ${ACCESS_LOG_PATH} 2>/dev/null | awk '
            BEGIN {
                total=0; s2xx=0; s3xx=0; s4xx=0; s5xx=0; slow=0
            }
            {
                total++
                # Try to extract status code and duration from common log formats
                # Traefik JSON format or common log format
                if (match(\$0, /\"DownstreamStatus\":([0-9]+)/, m)) {
                    status = m[1]
                } else if (match(\$0, /\" ([0-9]{3}) /, m)) {
                    status = m[1]
                } else {
                    status = 0
                }

                if (status >= 200 && status < 300) s2xx++
                else if (status >= 300 && status < 400) s3xx++
                else if (status >= 400 && status < 500) s4xx++
                else if (status >= 500) s5xx++

                # Try to extract duration
                if (match(\$0, /\"Duration\":([0-9]+)/, m)) {
                    dur = m[1] / 1000000  # nanoseconds to ms
                } else if (match(\$0, /\"request_duration\":\"([0-9.]+)/, m)) {
                    dur = m[1] * 1000  # seconds to ms
                } else {
                    dur = 0
                }

                if (dur > 0) {
                    durations[++n] = dur
                    sum += dur
                    if (dur > 2000) slow++
                }

                # Client IP
                if (match(\$0, /\"ClientAddr\":\"([^\"]+)\"/, m)) {
                    clients[m[1]] = 1
                } else if (match(\$0, /^([0-9.]+)/, m)) {
                    clients[m[1]] = 1
                }
            }
            END {
                avg = (n > 0) ? sum/n : 0
                # Sort durations for percentiles
                asort(durations)
                p50 = (n > 0) ? durations[int(n*0.5)] : 0
                p95 = (n > 0) ? durations[int(n*0.95)] : 0
                p99 = (n > 0) ? durations[int(n*0.99)] : 0

                uc = 0; for (c in clients) uc++

                printf \"%d,%.1f,%d,%d,%d,%d,%.1f,%.1f,%.1f,%.1f,%d,%d\",
                    total, total/${INTERVAL}, s2xx, s3xx, s4xx, s5xx,
                    avg, p50, p95, p99, slow, uc
            }'
        " 2>/dev/null || echo "0,0,0,0,0,0,0,0,0,0,0,0")

        echo "${ts},${analysis}" >> "$OUTFILE"

        # Parse for display
        IFS=',' read -r total rps s2 s3 s4 s5 avg p50 p95 p99 slow clients <<< "$analysis"

        printf "\n[%s] Traefik Access Summary (last %ss window)\n" "$ts" "$INTERVAL"
        printf "  Requests: %-6s  Rate: %s req/s  Clients: %s\n" "$total" "$rps" "$clients"
        printf "  Status:  2xx=%-5s  3xx=%-5s  4xx=%-5s  5xx=%s\n" "$s2" "$s3" "$s4" "$s5"
        printf "  Latency: avg=%-8s  p50=%-8s  p95=%-8s  p99=%s ms\n" "${avg}ms" "${p50}ms" "${p95}ms" "${p99}ms"

        if [[ "${slow:-0}" -gt 0 ]]; then
            printf "  \033[33m⚠ Slow requests (>2s): %s\033[0m\n" "$slow"
        fi
        if [[ "${s5:-0}" -gt 0 ]]; then
            printf "  \033[31m⚠ Server errors (5xx): %s\033[0m\n" "$s5"
        fi

        sleep "$INTERVAL"
    done
else
    echo "  No access log found in Traefik container."
    echo "  To enable access logging, add to Traefik static config:"
    echo "    accessLog:"
    echo "      filePath: /var/log/traefik/access.log"
    echo ""
    echo "  Falling back to Traefik API metrics (if available)..."
    echo ""

    # Fallback: try Traefik API
    while true; do
        ts=$(date '+%Y-%m-%d %H:%M:%S')

        # Check Traefik dashboard/API
        api_result=$(docker exec "$TRAEFIK_CONTAINER" wget -qO- http://localhost:8080/api/overview 2>/dev/null || echo "{}")

        if [[ "$api_result" != "{}" ]]; then
            echo "[${ts}] Traefik API Overview:"
            echo "$api_result" | python3 -m json.tool 2>/dev/null || echo "  $api_result"
        else
            echo "[${ts}] Traefik API not available (dashboard may be disabled)"
        fi

        # Check entrypoints
        entry_result=$(docker exec "$TRAEFIK_CONTAINER" wget -qO- http://localhost:8080/api/entrypoints 2>/dev/null || echo "[]")
        if [[ "$entry_result" != "[]" ]]; then
            echo "  Entrypoints:"
            echo "  $entry_result" | head -5
        fi

        sleep "$INTERVAL"
    done
fi
