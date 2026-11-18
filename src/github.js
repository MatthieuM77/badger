// Collects the public numbers behind each achievement.
// Works without a token (REST only, 60 req/h). With a token, GraphQL adds
// accepted discussion answers and sponsorships.

const API = 'https://api.github.com';

export class GitHubError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export function createClient({ token = null, fetchImpl = globalThis.fetch.bind(globalThis) } = {}) {
  const headers = { Accept: 'application/vnd.github+json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  async function rest(path) {
    const res = await fetchImpl(API + path, { headers });
    if (res.status === 404) throw new GitHubError('User not found', 404);
    if (res.status === 403 || res.status === 429) {
      throw new GitHubError('GitHub rate limit reached. Wait a minute or add a token.', res.status);
    }
    if (!res.ok) throw new GitHubError(`GitHub API error ${res.status}`, res.status);
    return res.json();
  }

  async function graphql(query, variables) {
    const res = await fetchImpl(API + '/graphql', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
    });
    if (!res.ok) throw new GitHubError(`GitHub GraphQL error ${res.status}`, res.status);
    const body = await res.json();
    if (body.errors?.length) throw new GitHubError(body.errors[0].message, 200);
    return body.data;
  }

  async function searchCount(kind, q) {
    const data = await rest(`/search/${kind}?per_page=1&q=${encodeURIComponent(q)}`);
    return data.total_count;
  }

  async function maxStars(login, publicRepos) {
    let best = { stars: 0, repo: null };
    const pages = Math.min(Math.ceil(publicRepos / 100), 5) || 1;
    for (let page = 1; page <= pages; page++) {
      const repos = await rest(`/users/${login}/repos?type=owner&per_page=100&page=${page}`);
      for (const r of repos) {
        if (!r.fork && r.stargazers_count > best.stars) best = { stars: r.stargazers_count, repo: r.full_name };
      }
      if (repos.length < 100) break;
    }
    return best;
  }

  async function authedMetrics(login) {
    const data = await graphql(
      `query($login: String!) {
        user(login: $login) {
          repositoryDiscussionComments(onlyAnswers: true) { totalCount }
          sponsoring { totalCount }
        }
      }`,
      { login },
    );
    return {
      acceptedAnswers: data.user.repositoryDiscussionComments.totalCount,
      sponsoring: data.user.sponsoring.totalCount,
    };
  }

  /** Returns { user, metrics, topRepo, warnings }. */
  async function fetchMetrics(login) {
    login = login.trim().replace(/^@/, '');
    if (!/^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i.test(login)) throw new GitHubError('Invalid username', 400);

    const user = await rest(`/users/${login}`);
    const warnings = [];
    const [stars, mergedPRs, coauthoredCommits] = await Promise.all([
      maxStars(user.login, user.public_repos),
      searchCount('issues', `type:pr is:merged author:${user.login}`),
      searchCount('commits', `author:${user.login} "co-authored-by"`).catch(() => {
        warnings.push('Could not count co-authored commits.');
        return null;
      }),
    ]);

    const metrics = { maxStars: stars.stars, mergedPRs, coauthoredCommits, acceptedAnswers: null, sponsoring: null };
    if (token) {
      try {
        Object.assign(metrics, await authedMetrics(user.login));
      } catch (e) {
        warnings.push(`Token metrics unavailable: ${e.message}`);
      }
    }
    return { user, metrics, topRepo: stars.repo, warnings };
  }

  return { fetchMetrics };
}
