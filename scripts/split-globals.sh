#!/usr/bin/env bash
# Byte-safe split of globals.css into concern files. Boundaries are all on
# /* === */ section markers (no rule is cut). Line 1 (@import "tailwindcss")
# stays in globals.css; lines 2..EOF are distributed into styles/*.css and
# re-@imported IN THE SAME ORDER, so the concatenated content is identical to
# the original and the cascade is preserved.
set -euo pipefail
cd /opt/weered/apps/web
SRC=app/globals.css
DIR=app/styles

[ -f "$SRC" ] || { echo "no $SRC"; exit 1; }
LAST=$(wc -l < "$SRC")
echo "globals.css = $LAST lines"

# backup original (once)
[ -f app/globals.css.prebak ] || cp "$SRC" app/globals.css.prebak

mkdir -p "$DIR"

# slice "start end name"
slice () { sed -n "${1},${2}p" "$SRC" > "$DIR/$3"; echo "  $3  (lines $1-$2 -> $(wc -l < "$DIR/$3"))"; }

echo "slicing:"
slice 2     131   00-base.css
slice 132   483   10-themes.css
slice 484   1560  20-dock-rails.css
slice 1561  2358  30-broadcast-retint.css
slice 2359  3848  40-core-layout.css
slice 3849  4306  50-sections.css
slice 4307  7142  60-lobby-themes.css
slice 7143  7509  70-marketing-seo.css
slice 7510  "$LAST" 80-chrome-min.css

# sanity: concatenation of slices must equal lines 2..EOF of the original
cat "$DIR/00-base.css" "$DIR/10-themes.css" "$DIR/20-dock-rails.css" \
    "$DIR/30-broadcast-retint.css" "$DIR/40-core-layout.css" "$DIR/50-sections.css" \
    "$DIR/60-lobby-themes.css" "$DIR/70-marketing-seo.css" "$DIR/80-chrome-min.css" > /tmp/reassembled.css
sed -n "2,${LAST}p" "$SRC" > /tmp/original-tail.css
if diff -q /tmp/reassembled.css /tmp/original-tail.css >/dev/null; then
  echo "OK: slices reassemble to the original byte-for-byte"
else
  echo "FAIL: reassembly mismatch — NOT writing globals.css"; exit 1
fi

# write the new thin globals.css
cat > "$SRC" <<'EOF'
@import "tailwindcss";
/* globals.css split into concern files 2026-05-31 (byte-safe; same source
   order -> identical cascade). Original preserved at globals.css.prebak.
   Add new rules to the matching styles/*.css file, NOT here. */
@import "./styles/00-base.css";
@import "./styles/10-themes.css";
@import "./styles/20-dock-rails.css";
@import "./styles/30-broadcast-retint.css";
@import "./styles/40-core-layout.css";
@import "./styles/50-sections.css";
@import "./styles/60-lobby-themes.css";
@import "./styles/70-marketing-seo.css";
@import "./styles/80-chrome-min.css";
EOF
echo "wrote thin globals.css ($(wc -l < "$SRC") lines)"
