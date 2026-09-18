#!/usr/bin/env bash

set -euo pipefail

VERSION="$1"

git config user.name "github-actions"
git config user.email "actions@github.com"

if git rev-parse "$VERSION" >/dev/null 2>&1; then
  echo "Tag $VERSION already exists, skipping"
else
  git tag "$VERSION"
  git push origin "$VERSION"
  echo "Tag $VERSION created and pushed"
fi
