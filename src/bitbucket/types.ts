export interface PullRequestReference {
  readonly workspace: string;
  readonly repoSlug: string;
  readonly prId: string;
}

export interface PullRequest {
  readonly id: number;
  readonly title: string;
  readonly description: string;
  readonly state: string;
  readonly author: {
    readonly display_name: string;
    readonly account_id: string;
  } | null;
  readonly source: {
    readonly branch: {
      readonly name: string;
    };
  };
  readonly destination: {
    readonly branch: {
      readonly name: string;
    };
  };
  readonly links: {
    readonly html: {
      readonly href: string;
    };
  };
}

export interface PullRequestCommit {
  readonly hash: string;
  readonly message: string;
  readonly date: string;
  readonly author: {
    readonly raw: string;
  };
}

export interface PullRequestCommits {
  readonly values: readonly PullRequestCommit[];
  readonly fetched_count: number;
  readonly truncated: boolean;
}

export interface PullRequestDiff {
  readonly diff: string;
  readonly bytes: number;
  readonly truncated: boolean;
}
