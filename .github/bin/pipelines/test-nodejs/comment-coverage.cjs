#!/usr/bin/env node

'use strict';

const {
  parseMinimumCoverage,
  readCoverageSummary,
} = require('./coverage-summary.cjs');

const COMMENT_MARKER = '<!-- nodejs-test-coverage -->';
const DEFAULT_GITHUB_API_URL = 'https://api.github.com';
const DEFAULT_GITHUB_API_VERSION = '2022-11-28';

function requireEnvironment(name) {
  const value = process.env[name];

  if (value === undefined || value === '') {
    throw new Error(`${name} is required.`);
  }

  return value;
}

function parseRepository(value) {
  const parts = value.split('/');

  if (parts.length !== 2 || parts.some((part) => part === '')) {
    throw new Error(
      'GITHUB_REPOSITORY must use the owner/repository format.',
    );
  }

  return parts.map(encodeURIComponent).join('/');
}

function parsePullRequestNumber(value) {
  if (!/^\d+$/.test(value) || Number(value) < 1) {
    throw new Error('PR_NUMBER must be a positive integer.');
  }

  return value;
}

function buildComment(metrics, minimumCoverage) {
  const rows = metrics.map(({ name, percentage }) => {
    const status = percentage >= minimumCoverage ? '✅ Pass' : '❌ Fail';
    const label = name[0].toUpperCase() + name.slice(1);

    return `| ${label} | ${percentage}% | ${minimumCoverage}% | ${status} |`;
  });
  const passed = metrics.every(
    ({ percentage }) => percentage >= minimumCoverage,
  );
  const conclusion = passed
    ? 'Coverage meets the required threshold.'
    : 'Coverage is below the required threshold.';

  return [
    COMMENT_MARKER,
    '## Test coverage',
    '',
    '| Metric | Coverage | Required | Status |',
    '| --- | ---: | ---: | :---: |',
    ...rows,
    '',
    conclusion,
  ].join('\n');
}

async function request(url, options, token, apiVersion) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'nodejs-test-coverage',
      'X-GitHub-Api-Version': apiVersion,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const responseBody = await response.text();
    throw new Error(
      `GitHub API request failed (${response.status} ${response.statusText}): ${responseBody}`,
    );
  }

  return response.status === 204 ? undefined : response.json();
}

async function findExistingComment(commentsUrl, token, apiVersion) {
  for (let page = 1; ; page += 1) {
    const comments = await request(
      `${commentsUrl}?per_page=100&page=${page}`,
      { method: 'GET' },
      token,
      apiVersion,
    );
    const existingComment = comments.find(
      (comment) =>
        comment.user?.login === 'github-actions[bot]' &&
        comment.body?.includes(COMMENT_MARKER),
    );

    if (existingComment !== undefined || comments.length < 100) {
      return existingComment;
    }
  }
}

async function main() {
  const token = requireEnvironment('GITHUB_TOKEN');
  const repository = parseRepository(
    requireEnvironment('GITHUB_REPOSITORY'),
  );
  const pullRequestNumber = parsePullRequestNumber(
    requireEnvironment('PR_NUMBER'),
  );
  const apiUrl = (
    process.env.GITHUB_API_URL ?? DEFAULT_GITHUB_API_URL
  ).replace(/\/$/, '');
  const apiVersion =
    process.env.GITHUB_API_VERSION ?? DEFAULT_GITHUB_API_VERSION;
  const minimumCoverage = parseMinimumCoverage(process.env.MIN_COVERAGE);
  const metrics = readCoverageSummary(process.argv[2]);
  const body = buildComment(metrics, minimumCoverage);
  const commentsUrl = `${apiUrl}/repos/${repository}/issues/${pullRequestNumber}/comments`;
  const existingComment = await findExistingComment(
    commentsUrl,
    token,
    apiVersion,
  );

  if (existingComment === undefined) {
    await request(
      commentsUrl,
      { method: 'POST', body: JSON.stringify({ body }) },
      token,
      apiVersion,
    );
    console.log('Coverage comment created.');
    return;
  }

  await request(
    `${apiUrl}/repos/${repository}/issues/comments/${existingComment.id}`,
    { method: 'PATCH', body: JSON.stringify({ body }) },
    token,
    apiVersion,
  );
  console.log('Coverage comment updated.');
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { buildComment };
