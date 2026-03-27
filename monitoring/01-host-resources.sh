#!/usr/bin/env bash
###############################################################################
# 01-host-resources.sh – Lightweight host-level resource monitor
#
# Samples CPU, memory, swap, disk I/O, and network every INTERVAL seconds.
# Writes CSV to logs/host-resources-<timestamp>.csv for later analysis.
#
# Resource cost: ~0.2 % CPU per sample (one /proc read + awk).
###############################################################################
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="${SCRIPT_DIR}/logs"
INTERVAL="${1:-10}"        # seconds between samples (default 10)
OUTFILE="${LOG_DIR}/host-resources-$(date +%Y%m%d_%H%M%S).csv"

mkdir -p "$LOG_DIR"

header="timestamp,cpu_user%,cpu_sys%,cpu_iowait%,cpu_idle%,mem_total_mb,mem_used_mb,mem_available_mb,mem_used%,swap_total_mb,swap_used_mb,load_1m,load_5m,load_15m,disk_read_kb/s,disk_write_kb/s,net_rx_kb/s,net_tx_kb/s"
echo "$header" > "$OUTFILE"

echo "=== Host Resource Monitor ==="
echo "  Interval : ${INTERVAL}s"
echo "  Output   : ${OUTFILE}"
echo "  Press Ctrl+C to stop."
echo ""

# Previous disk / net counters for delta calculation
prev_disk_read=0
prev_disk_write=0
prev_net_rx=0
prev_net_tx=0
first_sample=1

while true; do
    ts=$(date '+%Y-%m-%d %H:%M:%S')

    # --- CPU (from /proc/stat snapshot delta over 1s) ---
    read_cpu() {
        awk '/^cpu / {print $2,$3,$4,$5,$6,$7,$8}' /proc/stat
    }
    cpu1=$(read_cpu)
    sleep 1
    cpu2=$(read_cpu)

    cpu_line=$(echo "$cpu1" "$cpu2" | awk '{
        u1=$1+$2; s1=$3; w1=$5; i1=$4; t1=u1+s1+$4+$5+$6+$7
        u2=$8+$9; s2=$10; w2=$12; i2=$11; t2=u2+s2+$11+$12+$13+$14
        dt=t2-t1; if(dt==0) dt=1
        printf "%.1f,%.1f,%.1f,%.1f", (u2-u1)/dt*100, (s2-s1)/dt*100, (w2-w1)/dt*100, (i2-i1)/dt*100
    }')

    # --- Memory ---
    mem_line=$(awk '
        /^MemTotal:/     {total=$2}
        /^MemAvailable:/ {avail=$2}
        /^SwapTotal:/    {stot=$2}
        /^SwapFree:/     {sfree=$2}
        END {
            used=total-avail
            pct=(total>0) ? used/total*100 : 0
            printf "%.0f,%.0f,%.0f,%.1f,%.0f,%.0f", total/1024,used/1024,avail/1024,pct,stot/1024,(stot-sfree)/1024
        }' /proc/meminfo)

    # --- Load average ---
    load_line=$(awk '{printf "%s,%s,%s",$1,$2,$3}' /proc/loadavg)

    # --- Disk I/O (aggregate all block devices, sectors -> KB) ---
    disk_read=$(awk '($3 !~ /[0-9]$/ && $3 !~ /^loop/ && $3 !~ /^ram/) {r+=$6} END{printf "%.0f",r/2}' /proc/diskstats 2>/dev/null || echo 0)
    disk_write=$(awk '($3 !~ /[0-9]$/ && $3 !~ /^loop/ && $3 !~ /^ram/) {w+=$10} END{printf "%.0f",w/2}' /proc/diskstats 2>/dev/null || echo 0)

    if [[ $first_sample -eq 1 ]]; then
        disk_r_rate=0
        disk_w_rate=0
    else
        disk_r_rate=$(( (disk_read  - prev_disk_read)  / INTERVAL ))
        disk_w_rate=$(( (disk_write - prev_disk_write) / INTERVAL ))
    fi
    prev_disk_read=$disk_read
    prev_disk_write=$disk_write

    # --- Network I/O (aggregate all non-lo interfaces, bytes -> KB) ---
    net_rx=$(awk 'NR>2 && $1 !~ /lo:/ {rx+=$2} END{printf "%.0f",rx/1024}' /proc/net/dev 2>/dev/null || echo 0)
    net_tx=$(awk 'NR>2 && $1 !~ /lo:/ {tx+=$10} END{printf "%.0f",tx/1024}' /proc/net/dev 2>/dev/null || echo 0)

    if [[ $first_sample -eq 1 ]]; then
        net_rx_rate=0
        net_tx_rate=0
    else
        net_rx_rate=$(( (net_rx - prev_net_rx) / INTERVAL ))
        net_tx_rate=$(( (net_tx - prev_net_tx) / INTERVAL ))
    fi
    prev_net_rx=$net_rx
    prev_net_tx=$net_tx

    first_sample=0

    line="${ts},${cpu_line},${mem_line},${load_line},${disk_r_rate},${disk_w_rate},${net_rx_rate},${net_tx_rate}"
    echo "$line" >> "$OUTFILE"

    # Compact terminal output
    echo "[${ts}] CPU usr=$(echo "$cpu_line"|cut -d, -f1)% iow=$(echo "$cpu_line"|cut -d, -f3)% | Mem=$(echo "$mem_line"|cut -d, -f4)% | Load=$(echo "$load_line"|cut -d, -f1) | Disk R/W=${disk_r_rate}/${disk_w_rate} KB/s | Net RX/TX=${net_rx_rate}/${net_tx_rate} KB/s"

    # Sleep remaining interval (we already spent ~1s on CPU sampling)
    remaining=$((INTERVAL - 1))
    [[ $remaining -gt 0 ]] && sleep "$remaining"
done
