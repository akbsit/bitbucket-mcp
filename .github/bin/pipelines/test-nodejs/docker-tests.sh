#!/usr/bin/env bash

set -euo pipefail

source "$(dirname -- "${BASH_SOURCE[0]}")/environment.sh"

"$PIPELINE_DIRECTORY/docker-run.sh" "$TEST_SCRIPT"
