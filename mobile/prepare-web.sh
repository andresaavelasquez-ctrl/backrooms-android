#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ASSETS_DIR="$SCRIPT_DIR/app/src/main/assets"
GAME_DIR="$ASSETS_DIR/game"
UPSTREAM_COMMIT="351731ca6746b5a6cc5d8d57e4093fb6617f96ad"

if [[ "${FORCE_DOWNLOAD:-0}" == "1" || ! -f "$GAME_DIR/index.html" ]]; then
  TMP="$(mktemp -d)"
  trap 'rm -rf "$TMP"' EXIT
  echo "Descargando fuente fijada en $UPSTREAM_COMMIT…"
  curl --fail --location --retry 3 \
    "https://codeload.github.com/AgenteMaxo/backrooms-noclip/zip/$UPSTREAM_COMMIT" \
    --output "$TMP/source.zip"
  unzip -q "$TMP/source.zip" -d "$TMP/unpacked"
  SOURCE_ROOT="$(find "$TMP/unpacked" -mindepth 1 -maxdepth 1 -type d | head -n 1)"
  rm -rf "$GAME_DIR"
  mkdir -p "$ASSETS_DIR"
  cp -a "$SOURCE_ROOT/game" "$GAME_DIR"
  cp "$SOURCE_ROOT/LICENSE.md" "$ASSETS_DIR/UPSTREAM-LICENSE.md"
  if [[ -n "${UPSTREAM_TEST_DIR:-}" ]]; then
    rm -rf "$UPSTREAM_TEST_DIR"
    cp -a "$SOURCE_ROOT" "$UPSTREAM_TEST_DIR"
  fi
fi

cp "$SCRIPT_DIR/native-mobile.js" "$GAME_DIR/js/native-mobile.js"
cp "$SCRIPT_DIR/native-mobile.css" "$GAME_DIR/css/native-mobile.css"

python3 - "$GAME_DIR/index.html" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
text = path.read_text(encoding="utf-8")
css = '<link rel="stylesheet" href="css/native-mobile.css?v=1">'
js = '<script src="js/native-mobile.js?v=1"></script>'

if css not in text:
    anchor = '<link rel="stylesheet" href="css/title-interface.css?v=294">'
    if anchor not in text:
        raise SystemExit("No se encontró el punto de inserción CSS")
    text = text.replace(anchor, anchor + "\n" + css, 1)

if js not in text:
    anchor = '<script src="js/net/local.js?v=294"></script>'
    if anchor not in text:
        raise SystemExit("No se encontró el punto de inserción JS")
    text = text.replace(anchor, anchor + "\n" + js, 1)

path.write_text(text, encoding="utf-8")
PY

echo "Web offline preparado en $GAME_DIR"
