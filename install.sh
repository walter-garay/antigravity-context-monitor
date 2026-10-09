#!/usr/bin/env bash
# Antigravity Context Window Monitor - macOS & Linux Installer / Updater
# Usage:
# curl -fsSL https://raw.githubusercontent.com/walter-garay/antigravity-context-monitor/main/install.sh | bash

set -e

echo -e "\033[36m=========================================================\033[0m"
echo -e "\033[36m  🚀 Antigravity Context Window Monitor Installer / Updater\033[0m"
echo -e "\033[36m=========================================================\033[0m"

PLUGIN_DIR="${HOME}/.gemini/config/plugins/context-monitor"
echo -e "📁 Target: ${PLUGIN_DIR}"

mkdir -p "${PLUGIN_DIR}/assets"
mkdir -p "${PLUGIN_DIR}/sidecars/panel"

RAW_BASE="https://raw.githubusercontent.com/walter-garay/antigravity-context-monitor/main"

FILES=(
  "plugin.json"
  "assets/logo.svg"
  "sidecars/panel/sidecar.json"
  "sidecars/panel/package.json"
  "sidecars/panel/main.mjs"
  "sidecars/panel/index.html"
  "sidecars/panel/app.js"
  "sidecars/panel/styles.css"
)

echo -e "\033[33m⬇️ Downloading latest components...\033[0m"
for f in "${FILES[@]}"; do
  dest="${PLUGIN_DIR}/${f}"
  mkdir -p "$(dirname "${dest}")"
  curl -fsSL "${RAW_BASE}/${f}?_t=$(date +%s)" -o "${dest}"
  echo -e "  \033[32m✓ ${f}\033[0m"
done

echo -e "\n\033[36m🎉 Installation / Update completed!\033[0m"
echo -e "👉 Open Antigravity Desktop -> Open any conversation -> Click ⋮ (top right) -> Extensions -> Context Monitor."
