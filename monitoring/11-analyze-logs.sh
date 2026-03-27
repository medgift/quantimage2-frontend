#!/usr/bin/env bash
###############################################################################
# 11-analyze-logs.sh – Post-session log analyzer
#
# Reads all CSV logs from a monitoring session and produces a consolidated
# performance report highlighting:
#   - Peak resource usage
#   - Slowest API endpoints
#   - Error counts and patterns
#   - Memory trends
#   - Bottleneck identification
#   - Actionable recommendations
#
# Usage: ./11-analyze-logs.sh [logs-directory]
###############################################################################
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="${1:-${SCRIPT_DIR}/logs}"
REPORT="${LOG_DIR}/performance-report-$(date +%Y%m%d_%H%M%S).txt"

if [[ ! -d "$LOG_DIR" ]]; then
    echo "ERROR: Log directory not found: $LOG_DIR"
    exit 1
fi

{
    echo "╔══════════════════════════════════════════════════════════════════════════════╗"
    echo "║           QuantImage v2 – Frontend Performance Analysis Report             ║"
    echo "║           Generated: $(date '+%Y-%m-%d %H:%M:%S')                                       ║"
    echo "╚══════════════════════════════════════════════════════════════════════════════╝"
    echo ""

    # --- 1. Host Resources Summary ---
    host_file=$(ls -t "$LOG_DIR"/host-resources-*.csv 2>/dev/null | head -1)
    if [[ -n "$host_file" && -f "$host_file" ]]; then
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "  1. HOST RESOURCE USAGE"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "  Source: $(basename "$host_file")"
        samples=$(tail -n +2 "$host_file" | wc -l)
        echo "  Samples: $samples"
        echo ""

        awk -F',' 'NR>1 {
            cpu_user+=$2; cpu_sys+=$3; cpu_iowait+=$4
            mem_pct+=$9
            if($2>max_cpu) {max_cpu=$2; max_cpu_ts=$1}
            if($9>max_mem) {max_mem=$9; max_mem_ts=$1}
            if($4>max_iow) {max_iow=$4; max_iow_ts=$1}
            if($12>max_load) {max_load=$12; max_load_ts=$1}
            n++
        } END {
            if(n>0) {
                printf "  CPU Usage:\n"
                printf "    Average: user=%.1f%% sys=%.1f%% iowait=%.1f%%\n", cpu_user/n, cpu_sys/n, cpu_iowait/n
                printf "    Peak CPU: %.1f%% at %s\n", max_cpu, max_cpu_ts
                printf "    Peak I/O wait: %.1f%% at %s\n", max_iow, max_iow_ts
                printf "\n"
                printf "  Memory:\n"
                printf "    Average usage: %.1f%%\n", mem_pct/n
                printf "    Peak usage: %.1f%% at %s\n", max_mem, max_mem_ts
                printf "\n"
                printf "  Load Average:\n"
                printf "    Peak 1m load: %.2f at %s\n", max_load, max_load_ts

                if (max_cpu > 80) printf "\n  ⚠ ALERT: CPU peaked above 80%%!\n"
                if (max_mem > 85) printf "  ⚠ ALERT: Memory peaked above 85%%!\n"
                if (max_iow > 20) printf "  ⚠ ALERT: High I/O wait detected (>20%%)!\n"
            }
        }' "$host_file"
        echo ""
    fi

    # --- 2. Docker Container Summary ---
    docker_file=$(ls -t "$LOG_DIR"/docker-containers-*.csv 2>/dev/null | head -1)
    if [[ -n "$docker_file" && -f "$docker_file" ]]; then
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "  2. DOCKER CONTAINER RESOURCE USAGE"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "  Source: $(basename "$docker_file")"
        echo ""

        echo "  Peak CPU% per container:"
        awk -F',' 'NR>1 {
            gsub(/%/, "", $3)
            if($3+0 > max[$2]+0) {max[$2]=$3; ts[$2]=$1}
        } END {
            for(c in max) printf "    %-42s %6.1f%% at %s\n", c, max[c], ts[c]
        }' "$docker_file" | sort -t'%' -k2 -rn
        echo ""

        echo "  Peak Memory per container:"
        awk -F',' 'NR>1 {
            gsub(/%/, "", $6)
            if($6+0 > max[$2]+0) {max[$2]=$6; mem[$2]=$4}
        } END {
            for(c in max) printf "    %-42s %6.1f%% (%s)\n", c, max[c], mem[c]
        }' "$docker_file" | sort -t'%' -k2 -rn
        echo ""
    fi

    # --- 3. API Latency Summary ---
    api_file=$(ls -t "$LOG_DIR"/api-latency-*.csv 2>/dev/null | head -1)
    if [[ -n "$api_file" && -f "$api_file" ]]; then
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "  3. API LATENCY"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "  Source: $(basename "$api_file")"
        echo ""

        echo "  Average TTFB (Time to First Byte) per endpoint:"
        awk -F',' 'NR>1 {
            sum[$2]+=$7; count[$2]++
            if($7>max[$2]) {max[$2]=$7; max_ts[$2]=$1}
            if($10!="") errors[$2]++
        } END {
            for(e in sum) {
                avg = sum[e]/count[e]
                err = (e in errors) ? errors[e] : 0
                printf "    %-25s avg=%-8.1fms  peak=%-8.1fms  errors=%d  (n=%d)\n", e, avg, max[e], err, count[e]
            }
        }' "$api_file" | sort -t= -k2 -rn
        echo ""

        # Check for failures
        failures=$(awk -F',' 'NR>1 && $10!="" {print $2": "$10}' "$api_file" | sort | uniq -c | sort -rn | head -5)
        if [[ -n "$failures" ]]; then
            echo "  Errors detected:"
            echo "$failures" | sed 's/^/    /'
            echo ""
        fi
    fi

    # --- 4. Socket.IO Health Summary ---
    socket_file=$(ls -t "$LOG_DIR"/socketio-health-*.csv 2>/dev/null | head -1)
    if [[ -n "$socket_file" && -f "$socket_file" ]]; then
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "  4. SOCKET.IO & WEBSOCKET HEALTH"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "  Source: $(basename "$socket_file")"
        echo ""

        awk -F',' 'NR>1 {
            poll_sum+=$3; poll_n++
            if($3>poll_max) poll_max=$3
            if($6>max_clients) max_clients=$6
            if($9!="") errors++
        } END {
            if(poll_n>0) {
                printf "  Socket.IO Polling:\n"
                printf "    Average latency: %.1fms\n", poll_sum/poll_n
                printf "    Peak latency: %.1fms\n", poll_max
                printf "\n"
                printf "  Redis Socket:\n"
                printf "    Peak connected clients: %s\n", max_clients
                printf "\n"
                if(errors>0) printf "  ⚠ Errors encountered: %d\n", errors
            }
        }' "$socket_file"
        echo ""
    fi

    # --- 5. Backend Health Summary ---
    backend_file=$(ls -t "$LOG_DIR"/backend-health-*.csv 2>/dev/null | head -1)
    if [[ -n "$backend_file" && -f "$backend_file" ]]; then
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "  5. BACKEND SERVICE HEALTH"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "  Source: $(basename "$backend_file")"
        echo ""

        awk -F',' 'NR>1 {
            if($2>max_be_cpu) max_be_cpu=$2
            if($3>max_be_mem) max_be_mem=$3
            if($5>max_ce_cpu) max_ce_cpu=$5
            if($7>max_ct_cpu) max_ct_cpu=$7
            if($14>max_queue) max_queue=$14
            if($12>max_db_conn) max_db_conn=$12
            n++
        } END {
            if(n>0) {
                printf "  Peak Values:\n"
                printf "    Flask Backend:    CPU=%.1f%%  Mem=%s MB\n", max_be_cpu, max_be_mem
                printf "    Celery Extract:   CPU=%.1f%%\n", max_ce_cpu
                printf "    Celery Training:  CPU=%.1f%%\n", max_ct_cpu
                printf "    Celery Queue:     %d pending tasks\n", max_queue
                printf "    MySQL Connections: %d\n", max_db_conn
                printf "\n"
                if(max_be_cpu>80) printf "  ⚠ Backend CPU peaked above 80%%!\n"
                if(max_queue>5)   printf "  ⚠ Celery queue backed up (>5 tasks)!\n"
                if(max_db_conn>50) printf "  ⚠ High MySQL connection count!\n"
            }
        }' "$backend_file"
        echo ""
    fi

    # --- 6. Self-Monitor Summary ---
    self_file=$(ls -t "$LOG_DIR"/self-monitor-*.csv 2>/dev/null | head -1)
    if [[ -n "$self_file" && -f "$self_file" ]]; then
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "  6. MONITORING SCRIPTS SELF-RESOURCE USAGE"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "  Source: $(basename "$self_file")"
        echo ""

        awk -F',' '$2=="TOTAL" {
            if($4>max_cpu) max_cpu=$4
            if($6>max_rss) max_rss=$6
            n++
        } END {
            if(n>0) {
                printf "  Monitoring overhead:\n"
                printf "    Peak total CPU: %.1f%%\n", max_cpu
                printf "    Peak total RSS: %.1f MB\n", max_rss/1024
                printf "\n"
                if(max_cpu>5) printf "  ⚠ Monitoring scripts used >5%% CPU\n"
                else printf "  ✓ Monitoring overhead was acceptable (<5%% CPU)\n"
            }
        }' "$self_file"
        echo ""
    fi

    # --- 7. Nginx Analysis ---
    nginx_file=$(ls -t "$LOG_DIR"/nginx-connections-*.csv 2>/dev/null | head -1)
    if [[ -n "$nginx_file" && -f "$nginx_file" ]]; then
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "  7. NGINX CONNECTION STATS"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "  Source: $(basename "$nginx_file")"
        echo ""

        awk -F',' 'NR>1 {
            if($2>max_active) {max_active=$2; max_ts=$1}
            if($9>max_rps) max_rps=$9
            n++
        } END {
            if(n>0) {
                printf "  Peak active connections: %d at %s\n", max_active, max_ts
                printf "  Peak request rate: %.1f req/s\n", max_rps
            }
        }' "$nginx_file"
        echo ""
    fi

    # --- 8. Overall Assessment ---
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  OVERALL ASSESSMENT & RECOMMENDATIONS"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "  Common causes of frontend slowness with multiple users:"
    echo ""
    echo "  FRONTEND:"
    echo "  □ Missing gzip compression on nginx (check bundle analysis)"
    echo "  □ No cache headers for static assets (browsers re-download every time)"
    echo "  □ Large JS bundles not code-split (Plotly.js, Monaco Editor)"
    echo "  □ Too many DOM nodes causing slow renders"
    echo "  □ Long tasks blocking the main thread (check browser perf data)"
    echo "  □ Memory leaks from Socket.IO event listeners not cleaned up"
    echo ""
    echo "  BACKEND:"
    echo "  □ Slow API responses under load (Flask single-threaded?)"
    echo "  □ Celery queue backlog (extraction/training competing for resources)"
    echo "  □ MySQL connection exhaustion"
    echo "  □ Redis memory growth with many Socket.IO connections"
    echo ""
    echo "  INFRASTRUCTURE:"
    echo "  □ Host CPU/memory saturation"
    echo "  □ Disk I/O bottleneck (especially during feature extraction)"
    echo "  □ Network bandwidth (medical image transfers)"
    echo "  □ Traefik becoming a bottleneck (single reverse proxy)"
    echo ""
    echo "  Quick wins for Thursday's session:"
    echo "  1. Enable gzip in nginx (if not already done)"
    echo "  2. Add cache headers for /static/* paths (immutable content-hashed files)"
    echo "  3. Ensure no source maps are served in production"
    echo "  4. Monitor this report during the session and note peak times"
    echo "  5. If backend is the bottleneck, increase Celery worker concurrency"
    echo ""

    # Log file summary
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  LOG FILES"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    ls -lhS "$LOG_DIR"/*.csv "$LOG_DIR"/*.txt 2>/dev/null | awk '{printf "  %8s  %s\n", $5, $NF}' || echo "  No log files found."
    echo ""
    total_size=$(du -sh "$LOG_DIR" 2>/dev/null | awk '{print $1}')
    echo "  Total log directory size: ${total_size}"
    echo ""

} | tee "$REPORT"

echo ""
echo "Report saved to: ${REPORT}"
