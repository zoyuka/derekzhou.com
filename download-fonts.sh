#!/usr/bin/env bash
# Download self-hosted WOFF2 fonts for derekzhou.com
# Usage: bash download-fonts.sh

set -euo pipefail

FONT_DIR="assets/fonts"
mkdir -p "$FONT_DIR"

GOOGLE_FONTS_API="https://fonts.googleapis.com/css2"
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

download_font() {
  local family="$1"
  local weights="$2"
  local output_prefix="$3"

  echo "Fetching CSS for $family..."
  css=$(curl -s -A "$UA" "${GOOGLE_FONTS_API}?family=${family}:wght@${weights}&display=swap")

  echo "$css" | grep -oP 'https://[^)]+\.woff2' | while read -r url; do
    # Extract weight from the CSS context
    filename=$(echo "$url" | grep -oP '[^/]+$')
    echo "  Downloading $filename..."
    curl -s -o "${FONT_DIR}/${filename}" "$url"
  done
}

# Download Newsreader (serif — name/bio)
echo "--- Newsreader ---"
css=$(curl -s -A "$UA" "${GOOGLE_FONTS_API}?family=Newsreader:wght@400;700&display=swap")
echo "$css" | grep -oP 'https://[^)]+\.woff2' | while read -r url; do
  # Determine weight from surrounding CSS
  filename=$(echo "$url" | grep -oP '[^/]+$')
  echo "  Downloading $filename..."
  curl -s -o "${FONT_DIR}/${filename}" "$url"
done

# Rename to predictable names (Google Fonts uses hashed filenames)
# Find the downloaded files and rename based on content
echo "Renaming Newsreader fonts..."
newsreader_files=("${FONT_DIR}"/*)
# We'll re-download with explicit names instead

rm -f "${FONT_DIR}"/*

# Newsreader Regular (latin subset)
echo "Downloading Newsreader Regular..."
curl -s -A "$UA" \
  "https://fonts.gstatic.com/s/newsreader/v21/cY9qfjOCX1hbuyalUrK439vogqC9yFZCYg7oRZaLP4obnf7fTXglsMyoTe-N.woff2" \
  -o "${FONT_DIR}/Newsreader-Regular.woff2" || true

echo "Downloading Newsreader Bold..."
curl -s -A "$UA" \
  "https://fonts.gstatic.com/s/newsreader/v21/cY9qfjOCX1hbuyalUrK439vogqC9yFZCYg7oRZaLP4obnf7fTXglsMz1Te-N.woff2" \
  -o "${FONT_DIR}/Newsreader-Bold.woff2" || true

# DM Sans Regular
echo "Downloading DM Sans Regular..."
curl -s -A "$UA" \
  "https://fonts.gstatic.com/s/dmsans/v15/rP2Hp2ywxg089UriCZOIHTWEBlw.woff2" \
  -o "${FONT_DIR}/DMSans-Regular.woff2" || true

# DM Sans Medium
echo "Downloading DM Sans Medium..."
curl -s -A "$UA" \
  "https://fonts.gstatic.com/s/dmsans/v15/rP2Hp2ywxg089UriCZOIHTWEBlw.woff2" \
  -o "${FONT_DIR}/DMSans-Medium.woff2" || true

# Verify downloads
echo ""
echo "--- Results ---"
for f in Newsreader-Regular.woff2 Newsreader-Bold.woff2 DMSans-Regular.woff2 DMSans-Medium.woff2; do
  path="${FONT_DIR}/${f}"
  if [ -f "$path" ] && [ -s "$path" ]; then
    size=$(wc -c < "$path")
    echo "OK: $f (${size} bytes)"
  else
    echo "WARN: $f is missing or empty — download manually from Google Fonts"
    echo "      https://fonts.google.com/specimen/Newsreader"
    echo "      https://fonts.google.com/specimen/DM+Sans"
  fi
done

echo ""
echo "If any downloads failed (Google Fonts URLs change over time):"
echo "  1. Visit https://fonts.google.com"
echo "  2. Download Newsreader (400, 700) and DM Sans (400, 500)"
echo "  3. Convert to WOFF2 and place in ${FONT_DIR}/"
echo "  4. Use the filenames: Newsreader-Regular.woff2, Newsreader-Bold.woff2,"
echo "     DMSans-Regular.woff2, DMSans-Medium.woff2"
