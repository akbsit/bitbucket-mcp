#!/usr/bin/env bash

set -euo pipefail

PIPELINE_DIRECTORY="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIRECTORY="$(cd -- "$PIPELINE_DIRECTORY/../../../.." && pwd)"

repository_name="${GITHUB_REPOSITORY:-}"
repository_name="${repository_name##*/}"
if [ -z "$repository_name" ]; then
  repository_name="$(basename -- "$PROJECT_DIRECTORY")"
fi
repository_name="$(printf '%s' "$repository_name" | tr '[:upper:]' '[:lower:]' | tr -c 'a-z0-9_.-' '-')"

NODE_VERSION="${NODE_VERSION:-22.13.0}"
TEST_IMAGE_NAME="${TEST_IMAGE_NAME:-${repository_name}-test}"
TEST_IMAGE_TAG="${TEST_IMAGE_TAG:-latest}"
TEST_IMAGE="${TEST_IMAGE_NAME}:${TEST_IMAGE_TAG}"
TEST_DOCKERFILE="${TEST_DOCKERFILE:-$PIPELINE_DIRECTORY/Dockerfile}"
TEST_CONTAINER_WORKDIR="${TEST_CONTAINER_WORKDIR:-/app}"
TEST_COVERAGE_DIRECTORY="${TEST_COVERAGE_DIRECTORY:-coverage}"
TEST_SCRIPT="${TEST_SCRIPT:-test}"
COVERAGE_SCRIPT="${COVERAGE_SCRIPT:-test:coverage}"
MIN_COVERAGE="${MIN_COVERAGE:-80}"

export COVERAGE_SCRIPT
export MIN_COVERAGE
export NODE_VERSION
export PIPELINE_DIRECTORY
export PROJECT_DIRECTORY
export TEST_CONTAINER_WORKDIR
export TEST_COVERAGE_DIRECTORY
export TEST_DOCKERFILE
export TEST_IMAGE
export TEST_IMAGE_NAME
export TEST_IMAGE_TAG
export TEST_SCRIPT
