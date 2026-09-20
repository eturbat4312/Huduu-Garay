#!/bin/sh
set -eu

current_lock="$(sha256sum package-lock.json | cut -d ' ' -f 1)"
installed_lock=""

if [ -f node_modules/.package-lock.sha256 ]; then
  installed_lock="$(cat node_modules/.package-lock.sha256)"
fi

if [ "$current_lock" != "$installed_lock" ]; then
  echo "package-lock.json changed; refreshing frontend dependencies"
  npm ci --no-audit --no-fund
  printf '%s\n' "$current_lock" > node_modules/.package-lock.sha256
fi

exec npm run dev -- -p 3000
