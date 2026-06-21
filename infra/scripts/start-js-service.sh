#!/bin/sh
set -eu

PACKAGE_NAME="${1:?Package name is required}"
shift

WORKSPACE_ROOT="/workspace"
LOCK_DIR="${WORKSPACE_ROOT}/node_modules/.install-lock"
MARKER_FILE="${WORKSPACE_ROOT}/node_modules/.workspace-ready"

compute_fingerprint() {
  node <<'NODE'
const fs = require('node:fs');
const crypto = require('node:crypto');

const files = [
  '/workspace/package.json',
  '/workspace/pnpm-workspace.yaml',
  '/workspace/pnpm-lock.yaml',
  '/workspace/apps/web/package.json',
  '/workspace/apps/api/package.json',
  '/workspace/packages/contracts/package.json',
  '/workspace/packages/config/package.json',
  '/workspace/packages/tsconfig/package.json',
  '/workspace/packages/eslint-config/package.json',
];

const hash = crypto.createHash('sha256');

for (const file of files) {
  hash.update(file);
  hash.update('\0');
  hash.update(fs.readFileSync(file));
  hash.update('\0');
}

process.stdout.write(hash.digest('hex'));
NODE
}

needs_install() {
  if [ ! -f "${MARKER_FILE}" ]; then
    return 0
  fi

  CURRENT_FINGERPRINT="$(compute_fingerprint)"
  STORED_FINGERPRINT="$(cat "${MARKER_FILE}")"

  [ "${CURRENT_FINGERPRINT}" != "${STORED_FINGERPRINT}" ]
}

mkdir -p "${WORKSPACE_ROOT}/node_modules"

while ! mkdir "${LOCK_DIR}" 2>/dev/null; do
  echo "Waiting for pnpm workspace dependency lock..."
  sleep 2
done

cleanup() {
  rmdir "${LOCK_DIR}" >/dev/null 2>&1 || true
}

trap cleanup EXIT

if needs_install; then
  echo "Installing workspace dependencies..."
  pnpm install --no-frozen-lockfile
  compute_fingerprint > "${MARKER_FILE}"
else
  echo "Using cached workspace dependencies."
fi

if [ "${PACKAGE_NAME}" = "@ecobairro/api" ]; then
  echo "Generating Prisma client..."
  pnpm --dir "${WORKSPACE_ROOT}/apps/api" prisma:generate
fi

cleanup
trap - EXIT

exec pnpm --filter "${PACKAGE_NAME}" "$@"
