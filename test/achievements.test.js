import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ACHIEVEMENTS, progress, evaluate } from '../src/achievements.js';

test('locked when below first tier', () => {
  const p = progress([2, 16, 128, 1024], 1);
  assert.equal(p.level, -1);
  assert.equal(p.tierName, null);
  assert.equal(p.next, 2);
  assert.equal(p.remaining, 1);
  assert.equal(p.percent, 50);
});

test('exact threshold reaches the tier', () => {
  const p = progress([2, 16, 128, 1024], 16);
  assert.equal(p.tierName, 'Bronze');
  assert.equal(p.next, 128);
  assert.equal(p.remaining, 112);
  assert.equal(p.percent, 0);
});

test('percent is measured from the previous tier', () => {
  assert.equal(progress([2, 16, 128, 1024], 9).percent, 50);
});

test('maxed out at gold', () => {
  const p = progress([16, 128, 512, 4096], 5000);
  assert.equal(p.tierName, 'Gold');
  assert.equal(p.maxed, true);
  assert.equal(p.next, null);
  assert.equal(p.percent, 100);
});

test('single-tier achievements', () => {
  assert.equal(progress([1], 0).level, -1);
  assert.equal(progress([1], 3).maxed, true);
});

test('unknown values are flagged, not treated as zero', () => {
  const p = progress([2], null);
  assert.equal(p.known, false);
  assert.equal(p.remaining, null);
});

test('evaluate maps metrics onto every achievement', () => {
  const out = evaluate({ mergedPRs: 20, maxStars: 3 });
  assert.equal(out.length, ACHIEVEMENTS.length);
  assert.equal(out.find((a) => a.id === 'pull-shark').progress.tierName, 'Bronze');
  assert.equal(out.find((a) => a.id === 'starstruck').progress.remaining, 13);
  assert.equal(out.find((a) => a.id === 'galaxy-brain').progress.known, false);
});

test('tiers are strictly increasing', () => {
  for (const a of ACHIEVEMENTS) {
    for (let i = 1; i < a.tiers.length; i++) assert.ok(a.tiers[i] > a.tiers[i - 1], a.id);
  }
});
