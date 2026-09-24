#!/usr/bin/env bash

set -euo pipefail

VERSION="$1"
CHANGELOG="$2"

{
  echo "## Release $VERSION"
  echo ""
  echo "$CHANGELOG"
} >> "$GITHUB_STEP_SUMMARY"
