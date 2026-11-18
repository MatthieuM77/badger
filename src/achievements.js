// Achievement catalogue and tier maths. Pure functions, no DOM, no network.

export const TIER_NAMES = ['Default', 'Bronze', 'Silver', 'Gold'];

/**
 * metric: key filled in by the GitHub client (null = not measurable from public data).
 * auth: true when the metric needs a personal access token (GraphQL).
 */
export const ACHIEVEMENTS = [
  {
    id: 'starstruck',
    name: 'Starstruck',
    emoji: '⭐',
    description: 'Created a repository that has many stars.',
    tiers: [16, 128, 512, 4096],
    metric: 'maxStars',
    unit: 'stars on your most-starred repo',
    how: 'Build something people want, write a clear README with a screenshot, and share it where it helps (forums, Reddit, Hacker News, dev.to). Stars must come from real users.',
  },
  {
    id: 'pull-shark',
    name: 'Pull Shark',
    emoji: '🦈',
    description: 'Opened pull requests that have been merged.',
    tiers: [2, 16, 128, 1024],
    metric: 'mergedPRs',
    unit: 'merged pull requests',
    how: 'Open pull requests and get them merged. Your own repositories count; contributing fixes to projects you use counts too and is far more valuable.',
  },
  {
    id: 'pair-extraordinaire',
    name: 'Pair Extraordinaire',
    emoji: '👯',
    description: 'Coauthored commits on merged pull requests.',
    tiers: [1, 10, 24, 48],
    metric: 'coauthoredCommits',
    unit: 'co-authored commits (estimate)',
    approximate: true,
    how: 'Pair with someone and add a "Co-authored-by: Name <email>" trailer to a commit, then merge the pull request. The email must belong to a GitHub account.',
  },
  {
    id: 'galaxy-brain',
    name: 'Galaxy Brain',
    emoji: '🧠',
    description: 'Answered discussions; answers were accepted.',
    tiers: [2, 8, 16, 32],
    metric: 'acceptedAnswers',
    unit: 'accepted discussion answers',
    auth: true,
    how: 'Answer questions in the Discussions tab of open source repositories. The answer counts once the asker marks it as accepted.',
  },
  {
    id: 'quickdraw',
    name: 'Quickdraw',
    emoji: '⚡',
    description: 'Closed an issue or pull request within 5 minutes of opening.',
    tiers: [1],
    metric: null,
    how: 'Open an issue in one of your repositories and close it within five minutes.',
  },
  {
    id: 'yolo',
    name: 'YOLO',
    emoji: '🤠',
    description: 'Merged a pull request without code review.',
    tiers: [1],
    metric: null,
    how: 'Merge a pull request in your own repository without requesting or waiting for a review.',
  },
  {
    id: 'public-sponsor',
    name: 'Public Sponsor',
    emoji: '💖',
    description: 'Sponsored open source work via GitHub Sponsors.',
    tiers: [1],
    metric: 'sponsoring',
    unit: 'people or organisations sponsored',
    auth: true,
    how: 'Sponsor a maintainer whose work you rely on at github.com/sponsors, with public visibility.',
  },
];

/**
 * Where does `value` sit on a tier ladder?
 * level: index of the highest tier reached (-1 = locked).
 * next: threshold of the next tier, or null when maxed.
 * percent: progress from the previous threshold (or 0) to the next one.
 */
export function progress(tiers, value) {
  if (value == null || Number.isNaN(value)) {
    return { level: -1, tierName: null, next: tiers[0], remaining: null, percent: 0, maxed: false, known: false };
  }
  let level = -1;
  for (let i = 0; i < tiers.length; i++) if (value >= tiers[i]) level = i;
  const maxed = level === tiers.length - 1;
  const next = maxed ? null : tiers[level + 1];
  const floor = level >= 0 ? tiers[level] : 0;
  const percent = maxed ? 100 : Math.max(0, Math.min(100, Math.floor(((value - floor) / (next - floor)) * 100)));
  return {
    level,
    tierName: level >= 0 ? TIER_NAMES[level] : null,
    next,
    remaining: maxed ? 0 : next - value,
    percent,
    maxed,
    known: true,
  };
}

/** Attach progress to every achievement given a metrics object from the client. */
export function evaluate(metrics) {
  return ACHIEVEMENTS.map((a) => ({
    ...a,
    value: a.metric ? metrics[a.metric] ?? null : null,
    progress: progress(a.tiers, a.metric ? metrics[a.metric] : null),
  }));
}
