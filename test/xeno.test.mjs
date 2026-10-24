// The xenobiology lab's rules: the same seed grows the same creature, every class grows something sensible,
// and the body follows the world (gravity, light, air) the way the field notes say.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { grow, WORLDS } from '../js/xeno-gen.js';
import { CLASSES, byId } from '../js/classes.js';
import { SPECIMENS, specimensFor } from '../js/species.js';

const SEEDS = Array.from({ length: 300 }, (_, i) => i * 37 + 1);
const all = CLASSES.flatMap(c => SEEDS.map(s => grow(c.id, s)));

test('every planet class has lab rules', () => {
  for (const c of CLASSES) assert.ok(WORLDS[c.id], `no lab rules for ${c.id}`);
  assert.deepEqual(Object.keys(WORLDS).sort(), CLASSES.map(c => c.id).sort());
});

test('the same class and seed always grow the same creature', () => {
  assert.deepEqual(grow('M', 482), grow('M', 482));
  assert.notDeepEqual(grow('M', 482).name, grow('M', 483).name);
});

test('every creature has a name, a size and four readable field notes', () => {
  for (const c of all) {
    assert.ok(c.name.common && c.name.genus && c.name.species, `${c.classId} ${c.seed} has no name`);
    assert.ok(c.body.size > 0 && Number.isFinite(c.body.size), `${c.classId} ${c.seed} has size ${c.body.size}`);
    assert.equal(c.notes.length, 4);
    for (const n of c.notes) assert.doesNotMatch(n.text + n.label, /undefined|NaN|null|Infinity/, `${c.classId} ${c.seed}: ${n.text}`);
  }
});

test('Class L grows plants, since it has no animals', () => {
  for (const c of all.filter(c => c.classId === 'L')) assert.equal(c.body.plan, 'plant');
});

test('gas giants grow floaters, and a rogue planet grows things without eyes', () => {
  for (const c of all.filter(c => ['J', 'T', 'hot-jupiter', 'N'].includes(c.classId))) assert.equal(c.body.plan, 'floater');
  for (const c of all.filter(c => c.classId === 'R')) assert.equal(c.body.eyes, 0);
});

test('stronger gravity means more legs and a smaller walker', () => {
  const walkers = all.filter(c => c.body.plan === 'walker');
  for (const c of walkers) {
    if (c.env.g >= 2.2) assert.equal(c.body.legs, 8);
    if (c.env.g < 0.6) assert.equal(c.body.legs, 2);
  }
  const mean = list => list.reduce((s, c) => s + c.body.size, 0) / list.length;
  const heavy = walkers.filter(c => c.env.g >= 1.6), light = walkers.filter(c => c.env.g < 0.9);
  assert.ok(heavy.length > 10 && light.length > 10);
  assert.ok(mean(heavy) < mean(light), 'heavy-gravity walkers are not smaller');
});

test('eyes follow the light', () => {
  for (const c of all) {
    if (c.env.dark) assert.equal(c.body.eyes, 0, `${c.classId} ${c.seed} has eyes in the dark`);
    if (!c.env.dark && c.env.star === 'red' && c.body.eyes) assert.ok(c.body.eyeSize > 1.5);
  }
});

test('water can’t be the chemistry above 450 K', () => {
  for (const c of all.filter(c => c.env.temp > 450)) assert.equal(c.env.chem, 'silicon');
});

test('every reference specimen belongs to a real class, and every class has one', () => {
  for (const s of SPECIMENS) {
    assert.ok(byId.has(s.cls), `${s.name}: no class ${s.cls}`);
    for (const a of s.also || []) assert.ok(byId.has(a), `${s.name}: no class ${a}`);
  }
  for (const c of CLASSES) assert.ok(specimensFor(c.id).length > 0, `nothing on file for ${c.id}`);
});
