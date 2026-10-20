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

test('a parting volley that destroys the ship ends the simulation', () => {
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const g = newGame({ seed });
    for (const id of ['enter', 'hail', 'evade', 'evade', 'evade', 'evade', 'evade']) act(g, id);
    assert.ok(g.hull >= WARP_HULL, `seed ${seed}: the warp drive was already gone`);
    const { events, lines } = act(g, 'warp');
    assert.equal(g.hull, 0, `seed ${seed}: the parting volley left the hull at ${g.hull}%`);
    assert.equal(g.over, 'destroyed', `seed ${seed}: the simulation went on at 0% hull`);
    assert.deepEqual(orders(g), []);
    assert.ok(events.some(e => e.type === 'destroyed'));
    assert.match(lines.at(-1).text, /Warp core breach/);
    assert.equal(evaluate(g).numbers.crew, 0);
  }
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
  assert.equal(e.title, 'Changed the rules');
  assert.equal(e.numbers.maruSaved, MARU);
  assert.equal(e.numbers.crew, CREW);
  assert.equal(e.grades.find(x => x.name === 'Honesty').letter, 'F');
});

test('a reprogrammed run that leaves anyone behind, or fires a shot, is graded like any other', () => {
  const grade = (e, name) => e.grades.find(x => x.name === name);
  // Staying out: the Maru's signal stops, and nobody comes home from her.
  let e = evaluate(play(['leave'], { rewritten: true }));
  assert.equal(e.title, 'By the book');
  assert.equal(grade(e, 'Compassion').letter, 'F');
  assert.equal(grade(e, 'Honesty').letter, 'F');
  // Firing on cruisers that had promised not to fire.
  e = evaluate(play(['enter', 'phasers', 'phasers', 'warp'], { rewritten: true }));
  assert.equal(e.title, 'Turned back');
  assert.equal(grade(e, 'Restraint').letter, 'F');
  assert.equal(grade(e, 'Restraint').why, 'You fired the first shot.');
  // Going straight back to warp is no act of compassion.
  e = evaluate(play(['enter', 'warp'], { rewritten: true }));
  assert.notEqual(grade(e, 'Compassion').letter, 'A');
  // Leaving people aboard the Maru: they stay counted, and the log says how many.
  const g = newGame({ seed: 7, rewritten: true });
  const said = [];
  for (const id of ['enter', 'beam', 'beam', 'warp']) said.push(...act(g, id).lines.map(l => l.text));
  assert.equal(g.maru.aboard, MARU - 150, 'going to warp emptied the Maru');
  assert.ok(said.some(t => t.includes(`${MARU - 150} still aboard`)), 'the log did not say who was left aboard');
  e = evaluate(g);
  assert.equal(e.title, 'The lifeboat');
  assert.match(e.summary, new RegExp(`${MARU - 150} were lost`));
  // Everyone aboard, but a shot fired on the way out.
  e = evaluate(play(['enter', 'beam', 'beam', 'beam', 'beam', 'beam', 'beam', 'phasers', 'warp'], { rewritten: true }));
  assert.equal(e.title, 'The lifeboat');
  assert.equal(e.summary, `You brought all ${MARU} of the Maru’s people home.`);
  assert.equal(grade(e, 'Restraint').letter, 'F');
  for (const plan of [['leave'], ['enter', 'warp'], ['enter', 'beam', 'beam', 'warp']]) {
    const x = evaluate(play(plan, { rewritten: true }));
    assert.equal(x.grades.length, 5, `${plan}: four grades and honesty`);
    assert.notEqual(x.title, 'Changed the rules');
  }
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
