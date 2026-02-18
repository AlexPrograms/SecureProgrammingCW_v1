#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

if [[ -x ".venv/bin/python" ]] && .venv/bin/python -c "import bandit" >/dev/null 2>&1; then
  .venv/bin/python -m bandit -r app
else
  python3 -m bandit -r app
fi
