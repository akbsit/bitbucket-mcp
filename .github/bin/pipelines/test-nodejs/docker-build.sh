#!/usr/bin/env bash

set -euo pipefail

source "$(dirname -- "${BASH_SOURCE[0]}")/environment.sh"

docker build \
  --build-arg "NODE_VERSION=$NODE_VERSION" \
  --file "$TEST_DOCKERFILE" \
  --tag "$TEST_IMAGE" \
  "$PROJECT_DIRECTORY"
