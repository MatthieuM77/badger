import { evaluate, TIER_NAMES } from './achievements.js';
import { createClient } from './github.js';

const $ = (sel) => document.querySelector(sel);
const form = $('#lookup');
const loginInput = $('#login');
const tokenInput = $('#token');
const statusEl = $('#status');
const grid = $('#grid');
const profile = $('#profile');

const DEMO = {
  user: { login: 'octocat', name: 'Demo user', avatar_url: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' fill='%23ddf4ff'/><text x='50' y='68' font-size='56' text-anchor='middle'>🦡</text></svg>", html_url: 'https://github.com/octocat' },
  metrics: { maxStars: 92, mergedPRs: 21, coauthoredCommits: 6, acceptedAnswers: 3, sponsoring: 0 },
  topRepo: 'octocat/hello-world',
  warnings: [],
};

try { tokenInput.value = sessionStorage.getItem('badger-token') || ''; } catch {}
tokenInput.addEventListener('change', () => {
  try { sessionStorage.setItem('badger-token', tokenInput.value.trim()); } catch {}
});

const el = (tag, attrs = {}, ...children) => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (v !== false && v != null) node.setAttribute(k, v);
  }
  node.append(...children.filter((c) => c != null));
  return node;
};

function tierLadder(a) {
  const ol = el('ol', { class: 'tiers', 'aria-label': 'Tiers' });
  a.tiers.forEach((t, i) => {
    const reached = a.progress.level >= i;
    ol.append(el('li', { class: `tier t${i}${reached ? ' reached' : ''}`, title: `${TIER_NAMES[i]}: ${t}` },
      el('span', { class: 'dot', 'aria-hidden': 'true' }), `${TIER_NAMES[i]} · ${t}`));
  });
  return ol;
}

function card(a) {
  const p = a.progress;
  let summary;
  if (!a.metric) summary = el('p', { class: 'muted' }, 'Not visible through the API — check your profile.');
  else if (!p.known) summary = el('p', { class: 'muted' }, a.auth ? 'Add a token to measure this one.' : 'Could not be measured.');
  else if (p.maxed) summary = el('p', { class: 'done' }, `${a.value} ${a.unit} — all tiers reached 🎉`);
  else summary = el('p', {}, el('strong', {}, String(a.value)), ` ${a.unit}`, el('br'),
    ...(a.tiers.length === 1 || p.level === -1
      ? [`${p.remaining} more to unlock`, a.tiers.length > 1 ? ` (${p.next})` : '']
      : [`${p.remaining} more for `, el('strong', {}, TIER_NAMES[p.level + 1]), ` (${p.next})`]));

  const badge = p.known && p.level >= 0
    ? el('span', { class: `pill t${p.level}` }, a.tiers.length > 1 ? TIER_NAMES[p.level] : 'Unlocked')
    : el('span', { class: 'pill locked' }, p.known ? 'Locked' : '?');

  return el('article', { class: 'card', id: a.id },
    el('div', { class: 'card-head' },
      el('span', { class: 'emoji', 'aria-hidden': 'true' }, a.emoji),
      el('div', {}, el('h2', {}, a.name), el('p', { class: 'muted small' }, a.description)),
      badge),
    summary,
    p.known && !p.maxed && a.metric
      ? el('div', { class: 'bar', role: 'progressbar', 'aria-valuenow': p.percent, 'aria-valuemin': 0, 'aria-valuemax': 100 },
          el('span', { style: `width:${p.percent}%` }))
      : null,
    a.tiers.length > 1 ? tierLadder(a) : null,
    a.approximate ? el('p', { class: 'muted small' }, 'Estimate based on commit search.') : null,
    el('details', {}, el('summary', {}, 'How to unlock'), el('p', {}, a.how)),
  );
}

function shareButton(login) {
  const url = new URL(location.pathname, location.origin);
  url.searchParams.set('user', login);
  const btn = el('button', { type: 'button', class: 'secondary' }, 'Copy share link');
  btn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(url.href);
      btn.textContent = 'Copied ✓';
    } catch {
      prompt('Copy this link:', url.href);
    }
    setTimeout(() => { btn.textContent = 'Copy share link'; }, 2000);
  });
  return btn;
}

function render({ user, metrics, topRepo, warnings }) {
  profile.replaceChildren(
    el('img', { src: user.avatar_url, alt: '', width: 56, height: 56 }),
    el('div', {},
      el('h2', {}, el('a', { href: user.html_url, target: '_blank', rel: 'noopener' }, user.name || user.login)),
      el('p', { class: 'muted small' }, `@${user.login}`, topRepo ? ` · top repo: ${topRepo}` : '')),
    shareButton(user.login),
  );
  profile.hidden = false;
  grid.replaceChildren(...evaluate(metrics).map(card));
  statusEl.textContent = warnings.join(' ');
}

async function lookup(login) {
  statusEl.textContent = 'Loading…';
  grid.replaceChildren();
  profile.hidden = true;
  try {
    const client = createClient({ token: tokenInput.value.trim() || null });
    render(await client.fetchMetrics(login));
  } catch (e) {
    statusEl.textContent = e.message;
  }
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const login = loginInput.value.trim();
  const url = new URL(location.href);
  url.searchParams.set('user', login);
  url.searchParams.delete('demo');
  history.replaceState(null, '', url);
  lookup(login);
});

const params = new URLSearchParams(location.search);
if (params.has('demo')) {
  loginInput.value = DEMO.user.login;
  render(DEMO);
} else if (params.get('user')) {
  loginInput.value = params.get('user');
  lookup(params.get('user'));
}
