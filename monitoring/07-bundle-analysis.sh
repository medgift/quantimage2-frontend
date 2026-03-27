#!/usr/bin/env bash
###############################################################################
# 07-bundle-analysis.sh – Static asset & bundle size analysis
#
# One-shot analysis (not a continuous monitor). Examines:
#   - JS/CSS bundle sizes (individual and total)
#   - Gzip compression ratios
#   - Cache header configuration
#   - Number of chunks and code-splitting effectiveness
#   - Largest assets
#   - Source map presence
#
# Resource cost: minimal (runs once, reads files from container).
###############################################################################
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="${SCRIPT_DIR}/logs"
OUTFILE="${LOG_DIR}/bundle-analysis-$(date +%Y%m%d_%H%M%S).txt"
CONTAINER="quantimage2-frontend-web-1"

mkdir -p "$LOG_DIR"

echo "=== Bundle & Static Asset Analysis ==="
echo "  Container: ${CONTAINER}"
echo "  Output   : ${OUTFILE}"
echo ""

# Check container
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
    CONTAINER=$(docker ps --format '{{.Names}}' | grep -i "quantimage2.*frontend\|quantimage2.*web" | head -1)
    if [[ -z "$CONTAINER" ]]; then
        echo "ERROR: No frontend container found."
        exit 1
    fi
fi

