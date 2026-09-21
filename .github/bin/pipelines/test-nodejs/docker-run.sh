#!/usr/bin/env bash

set -euo pipefail

source "$(dirname -- "${BASH_SOURCE[0]}")/environment.sh"

if [ "$#" -eq 0 ]; then
  echo "ERROR: npm script name is required."
  exit 1
fi

script_name="$1"
shift

docker run --rm "$TEST_IMAGE" npm run "$script_name" -- "$@"
