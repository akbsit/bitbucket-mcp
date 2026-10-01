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

export interface PullRequestComment {
  readonly id: number;
  readonly content: string;
  readonly author: {
    readonly display_name: string;
    readonly account_id: string;
  } | null;
  readonly created_on: string;
  readonly updated_on: string;
  readonly inline: {
    readonly path: string;
    readonly from: number | null;
    readonly to: number | null;
  } | null;
  readonly parent_id: number | null;
  readonly deleted: boolean;
}

export interface PullRequestComments {
  readonly values: readonly PullRequestComment[];
  readonly fetched_count: number;
  readonly truncated: boolean;
}

export interface CreatedPullRequestComment {
  readonly id: number;
  readonly content: string;
}
