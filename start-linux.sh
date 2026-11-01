#!/usr/bin/env bash
set -e

echo "========================================================"
echo "  Rockcliff 'B' Block Apartment Management System"
echo "========================================================"
echo ""

if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js is not installed."
    echo "Please install Node.js (v20+ or v24+) and try again."
    exit 1
fi

echo "Starting application server on port 5174..."
echo "Open http://localhost:5174 in your browser."
node server.mjs
