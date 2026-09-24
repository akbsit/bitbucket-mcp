# Node.js Docker test pipeline

Reusable Docker-based test pipeline for Node.js projects that use npm. It is independent of the application framework and test runner, but it is not intended for other programming-language ecosystems.

## Requirements

The target project must provide:

- `package.json` and `package-lock.json`;
- an npm `check` script;
- an npm `build` script;
- an npm `test` script;
- an npm `test:coverage` script that generates `coverage/coverage-summary.json`.

## Local usage

Run unit tests:

```shell
npm test
```

Run tests with coverage:

```shell
npm run test:coverage
```

The coverage command enforces an 80% minimum for branches, functions, lines, and statements.

## Docker usage

```shell
.github/bin/pipelines/test-nodejs/docker-build.sh
.github/bin/pipelines/test-nodejs/docker-run.sh check
.github/bin/pipelines/test-nodejs/docker-tests.sh
.github/bin/pipelines/test-nodejs/docker-coverage.sh
.github/bin/pipelines/test-nodejs/docker-comment-coverage.sh
.github/bin/pipelines/test-nodejs/docker-run.sh build
```

`docker-run.sh` can execute any npm script inside the test image.

The Docker build context is controlled by the root `.dockerignore`. Keep secrets, local dependencies, build output, and coverage artifacts excluded from the context.

## GitHub Actions

The `.github/workflows/test-nodejs.yml` workflow runs the Docker pipeline for every pull request. Its `Test` status check must be required by the repository ruleset to block merging when tests or coverage fail.

The workflow creates one coverage comment in same-repository pull requests and updates it on subsequent runs. Pull requests from forks and Dependabot skip this step because their `GITHUB_TOKEN` is read-only. Comment publishing is best-effort, while the independent coverage check still fails the workflow when a metric is below the configured threshold.

`docker-comment-coverage.sh` is intended for GitHub Actions. Running it locally requires `GITHUB_TOKEN`, `GITHUB_REPOSITORY`, and `PR_NUMBER`.

## Configuration

| Variable                  | Default               | Purpose                      |
| ------------------------- | --------------------- | ---------------------------- |
| `NODE_VERSION`            | `22.13.0`             | Node.js Docker image version |
| `TEST_IMAGE_NAME`         | `<repository>-test`   | Docker image name            |
| `TEST_IMAGE_TAG`          | `latest`              | Docker image tag             |
| `TEST_DOCKERFILE`         | Pipeline `Dockerfile` | Test Dockerfile path         |
| `TEST_CONTAINER_WORKDIR`  | `/app`                | Container project directory  |
| `TEST_COVERAGE_DIRECTORY` | `coverage`            | Host coverage directory      |
| `TEST_SCRIPT`             | `test`                | npm unit-test script         |
| `COVERAGE_SCRIPT`         | `test:coverage`       | npm coverage script          |
| `MIN_COVERAGE`            | `80`                  | Required coverage percentage |
| `GITHUB_API_URL`          | GitHub Actions value  | GitHub REST API base URL     |
| `GITHUB_API_VERSION`      | `2022-11-28`          | GitHub REST API version      |

The coverage script accepts any Jest, Vitest, or Istanbul-compatible `coverage-summary.json`. It validates branches, functions, lines, and statements. Any metric below `MIN_COVERAGE` fails the pipeline.
