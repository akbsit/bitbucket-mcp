#!/usr/bin/env node

'use strict';

const { readFileSync } = require('node:fs');

const COVERAGE_METRICS = ['branches', 'functions', 'lines', 'statements'];

function parseMinimumCoverage(value = '80') {
  const minimumCoverage = Number(value);

  if (
    !Number.isFinite(minimumCoverage) ||
    minimumCoverage < 0 ||
    minimumCoverage > 100
  ) {
    throw new Error('MIN_COVERAGE must be a number between 0 and 100.');
  }

  return minimumCoverage;
}

function readCoverageSummary(summaryPath) {
  if (summaryPath === undefined) {
    throw new Error('Coverage summary path is required.');
  }

  const summary = JSON.parse(readFileSync(summaryPath, 'utf8'));

  return COVERAGE_METRICS.map((name) => {
    const percentage = summary.total?.[name]?.pct;

    if (typeof percentage !== 'number') {
      throw new Error(`Coverage summary does not contain ${name}.`);
    }

    return { name, percentage };
  });
}

module.exports = {
  parseMinimumCoverage,
  readCoverageSummary,
};
