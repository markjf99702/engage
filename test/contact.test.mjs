// First contact's language and rules, checked without a browser:  node --test test/contact.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, act, debrief, hint, makeLanguage, MEANINGS, PATIENCE, BEAT_IDS } from '../js/contact-sim.js';

// Plays the right answer each turn, from what has been heard so far.
function win(g) {
  for (let n = 0; !g.over && n < 40; n++) {
    const h = hint(g);
    act(g, h ? { say: [h] } : 'listen');
  }
  return g;
}

test('each seed makes its own language, and the same seed the same one', () => {
  const a = makeLanguage(1), b = makeLanguage(1), c = makeLanguage(2);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a.phrases, c.phrases);
  for (const seed of [1, 2, 3, 42, 999]) {
    const L = makeLanguage(seed);
    const texts = MEANINGS.map(([id]) => L.phrases[id]);
    assert.equal(new Set(texts).size, texts.length, `two ideas share a phrase in language ${seed}`);
    for (const t of texts) assert.match(t, /^[A-Z][^{}]*$/, `unfilled or uncapitalised phrase: ${t}`);
    assert.match(L.phrases.story, new RegExp(`^${L.captain} and the stranger at `));
  }
});

test('answering right every time makes first contact, for any seed', () => {
  for (let seed = 1; seed <= 200; seed++) {
    const g = win(newGame({ seed }));
    assert.equal(g.over, 'contact', `seed ${seed} ended ${g.over}`);
    assert.equal(g.patience, PATIENCE);
    assert.equal(g.misses, 0);
  }
});

test('every beat can be answered with a phrase already heard, with no help from Standard', () => {
  const g = newGame({ seed: 5 });
  for (const id of BEAT_IDS) {
    assert.ok(hint(g), `nothing heard yet answers ${id}`);
    act(g, { say: [hint(g)] });
  }
  assert.equal(g.over, 'contact');
});

test('saying things that make no sense wears their patience out', () => {
  const g = newGame({ seed: 9 });
  for (let i = 0; i < PATIENCE && !g.over; i++) act(g, { say: ['we'] });
  assert.equal(g.over, 'silence');
  assert.equal(g.patience, 0);
  assert.ok(g.heard.includes('understand') && g.heard.includes('no'), 'they never said they did not understand');
});

test('you can only say what you have heard, and only three phrases at once', () => {
  const g = newGame({ seed: 3 });
  const before = g.log.length;
  assert.deepEqual(act(g, { say: ['danger'] }), [], 'said a phrase never heard');
  assert.equal(g.log.length, before);
  assert.equal(g.turn, 0);
  act(g, { say: ['meet', 'we', 'meet', 'meet'] });
  assert.equal(g.beat, 1, 'a greeting with extra words did not work');
});

test('throwing every phrase at them at once does not work', () => {
  const h = newGame({ seed: 4 });
  act(h, { say: ['meet'] });
  const beat = h.beat;
  act(h, { say: ['see', 'meet', 'yes'] }); // "meet" makes no sense as an answer to a warning
  assert.equal(h.beat, beat);
  assert.equal(h.misses, 1);
});

test('weapons cost twice, and raising shields makes them wary', () => {
  const g = newGame({ seed: 11 });
  act(g, 'shields');
  assert.equal(g.patience, PATIENCE - 1);
  assert.ok(g.heard.includes('fight'));
  act(g, 'shields');
  assert.equal(g.patience, PATIENCE - 1, 'lowering shields cost patience');
  act(g, { say: ['fight'] });
  assert.equal(g.patience, PATIENCE - 3);
  act(g, { say: ['fight'] });
  assert.equal(g.over, 'hostile');
});

test('Standard is forgiven once, then it costs', () => {
  const g = newGame({ seed: 12 });
  act(g, 'standard');
  assert.equal(g.patience, PATIENCE);
  assert.ok(g.heard.includes('understand') && g.heard.includes('no'));
  act(g, 'standard');
  assert.equal(g.patience, PATIENCE - 1);
});

test('listening again gives another way of putting it, and only wears on them once they run out', () => {
  const g = newGame({ seed: 13 });
  act(g, 'listen');
  act(g, 'listen');
  assert.equal(g.patience, PATIENCE);
  assert.ok(g.heard.includes('you'), 'the second way of saying hello did not come');
  act(g, 'listen');
  assert.equal(g.patience, PATIENCE - 1);
});

test('turning down their offer, or leaving, ends it another way', () => {
  const a = newGame({ seed: 21 });
  act(a, 'standard'); // to hear "no"
  act(a, { say: ['meet'] });
  act(a, { say: [hint(a)] });
  assert.equal(a.beat, 2);
  act(a, { say: ['no'] });
  assert.equal(a.over, 'alone');
  const b = newGame({ seed: 22 });
  act(b, 'leave');
  assert.equal(b.over, 'fled');
  assert.deepEqual(act(b, 'listen'), [], 'it went on after it ended');
});

test('the debrief marks your guesses against what they meant', () => {
  const g = newGame({ seed: 30 });
  g.tags.meet = 'meet';
  g.tags.we = 'you';
  win(g);
  const d = debrief(g);
  assert.equal(d.title, 'First contact');
  assert.equal(d.story, g.lang.phrases.story);
  assert.equal(d.decoded, 1);
  assert.equal(d.of, d.rows.length);
  assert.ok(!d.rows.some(r => r.id === 'story'));
  assert.equal(d.rows.find(r => r.id === 'we').guess, 'you');
  assert.equal(d.fluency, 'Lost in translation');
  for (const r of d.rows) g.tags[r.id] = r.id;
  assert.equal(debrief(g).fluency, 'Fluent');
  assert.ok(d.transcript.length >= 12);
  assert.ok(d.transcript.every(t => t.said.length === t.meant.length));
});
