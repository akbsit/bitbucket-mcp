#!/usr/bin/env bash

set -euo pipefail

TAGS=($(git tag --sort=-creatordate))

if [ "${#TAGS[@]}" -eq 0 ]; then
  NEW_VERSION="1.0.0"
else
  IFS="." read -r MAJOR MINOR PATCH <<< "${TAGS[0]}"
  PATCH=$((PATCH + 1))
  NEW_VERSION="$MAJOR.$MINOR.$PATCH"
fi

echo "Calculated version: $NEW_VERSION"
echo "new_version=$NEW_VERSION" >> $GITHUB_OUTPUT
