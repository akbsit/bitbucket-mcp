#!/usr/bin/env bash

set -euo pipefail

REPO_URL="https://github.com/${GITHUB_REPOSITORY}"

TAGS=($(git tag --sort=-creatordate))

CURRENT_TAG="${TAGS[0]:-}"
PREV_TAG="${TAGS[1]:-}"

if [ -z "$CURRENT_TAG" ]; then
  RANGE=""
elif [ -z "$PREV_TAG" ]; then
  RANGE="$CURRENT_TAG"
else
  RANGE="$PREV_TAG..$CURRENT_TAG"
fi

CHANGELOG="## What's Changed"$'\n'

if [ -z "$RANGE" ]; then
  LOG=$(git log --pretty=format:"%s|%h")
else
  LOG=$(git log "$RANGE" --pretty=format:"%s|%h")
fi

while IFS="|" read -r MESSAGE HASH; do
  if [[ "$MESSAGE" =~ \#([0-9]+) ]]; then
    PR_NUMBER="${BASH_REMATCH[1]}"
    PR_LINK="$REPO_URL/pull/$PR_NUMBER"
    CHANGELOG+="* $MESSAGE [#$PR_NUMBER]($PR_LINK)"$'\n'
  else
    COMMIT_LINK="$REPO_URL/commit/$HASH"
    CHANGELOG+="* $MESSAGE [${HASH}]($COMMIT_LINK)"$'\n'
  fi
done <<< "$LOG"

CHANGELOG=${CHANGELOG:-"## What's Changed"$'\n'"- no changes"}
CHANGELOG+=$'\n'

if [ -z "$PREV_TAG" ]; then
  CHANGELOG+="**Full Changelog**: [$CURRENT_TAG]($REPO_URL/commits/$CURRENT_TAG)"
else
  CHANGELOG+="**Full Changelog**: [$PREV_TAG...$CURRENT_TAG]($REPO_URL/compare/$PREV_TAG...$CURRENT_TAG)"
fi

echo "changelog<<EOF" >> $GITHUB_OUTPUT
echo "$CHANGELOG" >> $GITHUB_OUTPUT
echo "EOF" >> $GITHUB_OUTPUT
