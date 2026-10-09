// The Kobayashi Maru's rules, checked without a browser:  node --test test/maru.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, act, orders, evaluate, CREW, MARU, WARP_HULL } from '../js/maru-sim.js';

function play(plan, opts = {}) {
  const g = newGame({ seed: 7, ...opts });
  for (const id of plan) { if (g.over) break; act(g, id); }
  return g;
}
const keepGoing = g => {
  while (!g.over && g.turn < 60) act(g, orders(g).find(o => !o.done && ['phasers', 'evade', 'hail'].includes(o.id)).id);
  return g;
};

test('staying out keeps your crew and loses the Maru', () => {
  const g = play(['hail-maru', 'leave']);
  assert.equal(g.over, 'stayed');
  const e = evaluate(g);
  assert.equal(e.title, 'By the book');
  assert.equal(e.numbers.crew, CREW);
  assert.equal(e.numbers.maruSaved, 0);
});

test('crossing the line brings three cruisers, and they hold fire for one hail', () => {
  const g = play(['enter']);
  assert.equal(g.klingons.length, 3);
  act(g, 'hail');
  assert.equal(g.hull, 100, 'they fired through the hail');
  act(g, 'hail');
  assert.ok(g.hull < 100 || g.shields < 100, 'a second hail held them off too');
});

test('the Maru is always lost: three volleys from the second turn alongside', () => {
  const g = play(['enter', 'evade', 'evade', 'evade', 'evade']);
  assert.ok(g.maru.gone);
  assert.equal(g.maru.lostTurn, 5);
});

test('beaming drops shields, so your hull takes the fire', () => {
  const g = play(['enter', 'beam']);
  assert.equal(g.aboard, 75);
  assert.equal(g.shields, 100);
  assert.ok(g.hull < 100);
});

test('two beam-overs and out is the best anyone does, and it still loses most of the Maru', () => {
  const g = play(['enter', 'beam', 'beam', 'warp']);
  assert.equal(g.over, 'warp');
  const e = evaluate(g);
  assert.equal(e.title, 'The lifeboat');
  assert.equal(e.numbers.maruSaved, 150);
  assert.ok(e.numbers.maruLost > 200);
  assert.ok(e.numbers.crew < CREW);
});

test('a third beam-over costs the warp drive or the ship', () => {
  const g = play(['enter', 'beam', 'beam', 'beam']);
  assert.ok(g.over === 'destroyed' || g.hull < WARP_HULL);
});

test('nobody wins by fighting: more cruisers keep coming', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const g = newGame({ seed });
    act(g, 'enter');
    keepGoing(g);
    assert.equal(g.over, 'destroyed', `seed ${seed} survived`);
    assert.ok(g.sent > g.kills);
  }
});

test('firing first is graded as starting a war', () => {
  const g = keepGoing(play(['enter', 'phasers']));
  assert.ok(g.flags.firedFirst);
  const e = evaluate(g);
  assert.equal(e.title, 'The war you started');
  assert.equal(e.grades.find(x => x.name === 'Restraint').letter, 'F');
});

test('surrender is always refused', () => {
  const g = play(['enter', 'surrender']);
  assert.ok(g.flags.surrendered);
  assert.equal(g.over, null);
  assert.ok(orders(g).find(o => o.id === 'surrender').done);
});

test('abandoning ship saves the crew as prisoners', () => {
  const g = play(['enter', 'beam', 'beam']);
  assert.ok(orders(g).some(o => o.id === 'abandon'));
  act(g, 'abandon');
  const e = evaluate(g);
  assert.equal(e.title, 'Last off the ship');
  assert.ok(e.numbers.prisoners);
  assert.equal(e.numbers.maruSaved, 150);
});

test('the reprogrammed simulator lets everyone go home, and says so', () => {
  const g = play(['enter', 'beam', 'beam', 'beam', 'beam', 'beam', 'beam', 'warp'], { rewritten: true });
  assert.equal(g.over, 'warp');
  const e = evaluate(g);
  assert.equal(e.numbers.maruSaved, MARU);
  assert.equal(e.numbers.crew, CREW);
  assert.equal(e.grades.find(x => x.name === 'Honesty').letter, 'F');
});

test('every ending gets four grades and a note', () => {
  for (const plan of [['leave'], ['enter', 'warp'], ['enter', 'beam', 'beam', 'warp'], ['enter', 'beam', 'beam', 'abandon']]) {
    const e = evaluate(play(plan));
    assert.equal(e.grades.length, 4);
    for (const x of e.grades) assert.match(x.letter, /^[ABCDF]$/);
    assert.ok(e.note.length >= 1);
    assert.ok(e.summary.length > 20);
  }
});
