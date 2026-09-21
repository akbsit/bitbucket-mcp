# bitbucket-mcp

## Built With

- [![Node.js][nodejs-shield]][nodejs-url]
  - [![TypeScript][typescript-shield]][typescript-url]
  - [![Model Context Protocol][mcp-shield]][mcp-url]
- [![Bitbucket][bitbucket-shield]][bitbucket-url]

[nodejs-shield]: https://img.shields.io/badge/node.js-20232A?style=for-the-badge&logo=node.js
[nodejs-url]: https://nodejs.org/
[typescript-shield]: https://img.shields.io/badge/typescript-20232A?style=for-the-badge&logo=typescript
[typescript-url]: https://www.typescriptlang.org/
[mcp-shield]: https://img.shields.io/badge/model_context_protocol-20232A?style=for-the-badge
[mcp-url]: https://modelcontextprotocol.io/
[bitbucket-shield]: https://img.shields.io/badge/bitbucket-20232A?style=for-the-badge&logo=bitbucket
[bitbucket-url]: https://bitbucket.org/product/guides/getting-started/overview

## Docs

- [Git workflow](.docs/git-workflow.md).
- [Node.js test pipeline](.github/bin/pipelines/test-nodejs/README.md).

## Tools

- `getPullRequest` returns pull request metadata;
- `getPullRequestCommits` returns pull request commits with bounded pagination;
- `getPullRequestDiff` returns a unified diff with a configurable size limit.

## Project setup

### Install dependencies

```shell
npm ci
```

### Configure the environment

Copy `.env.example` to `.env` and provide the required values:

```text
BITBUCKET_API_TOKEN=your-scoped-api-token
BITBUCKET_API_BASE_URL=https://api.bitbucket.org/2.0/
```

### Run the build mode

```shell
npm run build
```

The compiled server is written to `.dist`.

### Run the application

```shell
npm run build
npm start
```

The start command loads `.env` when the file exists. Values from the process environment remain supported.

## MCP client setup

Build the project, then configure the client with an absolute path to `.dist/index.js`:

```json
{
  "mcpServers": {
    "bitbucket": {
      "command": "node",
      "args": ["/absolute/path/to/bitbucket-mcp/.dist/index.js"],
      "env": {
        "BITBUCKET_API_TOKEN": "your-scoped-api-token",
        "BITBUCKET_API_BASE_URL": "https://api.bitbucket.org/2.0/"
      }
    }
  }
}
```

## Configuration

| Variable                       | Default   | Allowed range | Purpose                                     |
| ------------------------------ | --------- | ------------- | ------------------------------------------- |
| `BITBUCKET_API_TOKEN`          | Required  | Non-empty     | Bitbucket Cloud API token                   |
| `BITBUCKET_API_BASE_URL`       | Required  | HTTPS URL     | Bitbucket Cloud REST API base URL           |
| `BITBUCKET_REQUEST_TIMEOUT_MS` | `15000`   | 1000-120000   | Timeout for each HTTP attempt               |
| `BITBUCKET_MAX_RETRIES`        | `2`       | 0-5           | Retries after the initial request           |
| `BITBUCKET_MAX_PAGES`          | `20`      | 1-100         | Maximum commit pages per tool call          |
| `BITBUCKET_MAX_COMMITS`        | `1000`    | 1-5000        | Maximum commits returned per tool call      |
| `BITBUCKET_MAX_DIFF_BYTES`     | `2000000` | 1024-10000000 | Maximum bytes retained from a diff          |
| `BITBUCKET_MAX_JSON_BYTES`     | `1000000` | 1024-10000000 | Maximum bytes accepted in one JSON response |

The API base URL must use HTTPS and cannot contain credentials, query parameters, or fragments.

## Development

### Check the project

```shell
npm run check
```

### Format the project

```shell
npm run format
```

### Build the project

```shell
npm run build
```