{
    echo "╔══════════════════════════════════════════════════════════════════════╗"
    echo "║            QuantImage v2 – Frontend Bundle Analysis                ║"
    echo "║            $(date '+%Y-%m-%d %H:%M:%S')                                      ║"
    echo "╚══════════════════════════════════════════════════════════════════════╝"
    echo ""

    # --- 1. JS Bundles ---
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  JAVASCRIPT BUNDLES"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""

    docker exec "$CONTAINER" sh -c '
        cd /usr/share/nginx/html/static/js 2>/dev/null || exit 0
        echo "  File                                                    Size      Gzip Est."
        echo "  ────────────────────────────────────────────────────────────────────────────"
        for f in *.js; do
            if [[ -f "$f" ]]; then
                size=$(wc -c < "$f")
                size_kb=$(awk "BEGIN{printf \"%.1f\", $size/1024}")
                # Estimate gzip size (wc of gzip output)
                gz_size=$(gzip -c "$f" 2>/dev/null | wc -c)
                gz_kb=$(awk "BEGIN{printf \"%.1f\", $gz_size/1024}")
                ratio=$(awk "BEGIN{printf \"%.0f\", ($size>0) ? (1-$gz_size/$size)*100 : 0}")
                printf "  %-55s %8s KB  %8s KB (-%s%%)\n" "$f" "$size_kb" "$gz_kb" "$ratio"
            fi
        done
        echo ""
        total=$(du -sb . 2>/dev/null | awk "{print \$1}")
        total_kb=$(awk "BEGIN{printf \"%.1f\", $total/1024}")
        total_mb=$(awk "BEGIN{printf \"%.2f\", $total/1048576}")
        echo "  Total JS: ${total_kb} KB (${total_mb} MB)"
        echo "  JS chunk count: $(ls -1 *.js 2>/dev/null | wc -l)"
    ' 2>/dev/null || echo "  (Could not access JS files)"

    echo ""

    # --- 2. CSS Bundles ---
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  CSS BUNDLES"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""

    docker exec "$CONTAINER" sh -c '
        cd /usr/share/nginx/html/static/css 2>/dev/null || exit 0
        for f in *.css; do
            if [[ -f "$f" ]]; then
                size=$(wc -c < "$f")
                size_kb=$(awk "BEGIN{printf \"%.1f\", $size/1024}")
                gz_size=$(gzip -c "$f" 2>/dev/null | wc -c)
                gz_kb=$(awk "BEGIN{printf \"%.1f\", $gz_size/1024}")
                printf "  %-55s %8s KB  (gzip: %s KB)\n" "$f" "$size_kb" "$gz_kb"
            fi
        done
        echo ""
        total=$(du -sb . 2>/dev/null | awk "{print \$1}")
        total_kb=$(awk "BEGIN{printf \"%.1f\", $total/1024}")
        echo "  Total CSS: ${total_kb} KB"
    ' 2>/dev/null || echo "  (Could not access CSS files)"

    echo ""

    # --- 3. Media/Font Assets ---
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  MEDIA & FONT ASSETS"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""

    docker exec "$CONTAINER" sh -c '
        cd /usr/share/nginx/html/static/media 2>/dev/null || {
            echo "  (No media directory)"
            exit 0
        }
        total=0
        count=0
        for f in *; do
            if [[ -f "$f" ]]; then
                size=$(wc -c < "$f")
                total=$((total + size))
                count=$((count + 1))
                size_kb=$(awk "BEGIN{printf \"%.1f\", $size/1024}")
                if [ "$size" -gt 102400 ]; then
                    printf "  ⚠ LARGE: %-50s %8s KB\n" "$f" "$size_kb"
                fi
            fi
        done
        total_kb=$(awk "BEGIN{printf \"%.1f\", $total/1024}")
        echo ""
        echo "  Total media files: ${count}, Total size: ${total_kb} KB"
    ' 2>/dev/null || echo "  (Could not access media files)"

    echo ""

    # --- 4. Total Build Size ---
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  TOTAL BUILD SIZE"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""

    docker exec "$CONTAINER" sh -c '
        cd /usr/share/nginx/html 2>/dev/null || exit 0
        echo "  Directory breakdown:"
        du -sh static/js static/css static/media workers . 2>/dev/null | while read size dir; do
            printf "    %-30s %s\n" "$dir" "$size"
        done
    ' 2>/dev/null

    echo ""

    # --- 5. Source Maps ---
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  SOURCE MAPS"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""

    map_count=$(docker exec "$CONTAINER" sh -c 'find /usr/share/nginx/html -name "*.map" 2>/dev/null | wc -l' 2>/dev/null || echo 0)
    if [[ "$map_count" -gt 0 ]]; then
        echo "  ⚠ WARNING: ${map_count} source map files found in production build!"
        echo "  Source maps expose source code and increase transfer size."
        docker exec "$CONTAINER" sh -c '
            find /usr/share/nginx/html -name "*.map" -exec ls -lh {} \; 2>/dev/null | awk "{printf \"    %s %s\n\", \$5, \$NF}"
        ' 2>/dev/null
    else
        echo "  ✓ No source maps in production build (good)"
    fi

    echo ""

    # --- 6. Nginx Configuration Analysis ---
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  NGINX CONFIGURATION"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""

    nginx_conf=$(docker exec "$CONTAINER" cat /etc/nginx/conf.d/default.conf 2>/dev/null || echo "")
    echo "  Current config:"
    echo "$nginx_conf" | sed 's/^/    /'
    echo ""

    # Check for performance optimizations
    echo "  Performance checklist:"
    if echo "$nginx_conf" | grep -q "gzip"; then
        echo "    ✓ Gzip compression configured"
    else
        echo "    ⚠ Gzip compression NOT configured (significant performance impact!)"
    fi
    if echo "$nginx_conf" | grep -q "expires\|cache-control\|Cache-Control"; then
        echo "    ✓ Cache headers configured"
    else
        echo "    ⚠ Cache headers NOT configured (browsers will re-download static assets)"
    fi
    if echo "$nginx_conf" | grep -q "worker_connections\|keepalive"; then
        echo "    ✓ Connection tuning found"
    else
        echo "    ⚠ No connection tuning (keepalive, worker_connections)"
    fi
    if echo "$nginx_conf" | grep -q "http2\|HTTP/2"; then
        echo "    ✓ HTTP/2 enabled"
    else
        echo "    ⚠ HTTP/2 not configured in nginx (may be handled by Traefik)"
    fi

    echo ""

    # --- 7. Cache Header Check (live) ---
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  CACHE HEADERS (live check via Traefik)"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""

    TRAEFIK_HOST=$(docker inspect quantimage2-frontend-web-1 --format '{{range $k,$v := .Config.Labels}}{{if eq $k "traefik.http.routers.quantimage2-frontend-web.rule"}}{{$v}}{{end}}{{end}}' 2>/dev/null | sed -n 's/.*Host(`\([^`]*\)`).*/\1/p' || echo "")

    if [[ -n "$TRAEFIK_HOST" ]]; then
        check_url="https://${TRAEFIK_HOST}"
        echo "  Checking: ${check_url}"
        echo ""

        for path in "/" "/manifest.json"; do
            echo "  ${path}:"
            headers=$(curl -sk -I "${check_url}${path}" 2>/dev/null | grep -iE "cache-control|etag|expires|content-encoding|vary|content-type" || echo "  (no caching headers)")
            echo "$headers" | sed 's/^/    /'
            echo ""
        done
    else
        echo "  (Could not determine Traefik URL – skipping live header check)"
    fi

    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  RECOMMENDATIONS"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "  Based on common frontend performance issues:"
    echo ""
    echo "  1. If JS bundle > 500 KB (gzipped), consider code-splitting"
    echo "  2. If no gzip: enable in nginx config (30-70% size reduction)"
    echo "  3. If no cache headers: add for static assets (immutable hashes)"
    echo "  4. If source maps present: remove for production"
    echo "  5. If large media files: consider compression or CDN"
    echo "  6. Check that Plotly.js is loaded on-demand (it's ~3MB unminified)"
    echo "  7. Monaco Editor should be lazy-loaded (admin-only feature)"
    echo ""

} | tee "$OUTFILE"

echo ""
echo "Analysis saved to: ${OUTFILE}"
