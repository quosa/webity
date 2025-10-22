#!/bin/bash
set -e

# Install Zig 0.15.1 for Netlify builds
# This script downloads and installs Zig if it's not already available

ZIG_VERSION="0.15.1"
ZIG_TARBALL="zig-linux-x86_64-${ZIG_VERSION}.tar.xz"
ZIG_URL="https://ziglang.org/download/${ZIG_VERSION}/${ZIG_TARBALL}"
INSTALL_DIR="${HOME}/.zig"

echo "Checking for Zig installation..."

# Check if Zig is already installed and has the correct version
if command -v zig &> /dev/null; then
    CURRENT_VERSION=$(zig version 2>&1 || echo "unknown")
    if [[ "$CURRENT_VERSION" == "$ZIG_VERSION" ]]; then
        echo "✓ Zig ${ZIG_VERSION} is already installed"
        exit 0
    else
        echo "Found Zig version: ${CURRENT_VERSION}, but need ${ZIG_VERSION}"
    fi
fi

echo "Installing Zig ${ZIG_VERSION}..."

# Create installation directory
mkdir -p "${INSTALL_DIR}"

# Download Zig
echo "Downloading ${ZIG_URL}..."
curl -fSL "${ZIG_URL}" -o "/tmp/${ZIG_TARBALL}"

# Extract Zig
echo "Extracting Zig..."
tar -xf "/tmp/${ZIG_TARBALL}" -C "${INSTALL_DIR}" --strip-components=1

# Clean up
rm "/tmp/${ZIG_TARBALL}"

# Add to PATH for current session
export PATH="${INSTALL_DIR}:${PATH}"

# Verify installation
if "${INSTALL_DIR}/zig" version; then
    echo "✓ Zig ${ZIG_VERSION} installed successfully to ${INSTALL_DIR}"
    echo "  Add to PATH: export PATH=\"${INSTALL_DIR}:\${PATH}\""
else
    echo "✗ Zig installation failed"
    exit 1
fi
