#!/usr/bin/env bash
# Regenerate the subset fonts served by the site from the full faces.
# Manual tooling, like download-fonts.sh — not a build step. Run after
# replacing a source font, then bump the .subN suffix (assets are
# immutable-cached, so changed bytes need a new filename).
# Requires: pip install fonttools brotli
set -euo pipefail
cd "$(dirname "$0")/assets/fonts"
# Latin basic + en/em dash, curly quotes, ellipsis. The arrow (U+2192) is
# deliberately absent: neither source font has it; the system fallback
# renders it today and continues to.
RANGE="U+0020-007E,U+2013,U+2014,U+2018,U+2019,U+201C,U+201D,U+2026,U+00B7"
for f in DMSans-Regular DMSans-Medium Newsreader-Regular Newsreader-Bold; do
  pyftsubset "$f.woff2" \
    --flavor=woff2 \
    --unicodes="$RANGE" \
    --layout-features=kern,liga,calt \
    --output-file="$f.sub2.woff2"
  echo "$f: $(wc -c < "$f.woff2") -> $(wc -c < "$f.sub2.woff2") bytes"
done
