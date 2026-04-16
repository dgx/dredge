#!/bin/bash
# Sync Dredge source to Windows build directory
# Skips node_modules and dist (Windows has its own)

SRC="$(cd "$(dirname "$0")" && pwd)"
WIN_USER="$(cmd.exe /C "echo %USERNAME%" 2>/dev/null | tr -d '\r')"
DEST="/mnt/c/Users/$WIN_USER/dredge"

rsync -av --delete \
    --exclude node_modules \
    --exclude dist \
    --exclude dist-electron \
    "$SRC/" "$DEST/"

echo "Synced to $DEST"
