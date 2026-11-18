import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '../src/github.js';

function fakeFetch(routes) {
  const calls = [];
  const impl = async (url, opts = {}) => {
    calls.push({ url, opts });
    for (const [pattern, body, status = 200] of routes) {
      if (url.includes(pattern)) return { ok: status < 400, status, json: async () => body };
    }
    return { ok: false, status: 500, json: async () => ({}) };
  };
  impl.calls = calls;
  return impl;
}

const baseRoutes = [
  ['/users/octo/repos', [
    { full_name: 'octo/a', stargazers_count: 3, fork: false },
    { full_name: 'octo/b', stargazers_count: 40, fork: false },
    { full_name: 'octo/fork', stargazers_count: 999, fork: true },
  ]],
  ['/users/octo', { login: 'octo', public_repos: 3 }],
  ['/search/issues', { total_count: 17 }],
  ['/search/commits', { total_count: 4 }],
];

test('collects public metrics and ignores forks', async () => {
  const f = fakeFetch(baseRoutes);
  const { metrics, topRepo } = await createClient({ fetchImpl: f }).fetchMetrics('@octo');
  assert.equal(metrics.maxStars, 40);
  assert.equal(topRepo, 'octo/b');
  assert.equal(metrics.mergedPRs, 17);
  assert.equal(metrics.coauthoredCommits, 4);
  assert.equal(metrics.acceptedAnswers, null);
  assert.ok(!f.calls.some((c) => c.url.endsWith('/graphql')), 'no GraphQL without a token');
});

test('uses GraphQL and auth header when a token is given', async () => {
  const f = fakeFetch([
    ['/graphql', { data: { user: { repositoryDiscussionComments: { totalCount: 9 }, sponsoring: { totalCount: 1 } } } }],
    ...baseRoutes,
  ]);
  const { metrics } = await createClient({ token: 't0k', fetchImpl: f }).fetchMetrics('octo');
  assert.equal(metrics.acceptedAnswers, 9);
  assert.equal(metrics.sponsoring, 1);
  assert.equal(f.calls[0].opts.headers.Authorization, 'Bearer t0k');
});

test('unknown user gives a clear error', async () => {
  const f = fakeFetch([['/users/ghost', {}, 404]]);
  await assert.rejects(createClient({ fetchImpl: f }).fetchMetrics('ghost'), /User not found/);
});

test('rate limit gives a helpful error', async () => {
  const f = fakeFetch([['/users/octo', {}, 403]]);
  await assert.rejects(createClient({ fetchImpl: f }).fetchMetrics('octo'), /rate limit/);
});

test('rejects invalid usernames before any request', async () => {
  const f = fakeFetch([]);
  await assert.rejects(createClient({ fetchImpl: f }).fetchMetrics('bad name!'), /Invalid username/);
  assert.equal(f.calls.length, 0);
});

test('a failing commit search degrades to a warning', async () => {
  const f = fakeFetch([['/search/commits', {}, 422], ...baseRoutes]);
  const { metrics, warnings } = await createClient({ fetchImpl: f }).fetchMetrics('octo');
  assert.equal(metrics.coauthoredCommits, null);
  assert.equal(warnings.length, 1);
});
