#!/usr/bin/env node

'use strict';

const {
  parseMinimumCoverage,
  readCoverageSummary,
} = require('./coverage-summary.cjs');

const summaryPath = process.argv[2];
const minimumCoverage = parseMinimumCoverage(process.env.MIN_COVERAGE);
const metrics = readCoverageSummary(summaryPath);
let failed = false;

for (const { name, percentage } of metrics) {
  console.log(`${name}: ${percentage}% | minimum: ${minimumCoverage}%`);

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
