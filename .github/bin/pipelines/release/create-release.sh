#!/usr/bin/env bash

set -euo pipefail

VERSION="$1"
CHANGELOG="$2"

gh release create "$VERSION" \
  --title "Release $VERSION" \
  --notes "
### Changes
$CHANGELOG"
