#!/usr/bin/env bash

set -euo pipefail

source "$(dirname -- "${BASH_SOURCE[0]}")/environment.sh"

coverage_directory="$PROJECT_DIRECTORY/$TEST_COVERAGE_DIRECTORY"
summary_file="$coverage_directory/coverage-summary.json"

if [ ! -f "$summary_file" ]; then
  echo "Coverage summary is unavailable; skipping the pull request comment."
  exit 0
fi

: "${GITHUB_TOKEN:?GITHUB_TOKEN is required.}"
: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required.}"
: "${PR_NUMBER:?PR_NUMBER is required.}"

docker run --rm \
  --env "GITHUB_API_URL=${GITHUB_API_URL:-https://api.github.com}" \
  --env "GITHUB_API_VERSION=${GITHUB_API_VERSION:-2022-11-28}" \
  --env "GITHUB_REPOSITORY=$GITHUB_REPOSITORY" \
  --env "GITHUB_TOKEN=$GITHUB_TOKEN" \
  --env "MIN_COVERAGE=$MIN_COVERAGE" \
  --env "PR_NUMBER=$PR_NUMBER" \
  --volume "$coverage_directory:/coverage:ro" \
  "$TEST_IMAGE" \
  node .github/bin/pipelines/test-nodejs/comment-coverage.cjs \
  /coverage/coverage-summary.json
