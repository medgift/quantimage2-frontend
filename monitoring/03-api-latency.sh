#!/usr/bin/env bash
###############################################################################
# 03-api-latency.sh – API endpoint latency prober
#
# Periodically probes key endpoints that the frontend relies on:
#   - Frontend static files (nginx)
#   - Backend API health
#   - Kheops API
#   - Keycloak well-known config
#
# Measures DNS, connect, TLS, TTFB, and total time.
# Does NOT require authentication (only probes public/health endpoints).
#
# Resource cost: negligible (~4 curl calls per interval).
###############################################################################
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="${SCRIPT_DIR}/logs"
INTERVAL="${1:-15}"
OUTFILE="${LOG_DIR}/api-latency-$(date +%Y%m%d_%H%M%S).csv"

mkdir -p "$LOG_DIR"

# --- Auto-detect URLs from .env files or use defaults ---
# Try to read env vars from the built JS bundle or env files
detect_url() {
    local var_name="$1"
    local default="$2"
    local val=""

    # Try .env.local, .env, docker-compose env
    for envfile in "${SCRIPT_DIR}/../.env.local" "${SCRIPT_DIR}/../.env" "${SCRIPT_DIR}/../.env.production"; do
        if [[ -f "$envfile" ]]; then
            val=$(grep "^${var_name}=" "$envfile" 2>/dev/null | tail -1 | cut -d= -f2- | tr -d '"' || true)
            [[ -n "$val" ]] && break
        fi
    done

    echo "${val:-$default}"
}

# Detect Traefik frontend URL by checking container labels
TRAEFIK_HOST=$(docker inspect quantimage2-frontend-web-1 --format '{{range $k,$v := .Config.Labels}}{{if eq $k "traefik.http.routers.quantimage2-frontend-web.rule"}}{{$v}}{{end}}{{end}}' 2>/dev/null | sed -n 's/.*Host(`\([^`]*\)`).*/\1/p' || echo "")

if [[ -n "$TRAEFIK_HOST" ]]; then
    FRONTEND_URL="https://${TRAEFIK_HOST}"
else
    FRONTEND_URL="http://localhost:3000"
fi

# Backend URL - try to get from the running backend container
BACKEND_PORT=$(docker port quantimage2-backend-1 2>/dev/null | grep -oP ':\K[0-9]+$' | head -1 || echo "")
if [[ -n "$BACKEND_PORT" ]]; then
    BACKEND_URL="http://localhost:${BACKEND_PORT}"
else
    BACKEND_URL=$(detect_url "REACT_APP_PYTHON_BACKEND_URL" "http://localhost:5001")
fi

KHEOPS_URL=$(detect_url "REACT_APP_KHEOPS_URL" "http://localhost")
KEYCLOAK_URL=$(detect_url "REACT_APP_KEYCLOAK_URL" "http://localhost:8081/auth")
KEYCLOAK_REALM=$(detect_url "REACT_APP_KEYCLOAK_REALM" "QuantImage-v2")

# Define probe endpoints
declare -A ENDPOINTS
ENDPOINTS["frontend_index"]="${FRONTEND_URL}/"
ENDPOINTS["frontend_static_js"]="${FRONTEND_URL}/static/js/"
ENDPOINTS["frontend_manifest"]="${FRONTEND_URL}/manifest.json"
ENDPOINTS["backend_health"]="${BACKEND_URL}/"
ENDPOINTS["kheops_api"]="${KHEOPS_URL}/api/"
ENDPOINTS["keycloak_wellknown"]="${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/.well-known/openid-configuration"

header="timestamp,endpoint,http_code,dns_ms,connect_ms,tls_ms,ttfb_ms,total_ms,size_bytes,error"
echo "$header" > "$OUTFILE"

echo "=== API Latency Prober ==="
echo "  Interval : ${INTERVAL}s"
echo "  Output   : ${OUTFILE}"
echo ""
echo "  Probing endpoints:"
for name in "${!ENDPOINTS[@]}"; do
    echo "    ${name}: ${ENDPOINTS[$name]}"
done
echo ""
echo "  Press Ctrl+C to stop."
echo ""

# curl write-out format for timing
CURL_FORMAT='%{http_code},%{time_namelookup},%{time_connect},%{time_appconnect},%{time_starttransfer},%{time_total},%{size_download}'

probe_endpoint() {
    local name="$1"
    local url="$2"
    local ts="$3"

    result=$(curl -sk -o /dev/null -w "$CURL_FORMAT" \
        --max-time 10 \
        --connect-timeout 5 \
        "$url" 2>/dev/null) || result="000,0,0,0,0,0,0"

    IFS=',' read -r code dns_s conn_s tls_s ttfb_s total_s size <<< "$result"

    # Convert seconds to milliseconds
    dns_ms=$(awk "BEGIN{printf \"%.1f\", $dns_s*1000}")
    conn_ms=$(awk "BEGIN{printf \"%.1f\", $conn_s*1000}")
    tls_ms=$(awk "BEGIN{printf \"%.1f\", $tls_s*1000}")
    ttfb_ms=$(awk "BEGIN{printf \"%.1f\", $ttfb_s*1000}")
    total_ms=$(awk "BEGIN{printf \"%.1f\", $total_s*1000}")

    error=""
    if [[ "$code" == "000" ]]; then
        error="connection_failed"
    elif [[ "$code" -ge 500 ]]; then
        error="server_error"
    elif [[ "$code" -ge 400 ]]; then
        error="client_error"
    fi

    echo "${ts},${name},${code},${dns_ms},${conn_ms},${tls_ms},${ttfb_ms},${total_ms},${size},${error}" >> "$OUTFILE"

    # Color-coded terminal output
    if [[ "$code" == "000" ]] || [[ "$code" -ge 500 ]]; then
        color="\033[31m"  # Red
    elif [[ "$code" -ge 400 ]]; then
        color="\033[33m"  # Yellow
    elif (( $(awk "BEGIN{print ($total_s > 2.0) ? 1 : 0}") )); then
        color="\033[33m"  # Yellow for slow
    else
        color="\033[32m"  # Green
    fi
    reset="\033[0m"

    printf "  ${color}%-25s HTTP %s  DNS=%-6s Conn=%-6s TTFB=%-8s Total=%-8s Size=%-8s${reset}\n" \
        "$name" "$code" "${dns_ms}ms" "${conn_ms}ms" "${ttfb_ms}ms" "${total_ms}ms" "${size}B"
}

while true; do
    ts=$(date '+%Y-%m-%d %H:%M:%S')
    echo ""
    echo "[${ts}] Probing endpoints..."

    for name in $(echo "${!ENDPOINTS[@]}" | tr ' ' '\n' | sort); do
        probe_endpoint "$name" "${ENDPOINTS[$name]}" "$ts"
    done

    sleep "$INTERVAL"
done
