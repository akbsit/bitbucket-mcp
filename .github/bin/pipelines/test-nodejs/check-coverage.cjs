#!/usr/bin/env node

'use strict';

const { readFileSync } = require('node:fs');

const summaryPath = process.argv[2];
const minimumCoverage = Number(process.env.MIN_COVERAGE ?? '80');

if (summaryPath === undefined) {
  throw new Error('Coverage summary path is required.');
}

if (
  !Number.isFinite(minimumCoverage) ||
  minimumCoverage < 0 ||
  minimumCoverage > 100
) {
  throw new Error('MIN_COVERAGE must be a number between 0 and 100.');
}

const summary = JSON.parse(readFileSync(summaryPath, 'utf8'));
const metrics = ['branches', 'functions', 'lines', 'statements'];
let failed = false;

for (const metric of metrics) {
  const percentage = summary.total?.[metric]?.pct;
  if (typeof percentage !== 'number') {
    throw new Error(`Coverage summary does not contain ${metric}.`);
  }

  console.log(`${metric}: ${percentage}% | minimum: ${minimumCoverage}%`);

  if (percentage < minimumCoverage) {
    failed = true;
  }
}

if (failed) {
  console.error('Coverage is below the required threshold.');
  process.exitCode = 1;
} else {
  console.log('Coverage meets the required threshold.');
}
