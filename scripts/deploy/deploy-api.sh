#!/usr/bin/env bash

set -euo pipefail

readonly artifact=${1:?Usage: deploy-api.sh <artifact>}
readonly service=cyberblade-api
readonly target=/usr/local/bin/cyberblade-api
readonly staged=${target}.next
readonly backup=${target}.previous

if [[ ! -f "$artifact" ]]; then
  echo "API artifact not found: $artifact" >&2
  exit 1
fi

rollback() {
  echo "API health check failed; restoring previous release." >&2
  sudo install -o root -g root -m 0755 "$backup" "$target"
  sudo systemctl restart "$service"
  curl --fail --silent --show-error --retry 12 --retry-connrefused \
    --retry-delay 1 http://127.0.0.1:8787/health > /dev/null
}

sudo install -o root -g root -m 0755 "$target" "$backup"
sudo install -o root -g root -m 0755 "$artifact" "$staged"
sudo mv "$staged" "$target"

if ! sudo systemctl restart "$service"; then
  rollback
  exit 1
fi

if ! curl --fail --silent --show-error --retry 12 --retry-connrefused \
  --retry-delay 1 http://127.0.0.1:8787/health > /dev/null; then
  rollback
  exit 1
fi

rm -f "$artifact" /tmp/deploy-api.sh
echo "API deployment passed its local health check."
