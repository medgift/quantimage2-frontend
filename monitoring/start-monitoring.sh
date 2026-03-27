#!/usr/bin/env bash
###############################################################################
# start-monitoring.sh – Master orchestrator for all monitoring scripts
#
# Launches selected monitoring scripts as background processes with controlled
# intervals to minimize resource impact. Provides a unified interface to
# start, stop, and check status of all monitors.
#
# Usage:
#   ./start-monitoring.sh              # Start all monitors with defaults
#   ./start-monitoring.sh --light      # Start with longer intervals (low impact)
#   ./start-monitoring.sh --stop       # Stop all running monitors
#   ./start-monitoring.sh --status     # Show running monitor processes
#   ./start-monitoring.sh --bundle     # Run one-shot bundle analysis only
###############################################################################
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="${SCRIPT_DIR}/logs"
PID_DIR="${SCRIPT_DIR}/logs/.pids"

mkdir -p "$LOG_DIR" "$PID_DIR"

# Color helpers
RED='\033[31m'
GREEN='\033[32m'
YELLOW='\033[33m'
BLUE='\033[34m'
BOLD='\033[1m'
RESET='\033[0m'

print_banner() {
    echo ""
    echo -e "${BOLD}${BLUE}╔══════════════════════════════════════════════════════════════╗${RESET}"
    echo -e "${BOLD}${BLUE}║     QuantImage v2 – Frontend Performance Monitor Suite      ║${RESET}"
    echo -e "${BOLD}${BLUE}║     $(date '+%Y-%m-%d %H:%M:%S')                                     ║${RESET}"
    echo -e "${BOLD}${BLUE}╚══════════════════════════════════════════════════════════════╝${RESET}"
    echo ""
}

