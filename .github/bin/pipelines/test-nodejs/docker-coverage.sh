#!/usr/bin/env bash

set -euo pipefail

source "$(dirname -- "${BASH_SOURCE[0]}")/environment.sh"

coverage_directory="$PROJECT_DIRECTORY/$TEST_COVERAGE_DIRECTORY"
summary_file="$coverage_directory/coverage-summary.json"
container_id="$(
  docker create \
    "$TEST_IMAGE" \
    npm run "$COVERAGE_SCRIPT"
)"

cleanup() {
  docker rm --force "$container_id" >/dev/null 2>&1 || true
}

trap cleanup EXIT

mkdir -p "$coverage_directory"

docker start --attach "$container_id"
docker cp \
  "$container_id:$TEST_CONTAINER_WORKDIR/coverage/." \
  "$coverage_directory"

if [ ! -f "$summary_file" ]; then
  echo "ERROR: $summary_file was not generated."
  exit 1
fi

docker run --rm \
  --env "MIN_COVERAGE=$MIN_COVERAGE" \
  --volume "$coverage_directory:/coverage:ro" \
  "$TEST_IMAGE" \
  node .github/bin/pipelines/test-nodejs/check-coverage.cjs \
  /coverage/coverage-summary.json
