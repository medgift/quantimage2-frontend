#!/usr/bin/env bash
###############################################################################
# 05-socketio-health.sh – Socket.IO & WebSocket health monitor
#
# Checks:
#   - Socket.IO polling transport (HTTP long-poll fallback)
#   - WebSocket upgrade availability
#   - Backend Socket.IO server responsiveness
#   - Redis socket pub/sub health (connection count)
#
# Resource cost: ~2 curl calls + 1 docker exec per interval.
###############################################################################
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="${SCRIPT_DIR}/logs"
INTERVAL="${1:-20}"
OUTFILE="${LOG_DIR}/socketio-health-$(date +%Y%m%d_%H%M%S).csv"

mkdir -p "$LOG_DIR"

# --- Detect backend URL ---
detect_url() {
    local var_name="$1"
    local default="$2"
    local val=""
    for envfile in "${SCRIPT_DIR}/../.env.local" "${SCRIPT_DIR}/../.env"; do
        if [[ -f "$envfile" ]]; then
            val=$(grep "^${var_name}=" "$envfile" 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '"' || true)
            [[ -n "$val" ]] && break
        fi
    done
    echo "${val:-$default}"
}

# Try to detect the backend URL from Traefik or env
BACKEND_URL=$(detect_url "REACT_APP_PYTHON_BACKEND_URL" "")

# If empty, try the Traefik host with /backend path or direct container
if [[ -z "$BACKEND_URL" ]]; then
    TRAEFIK_HOST=$(docker inspect quantimage2-frontend-web-1 --format '{{range $k,$v := .Config.Labels}}{{if eq $k "traefik.http.routers.quantimage2-frontend-web.rule"}}{{$v}}{{end}}{{end}}' 2>/dev/null | sed -n 's/.*Host(`\([^`]*\)`).*/\1/p' || echo "")
    if [[ -n "$TRAEFIK_HOST" ]]; then
        BACKEND_URL="https://${TRAEFIK_HOST}"
    else
        BACKEND_URL="http://localhost:5001"
    fi
fi

REDIS_SOCKET_CONTAINER="quantimage2-redis-socket-1"

header="timestamp,socketio_poll_http,socketio_poll_ms,socketio_ws_http,socketio_ws_ms,redis_socket_connected_clients,redis_socket_memory_mb,redis_socket_pubsub_channels,error"
echo "$header" > "$OUTFILE"

echo "=== Socket.IO Health Monitor ==="
echo "  Backend URL    : ${BACKEND_URL}"
echo "  Redis Container: ${REDIS_SOCKET_CONTAINER}"
echo "  Interval       : ${INTERVAL}s"
echo "  Output         : ${OUTFILE}"
echo "  Press Ctrl+C to stop."
echo ""

while true; do
    ts=$(date '+%Y-%m-%d %H:%M:%S')
    error=""

    # --- 1. Socket.IO polling transport ---
    poll_result=$(curl -sk -o /dev/null -w '%{http_code},%{time_total}' \
        --max-time 10 --connect-timeout 5 \
        "${BACKEND_URL}/socket.io/?EIO=4&transport=polling" 2>/dev/null) || poll_result="000,0"

    poll_http=$(echo "$poll_result" | cut -d, -f1)
    poll_ms=$(echo "$poll_result" | awk -F, '{printf "%.1f",$2*1000}')

    # --- 2. WebSocket upgrade probe (just check if upgrade headers work) ---
    ws_result=$(curl -sk -o /dev/null -w '%{http_code},%{time_total}' \
        --max-time 10 --connect-timeout 5 \
        -H "Connection: Upgrade" \
        -H "Upgrade: websocket" \
        -H "Sec-WebSocket-Version: 13" \
        -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
        "${BACKEND_URL}/socket.io/?EIO=4&transport=websocket" 2>/dev/null) || ws_result="000,0"

    ws_http=$(echo "$ws_result" | cut -d, -f1)
    ws_ms=$(echo "$ws_result" | awk -F, '{printf "%.1f",$2*1000}')

    # --- 3. Redis Socket health (pub/sub for Socket.IO) ---
    redis_clients=0; redis_mem="0"; redis_pubsub=0

    if docker ps --format '{{.Names}}' | grep -q "^${REDIS_SOCKET_CONTAINER}$"; then
        redis_info=$(docker exec "$REDIS_SOCKET_CONTAINER" redis-cli INFO 2>/dev/null || echo "")
        if [[ -n "$redis_info" ]]; then
            redis_clients=$(echo "$redis_info" | grep "^connected_clients:" | cut -d: -f2 | tr -d '\r' || echo 0)
            redis_mem=$(echo "$redis_info" | grep "^used_memory_human:" | cut -d: -f2 | tr -d '\r' || echo "0B")
            redis_pubsub=$(echo "$redis_info" | grep "^pubsub_channels:" | cut -d: -f2 | tr -d '\r' || echo 0)
        else
            error="redis_unreachable"
        fi
    else
        error="redis_container_not_found"
    fi

    # Determine overall health
    if [[ "$poll_http" == "000" ]]; then
        error="${error:+${error};}socketio_unreachable"
    fi

    echo "${ts},${poll_http},${poll_ms},${ws_http},${ws_ms},${redis_clients},${redis_mem},${redis_pubsub},${error}" >> "$OUTFILE"

    # Terminal output
    printf "\n[%s] Socket.IO Health\n" "$ts"

    # Color for Socket.IO
    if [[ "$poll_http" == "200" || "$poll_http" == "400" ]]; then
        printf "  \033[32mPolling:   HTTP %s (%s ms)\033[0m\n" "$poll_http" "$poll_ms"
    else
        printf "  \033[31mPolling:   HTTP %s (%s ms)\033[0m\n" "$poll_http" "$poll_ms"
    fi

    # WS upgrade: 101=upgrade success, 400=normal (no real WS client), 200=polling fallback
    if [[ "$ws_http" == "101" || "$ws_http" == "400" || "$ws_http" == "200" ]]; then
        printf "  \033[32mWebSocket: HTTP %s (%s ms)\033[0m\n" "$ws_http" "$ws_ms"
    else
        printf "  \033[31mWebSocket: HTTP %s (%s ms)\033[0m\n" "$ws_http" "$ws_ms"
    fi

    printf "  Redis Socket: clients=%s  mem=%s  pubsub_channels=%s\n" \
        "$redis_clients" "$redis_mem" "$redis_pubsub"

    if [[ -n "$error" ]]; then
        printf "  \033[31mErrors: %s\033[0m\n" "$error"
    fi

    sleep "$INTERVAL"
done