stop_all() {
    echo -e "${YELLOW}Stopping all monitoring scripts...${RESET}"
    local stopped=0
    for pidfile in "$PID_DIR"/*.pid; do
        [[ -f "$pidfile" ]] || continue
        local pid
        pid=$(cat "$pidfile")
        local name
        name=$(basename "$pidfile" .pid)
        if kill -0 "$pid" 2>/dev/null; then
            # Kill the process group to also stop children
            kill -- -"$pid" 2>/dev/null || kill "$pid" 2>/dev/null || true
            echo "  Stopped: ${name} (PID ${pid})"
            stopped=$((stopped + 1))
        fi
        rm -f "$pidfile"
    done
    if [[ $stopped -eq 0 ]]; then
        echo "  No running monitors found."
    else
        echo -e "${GREEN}Stopped ${stopped} monitors.${RESET}"
    fi
}

show_status() {
    echo -e "${BOLD}Running Monitors:${RESET}"
    local running=0
    for pidfile in "$PID_DIR"/*.pid; do
        [[ -f "$pidfile" ]] || continue
        local pid
        pid=$(cat "$pidfile")
        local name
        name=$(basename "$pidfile" .pid)
        if kill -0 "$pid" 2>/dev/null; then
            local cpu_mem
            cpu_mem=$(ps -p "$pid" -o %cpu=,%mem=,rss=,etime= 2>/dev/null || echo "? ? ? ?")
            echo -e "  ${GREEN}●${RESET} ${name} (PID ${pid}) – CPU/Mem/RSS/Elapsed: ${cpu_mem}"
            running=$((running + 1))
        else
            echo -e "  ${RED}○${RESET} ${name} (PID ${pid}) – STOPPED"
            rm -f "$pidfile"
        fi
    done

    if [[ $running -eq 0 ]]; then
        echo "  No monitors currently running."
    fi
    echo ""

    # Show log file sizes
    echo -e "${BOLD}Log Files:${RESET}"
    if ls "$LOG_DIR"/*.csv "$LOG_DIR"/*.txt 2>/dev/null | head -1 > /dev/null 2>&1; then
        ls -lhS "$LOG_DIR"/*.csv "$LOG_DIR"/*.txt 2>/dev/null | awk '{printf "  %8s  %s\n", $5, $NF}'
    else
        echo "  No log files yet."
    fi
    echo ""

    # Show total disk usage of logs
    total_log_size=$(du -sh "$LOG_DIR" 2>/dev/null | awk '{print $1}')
    echo "  Total log size: ${total_log_size}"
}

start_script() {
    local script="$1"
    local interval="$2"
    local name
    name=$(basename "$script" .sh)
    local pidfile="${PID_DIR}/${name}.pid"
    local logfile="${LOG_DIR}/${name}-console-$(date +%Y%m%d_%H%M%S).log"

    # Check if already running
    if [[ -f "$pidfile" ]]; then
        local existing_pid
        existing_pid=$(cat "$pidfile")
        if kill -0 "$existing_pid" 2>/dev/null; then
            echo -e "  ${YELLOW}⏭ ${name} already running (PID ${existing_pid})${RESET}"
            return 0
        fi
        rm -f "$pidfile"
    fi

    # Start in new process group (setsid)
    setsid bash "$script" "$interval" > "$logfile" 2>&1 &
    local pid=$!
    echo "$pid" > "$pidfile"
    echo -e "  ${GREEN}✓ ${name}${RESET} – PID ${pid}, interval ${interval}s, log → $(basename "$logfile")"
}

# ─── Parse arguments ──────────────────────────────────────────────────
MODE="start"
PROFILE="normal"

while [[ $# -gt 0 ]]; do
    case "$1" in
        --stop)    MODE="stop" ;;
        --status)  MODE="status" ;;
        --bundle)  MODE="bundle" ;;
        --light)   PROFILE="light" ;;
        --heavy)   PROFILE="heavy" ;;
        --help|-h)
            echo "Usage: $0 [--light|--heavy] [--stop|--status|--bundle]"
            echo ""
            echo "Modes:"
            echo "  (default)   Start all monitoring scripts"
            echo "  --stop      Stop all running monitors"
            echo "  --status    Show running monitors and log sizes"
            echo "  --bundle    Run one-shot bundle analysis only"
            echo ""
            echo "Profiles:"
            echo "  --light     Longer intervals (low resource impact)"
            echo "  (default)   Normal monitoring intervals"
            echo "  --heavy     Shorter intervals (more data, more CPU)"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
    shift
done

# ─── Execute mode ─────────────────────────────────────────────────────
case "$MODE" in
    stop)
        print_banner
        stop_all
        exit 0
        ;;
    status)
        print_banner
        show_status
        exit 0
        ;;
    bundle)
        print_banner
        bash "${SCRIPT_DIR}/07-bundle-analysis.sh"
        exit 0
        ;;
esac

# ─── Start monitoring ────────────────────────────────────────────────
print_banner

# Define intervals per profile
#                        light    normal   heavy
declare -A INT_HOST=(    [light]=30  [normal]=10  [heavy]=5  )
declare -A INT_DOCKER=(  [light]=30  [normal]=15  [heavy]=10 )
declare -A INT_API=(     [light]=30  [normal]=15  [heavy]=5  )
declare -A INT_NGINX=(   [light]=30  [normal]=15  [heavy]=10 )
declare -A INT_SOCKET=(  [light]=60  [normal]=20  [heavy]=10 )
declare -A INT_TRAEFIK=( [light]=60  [normal]=30  [heavy]=15 )
declare -A INT_SELF=(    [light]=60  [normal]=30  [heavy]=15 )
declare -A INT_BACKEND=( [light]=30  [normal]=20  [heavy]=10 )

echo -e "${BOLD}Profile: ${PROFILE}${RESET}"
echo -e "${BOLD}Starting monitors...${RESET}"
echo ""

# Stop any previously running monitors
for pidfile in "$PID_DIR"/*.pid; do
    [[ -f "$pidfile" ]] || continue
    pid=$(cat "$pidfile")
    kill -- -"$pid" 2>/dev/null || kill "$pid" 2>/dev/null || true
    rm -f "$pidfile"
done

# Start each monitor
start_script "${SCRIPT_DIR}/01-host-resources.sh"   "${INT_HOST[$PROFILE]}"
start_script "${SCRIPT_DIR}/02-docker-containers.sh" "${INT_DOCKER[$PROFILE]}"
start_script "${SCRIPT_DIR}/03-api-latency.sh"       "${INT_API[$PROFILE]}"
start_script "${SCRIPT_DIR}/04-nginx-connections.sh"  "${INT_NGINX[$PROFILE]}"
start_script "${SCRIPT_DIR}/05-socketio-health.sh"    "${INT_SOCKET[$PROFILE]}"
start_script "${SCRIPT_DIR}/08-traefik-access.sh"     "${INT_TRAEFIK[$PROFILE]}"
start_script "${SCRIPT_DIR}/09-self-monitor.sh"        "${INT_SELF[$PROFILE]}"
start_script "${SCRIPT_DIR}/10-backend-health.sh"     "${INT_BACKEND[$PROFILE]}"

echo ""

# Run bundle analysis once (it's a one-shot)
echo -e "${BOLD}Running one-time bundle analysis...${RESET}"
bash "${SCRIPT_DIR}/07-bundle-analysis.sh" 2>/dev/null || echo "  (bundle analysis completed or skipped)"

echo ""
echo -e "${BOLD}${GREEN}All monitors started!${RESET}"
echo ""
echo "Usage:"
echo "  $0 --status     # Check running monitors & log sizes"
echo "  $0 --stop       # Stop all monitors"
echo ""
echo "Logs directory: ${LOG_DIR}/"
echo ""
echo "Browser monitoring:"
echo "  Open browser DevTools console on the QuantImage app and paste:"
echo "  ${SCRIPT_DIR}/06-browser-performance.js"
echo ""
echo "Analyze collected data:"
echo "  bash ${SCRIPT_DIR}/11-analyze-logs.sh"
echo ""
