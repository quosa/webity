#!/bin/bash
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

echo "==> Installing root npm dependencies"
npm install

ZIG_VERSION="0.16.0"
ZIG_INSTALL_DIR="${HOME}/.zig"

echo "==> Checking Zig ${ZIG_VERSION} installation"
if ! (command -v zig &> /dev/null && [[ "$(zig version 2>&1)" == "$ZIG_VERSION" ]]); then
  echo "Installing Zig ${ZIG_VERSION}..."
  mkdir -p "${ZIG_INSTALL_DIR}"
  ZIG_TARBALL="zig-x86_64-linux-${ZIG_VERSION}.tar.xz"
  curl -fSL "https://ziglang.org/download/${ZIG_VERSION}/${ZIG_TARBALL}" -o "/tmp/${ZIG_TARBALL}"
  tar -xf "/tmp/${ZIG_TARBALL}" -C "${ZIG_INSTALL_DIR}" --strip-components=1
  rm "/tmp/${ZIG_TARBALL}"
fi
export PATH="${ZIG_INSTALL_DIR}:${PATH}"
zig version

if ! grep -q "${ZIG_INSTALL_DIR}" "$CLAUDE_ENV_FILE" 2>/dev/null; then
  echo "export PATH=\"${ZIG_INSTALL_DIR}:\$PATH\"" >> "$CLAUDE_ENV_FILE"
fi

echo "==> Building WASM physics engine"
npm run build:wasm

echo "==> Installing browser-tests (Playwright) dependencies"
cd browser-tests
npm install
cd ..

# Chromium is preinstalled in this image; skip Playwright's own download and
# reuse the existing browser cache instead of fetching a fresh copy.
if ! grep -q "PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD" "$CLAUDE_ENV_FILE" 2>/dev/null; then
  {
    echo "export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1"
    echo "export PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers"
  } >> "$CLAUDE_ENV_FILE"
fi

echo "==> Session start hook complete"
