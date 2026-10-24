// The xenobiology lab's rules: from a planet class and a seed, the conditions where a creature lives there, the body
// those conditions would push it toward, and the field notes that explain why. Pure, so test/xeno.test.mjs can run it.
// The art is in js/xeno-art.js; this only decides what to draw.
import { byId, label } from './classes.js';

// Where life could live on each kind of world, and what the air is like there.
// `habitats` is drawn from at random (repeat one to make it likelier). `pressure` is in Earth atmospheres where it lives.
// `temp` overrides the class's surface temperature for habitats that aren't on the surface, in kelvin.
// `stars` are the kinds of star it might circle; `odds` is how seriously to take the result.
// `gas` marks hydrogen air, which is far lighter than ours for the same pressure.
export const WORLDS = {
  M: { habitats: ['land', 'land', 'land', 'sea'], pressure: [0.7, 1.6], stars: ['yellow', 'orange', 'red'], odds: 'likely', place: ['meadow', 'forest', 'river'] },
  L: { habitats: ['plant'], pressure: [0.6, 1.0], stars: ['yellow', 'orange', 'red'], odds: 'likely', place: ['grassland', 'forest'] },
  K: { habitats: ['burrow', 'burrow', 'land'], pressure: [0.006, 0.03], stars: ['yellow', 'orange', 'red'], odds: 'long', place: ['crater', 'rust plain'] },
  H: { habitats: ['land', 'land', 'burrow'], pressure: [0.7, 1.3], stars: ['yellow', 'orange', 'red'], odds: 'likely', place: ['dune', 'salt flat', 'mesa'] },
  N: { habitats: ['cloud'], pressure: [0.5, 1.2], temp: [290, 340], stars: ['yellow', 'orange'], odds: 'long', place: ['cloud deck'] },
  O: { habitats: ['sea', 'sea', 'sea', 'land'], pressure: [1, 3], stars: ['yellow', 'orange', 'red'], odds: 'likely', place: ['reef', 'shallows', 'open ocean'] },
  P: { habitats: ['under-ice', 'under-ice', 'land'], pressure: [0.2, 0.6], stars: ['yellow', 'orange', 'red'], odds: 'possible', place: ['tundra', 'ice shelf'] },
  D: { habitats: ['rock'], pressure: [0, 0], stars: ['yellow', 'orange', 'red'], odds: 'long', place: ['crater rim', 'regolith'] },
  Y: { habitats: ['rock', 'land'], pressure: [4, 20], stars: ['yellow', 'orange', 'red'], odds: 'wild', place: ['caldera', 'ash field'] },
  J: { habitats: ['cloud'], pressure: [2, 6], temp: [270, 330], stars: ['yellow', 'orange', 'red'], gas: true, odds: 'long', place: ['cloud band', 'storm edge'] },
  T: { habitats: ['cloud'], pressure: [2, 6], temp: [270, 330], stars: ['yellow', 'orange', 'red'], gas: true, odds: 'wild', place: ['cloud band'] },
  R: { habitats: ['under-ice'], pressure: [0, 0], temp: [273, 290], stars: ['none'], odds: 'possible', place: ['vent field'] },
  'super-earth': { habitats: ['land', 'land', 'sea'], pressure: [1.5, 6], stars: ['orange', 'red', 'red'], odds: 'possible', place: ['basin', 'steppe', 'coast'] },
  'sub-neptune': { habitats: ['sea'], pressure: [10, 60], temp: [280, 330], stars: ['orange', 'red', 'red'], gas: true, odds: 'long', place: ['deep ocean'] },
  'lava-world': { habitats: ['rock'], pressure: [0, 0.01], temp: [600, 950], stars: ['yellow', 'orange', 'red'], odds: 'wild', place: ['night side'] },
  'hot-jupiter': { habitats: ['cloud'], pressure: [0.5, 2], temp: [900, 1300], stars: ['yellow', 'orange'], gas: true, odds: 'wild', place: ['night-side clouds'] },
  'ice-giant': { habitats: ['sea'], pressure: [200, 2000], temp: [280, 360], stars: ['yellow', 'orange', 'red'], gas: true, odds: 'wild', place: ['water mantle'] },
};

export const ODDS = {
  likely: 'Plausible. Earth is proof that this kind of place can grow animals like it.',
  possible: 'Possible. Earth has animals that live in places like this, though none started out there.',
  long: 'A long shot. Some scientists have argued for life here, but nobody expects much.',
  wild: 'Pure speculation. Nothing on Earth could survive here, so the lab is guessing at a different chemistry.',
};

export const STARS = {
  yellow: { name: 'a yellow star like the Sun', color: [255, 244, 214] },
  orange: { name: 'an orange dwarf', color: [255, 196, 128] },
  red: { name: 'a red dwarf', color: [255, 120, 80] },
  none: { name: 'no star at all', color: null },
};

// ---------- Randomness ----------

export function rng(seed) { // mulberry32, as in js/planet-art.js
  let a = seed >>> 0;
  return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const lerp = (a, b, t) => a + (b - a) * t;
const pick = (r, list) => list[Math.floor(r() * list.length)];
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

// ---------- Numbers in words ----------

export function gText(g) { return g >= 10 ? `${Math.round(g)} g` : `${g.toFixed(g < 1 ? 2 : 1).replace(/\.?0+$/, '')} g`; }
export function sizeText(m) {
  if (m >= 1000) return `${(m / 1000).toFixed(m >= 10000 ? 0 : 1).replace(/\.0$/, '')} km`;
  if (m >= 1) return `${m.toFixed(m >= 10 ? 0 : 1).replace(/\.0$/, '')} m`;
  if (m >= 0.01) return `${Math.round(m * 100)} cm`;
  return `${Math.max(0.1, m * 1000).toFixed(m >= 0.001 ? 0 : 1)} mm`;
}
function times(x) {
  if (x >= 10) return `${Math.round(x)} times`;
  if (x >= 1.95) return `${x.toFixed(1).replace(/\.0$/, '')} times`;
  return `${Math.round(x * 100)}% of`;
}
const celsius = k => Math.round(k - 273.15);
const signed = n => (n < 0 ? `−${-n}` : String(n));
export const tempText = k => `${Math.round(k)} K (${signed(celsius(k))} °C)`;
function pressureText(p) {
  if (p === 0) return 'none';
  if (p < 0.05) return `about ${p < 0.01 ? 'a hundredth' : 'a fiftieth'} of Earth’s`;
  if (p >= 1.9) return `${Math.round(p)} times Earth’s`;
  return `${Math.round(p * 100)}% of Earth’s`;
}

// ---------- The creature ----------

// Everything about one creature, decided from its class and seed alone: grow('M', 7) is always the same animal.
export function grow(classId, seed) {
  const cls = byId.get(classId);
  const W = WORLDS[classId];
  if (!cls || !W) throw new Error(`No such class: ${classId}`);
  const r = rng(hash(classId) ^ seed);
  const t = cls.typical;

  // The world: width and mass rise together, so the gravity stays near what that kind of planet really has.
  const k = r();
  const width = lerp(t.width[0], t.width[1], clamp(k + (r() - 0.5) * 0.3, 0, 1));
  const mass = lerp(t.mass[0], t.mass[1], k);
  const g = mass / (width * width);
  const habitat = pick(r, W.habitats);
  const temp = lerp(...(W.temp || (habitat === 'under-ice' ? [273, 283] : t.temp)), r());
  const pressure = lerp(W.pressure[0], W.pressure[1], r());
  const star = pick(r, W.stars);
  const dark = star === 'none' || habitat === 'under-ice' || (habitat === 'sea' && W.gas) || (habitat === 'burrow' && r() < 0.5);
  // Air's density against Earth's at sea level: pressure over temperature, and hydrogen weighs a fourteenth of our air.
  const density = pressure * (288 / temp) * (W.gas ? 2.3 / 29 : 1);
  const chem = temp > 450 ? 'silicon' : W.gas && habitat === 'sea' && temp > 300 && classId === 'ice-giant' ? 'ammonia' : temp < 255 && habitat !== 'under-ice' ? 'brine' : 'water';
  const env = { width, mass, g, habitat, temp, pressure, density, star, dark, chem, place: placeFor(classId, habitat, W, r), gas: !!W.gas };

  const body = shape(env, classId, r);
  const name = names(env, body, classId, r);
  return { cls, classId, seed, env, body, name, notes: notes(env, body, cls), odds: W.odds };
}

function placeFor(classId, habitat, W, r) {
  if (habitat === 'under-ice') return pick(r, ['vent', 'sub-ice']);
  if (habitat === 'sea' && !['O', 'sub-neptune', 'ice-giant'].includes(classId)) return pick(r, ['reef', 'kelp', 'shallows']);
  return pick(r, W.place);
}

function hash(s) { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }

function shape(env, classId, r) {
  const { g, habitat, temp, pressure, density, star, dark, chem } = env;
  const b = { plan: 'walker', legs: 0, eyes: 2, eyeSize: 1, covering: 'skin', sail: false, sacs: false, armor: false, wings: false, glow: false, feelers: false, tail: r() < 0.7, crystals: false };

  // How easily something could fly: thicker air holds it up, stronger gravity pulls it down.
  const lift = density / g;
  if (habitat === 'land') b.plan = lift > 1.8 && pressure > 1.2 ? 'flyer' : 'walker';
  else if (habitat === 'sea' || habitat === 'under-ice') b.plan = 'swimmer';
  else if (habitat === 'cloud') b.plan = 'floater';
  else if (habitat === 'burrow') b.plan = 'burrower';
  else if (habitat === 'plant') b.plan = 'plant';
  else if (habitat === 'rock') b.plan = 'crawler';

  // Size: on land the square-cube law caps it, roughly with 1/g. Water and gas hold a body up, so those can be huge.
  const u = r();
  if (b.plan === 'walker') b.size = clamp(lerp(0.4, 2.6, u) / Math.pow(g, 1.1), 0.05, 8);
  else if (b.plan === 'flyer') b.size = clamp(lerp(0.6, 3, u) * Math.sqrt(lift / 2), 0.3, 12);
  else if (b.plan === 'swimmer') b.size = lerp(0.5, dark ? 6 : 18, u * u);
  else if (b.plan === 'floater') b.size = lerp(20, 900, u * u) / Math.sqrt(g);
  else if (b.plan === 'burrower') b.size = lerp(0.15, 1.4, u) / Math.sqrt(g);
  else if (b.plan === 'plant') b.size = clamp(lerp(1, 30, u * u) / g, 0.2, 60);
  else b.size = chem === 'silicon' ? lerp(0.6, 2.5, u) : lerp(0.0005, 0.004, u); // a Horta, or a tardigrade

  // Legs: more of them, and thicker, as gravity rises. Thick-set or lanky to match.
  if (b.plan === 'walker') {
    b.legs = g >= 2.2 ? 8 : g >= 1.4 ? 6 : g < 0.6 ? 2 : pick(r, [2, 4, 4, 6]);
    b.build = g >= 1.4 ? 'squat' : g < 0.7 ? 'lanky' : 'even';
  } else if (b.plan === 'flyer') { b.legs = 2; b.build = 'lanky'; b.wings = true; }
  else if (b.plan === 'crawler') { b.legs = chem === 'silicon' ? 0 : 8; b.build = 'squat'; }
  else if (b.plan === 'floater') b.build = g >= 6 ? 'squat' : 'even';
  else if (b.plan === 'swimmer') b.build = pick(r, ['squat', 'even', 'even', 'lanky']);
  else b.build = g >= 1.6 ? 'squat' : g < 0.7 ? 'lanky' : 'even';

  // Eyes follow the light: none in the dark, huge under a dim red sun, small and shaded under a fierce one.
  if (dark) { b.eyes = 0; b.feelers = true; b.glow = b.plan === 'swimmer' || r() < 0.4; }
  else if (b.plan === 'plant') b.eyes = 0;
  else if (star === 'red') { b.eyes = pick(r, [2, 2, 4]); b.eyeSize = 1.7; }
  else if (star === 'orange') { b.eyes = pick(r, [2, 2, 3]); b.eyeSize = 1.3; }
  else { b.eyes = pick(r, [2, 2, 2, 4]); b.eyeSize = temp > 300 && habitat === 'land' ? 0.75 : 1; }
  if (b.plan === 'crawler' && chem !== 'silicon') b.eyes = 0;

  // Skin: what to wear against cold, heat, thin air and hard radiation.
  if (chem === 'silicon') { b.covering = 'crystal'; b.crystals = true; }
  else if (b.plan === 'floater') b.covering = 'jelly';
  else if (b.plan === 'swimmer') b.covering = dark ? 'pale' : 'smooth';
  else if (b.plan === 'plant') b.covering = 'leaf';
  else if (b.plan === 'crawler') b.covering = 'skin';
  else if (temp < 262) b.covering = 'fur';
  else if (temp > 310 || star === 'red' || classId === 'Y') b.covering = 'scales';
  b.sail = (b.plan === 'walker') && temp > 305 && chem !== 'silicon';
  b.sacs = (b.plan === 'walker' || b.plan === 'burrower') && pressure < 0.1;
  b.armor = classId === 'Y' || (star === 'red' && b.plan === 'walker' && r() < 0.5);
  if (b.plan === 'floater' || b.plan === 'burrower' || b.plan === 'plant') b.tail = false;

  // Colour, as a hue and lightness, from what it has to soak up or hide against.
  if (dark) b.color = { h: lerp(180, 260, r()), s: 20, l: 78 };
  else if (chem === 'silicon') b.color = { h: lerp(20, 50, r()), s: 30, l: 62 };
  else if (star === 'red') b.color = { h: lerp(270, 330, r()), s: 30, l: 22 };
  else if (star === 'orange') b.color = { h: lerp(8, 30, r()), s: 55, l: 42 };
  else if (habitat === 'sea' || habitat === 'cloud') b.color = { h: lerp(170, 220, r()), s: 50, l: 52 };
  else if (temp > 300) b.color = { h: lerp(30, 45, r()), s: 45, l: 62 };
  else b.color = { h: lerp(80, 140, r()), s: 40, l: 38 };
  if (b.plan === 'plant' && star === 'yellow') b.color = { h: lerp(95, 130, r()), s: 50, l: 34 };
  if (b.covering === 'fur') b.color.l = Math.max(b.color.l, 70);
  b.accent = (b.color.h + lerp(150, 210, r())) % 360;
  b.wobble = r();
  return b;
}

// ---------- Names ----------

const EPITHET = {
  M: 'minsharae', L: 'marginalis', K: 'adaptabilis', H: 'deserti', N: 'venerea', O: 'pelagica', P: 'glacialis', D: 'planetoidea',
  Y: 'daemonis', J: 'jovialis', T: 'ultragigantea', R: 'erratica', 'super-earth': 'gravis', 'sub-neptune': 'nebulosa',
  'lava-world': 'ignea', 'hot-jupiter': 'torrida', 'ice-giant': 'caerulea',
};
const ENDING = { walker: 'podus', flyer: 'pteryx', swimmer: 'ichthys', floater: 'physa', burrower: 'oryctes', plant: 'phyton', crawler: 'tardus' };
const NOUN = {
  walker: { squat: 'lumberer', even: 'grazer', lanky: 'strider' },
  flyer: { lanky: 'glider' }, swimmer: { squat: 'ray', even: 'swimmer', lanky: 'eel' }, floater: { squat: 'sail', even: 'drifter', lanky: 'drifter' },
  burrower: { squat: 'borer', even: 'burrower', lanky: 'worm' }, plant: { squat: 'mat', even: 'frond', lanky: 'spire' }, crawler: { squat: 'creeper' },
};

function names(env, b, classId, r) {
  const root = b.crystals ? 'Litho' : env.dark ? 'Nycto' : env.g >= 1.6 ? 'Bary' : env.g < 0.6 ? 'Lepto' : env.temp > 320 ? 'Pyro' : env.temp < 262 ? 'Cryo'
    : env.star === 'red' ? 'Erythro' : b.plan === 'swimmer' ? 'Thalasso' : b.plan === 'floater' ? 'Nephelo' : pick(r, ['Xeno', 'Neo', 'Allo']);
  const look = b.crystals ? 'Glassy' : b.glow ? 'Lantern' : b.covering === 'fur' ? 'Shaggy' : b.armor ? 'Armoured' : b.sail ? 'Sail-backed'
    : env.star === 'red' && !env.dark ? 'Black' : env.dark ? 'Pale' : b.eyes >= 3 ? `${b.eyes === 3 ? 'Three' : 'Four'}-eyed` : b.covering === 'jelly' ? 'Glassy' : pick(r, ['Common', 'Spotted', 'Lesser', 'Greater']);
  const noun = NOUN[b.plan][b.build] || Object.values(NOUN[b.plan])[0];
  return { genus: root + ENDING[b.plan], species: EPITHET[classId], common: `${look} ${env.place} ${noun}` };
}

// ---------- Field notes ----------

const NUM = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'];

function notes(env, b, cls) {
  const { g, temp, pressure, density, star, dark, chem, habitat } = env;
  const out = [];
  const gs = gText(g);

  // Gravity
  let gt;
  if (b.plan === 'flyer') {
    gt = `At ${gs} its weight would pin a walker down, but the air is so thick it holds a light body up. Hollow bones keep it light, and its wings span about ${sizeText(b.size)}.`;
  } else if (b.plan === 'walker') {
    if (g >= 1.4) gt = `At ${gs} it weighs ${times(g)} what it would on Earth. It keeps low on ${NUM[b.legs]} thick legs set wide apart, like an elephant’s pillars, because a heavier body needs fatter bones. A fall here would hurt, so it never runs.`;
    else if (g < 0.7) gt = `At ${gs} it weighs only ${times(g)} what it would on Earth, so ${NUM[b.legs]} thin legs hold it up and it can grow tall. Long strides and big bounds cost it little.`;
    else gt = `At ${gs}, close to Earth’s pull, it stands on ${NUM[b.legs]} legs much like an Earth animal its size.`;
    gt += ` It stands about ${sizeText(b.size)} tall.`;
  } else if (b.plan === 'swimmer') {
    gt = `Water holds it up, so the ${gs} pull barely shapes it. That is why the biggest animal Earth ever grew, the blue whale, lives in the sea. This one is about ${sizeText(b.size)} long.`;
  } else if (b.plan === 'floater') {
    gt = g >= 6
      ? `At ${gs} anything that sinks is crushed and cooked in the deeps below. It spreads into a thin, wide disc of warm gas, ${sizeText(b.size)} across, to hang on the rising air.`
      : `There is no ground: anything that sinks too far is crushed and cooked. At ${gs} it stays up as a gas bag ${sizeText(b.size)} across, filled with hydrogen it warms itself, like a hot-air balloon.`;
  } else if (b.plan === 'burrower') {
    gt = `Digging means pushing, not lifting, so the ${gs} pull matters less underground. It is about ${sizeText(b.size)} long and shoves soil aside with a hard, shovel-shaped head.`;
  } else if (b.plan === 'plant') {
    gt = `Plants here hold themselves up against ${gs}. ${g > 1.2 ? 'Stronger gravity keeps them low and stout' : g < 0.8 ? 'Weak gravity lets them grow tall and slender' : 'That is close to Earth’s, so they grow to about Earth’s heights'}: this one reaches ${sizeText(b.size)}.`;
  } else {
    gt = b.crystals
      ? `At ${gs} it hugs the rock in a low dome about ${sizeText(b.size)} across, with no legs at all: it moves by dissolving the stone in front of it.`
      : `At ${gs} it barely weighs anything, but at ${sizeText(b.size)} long it has no need for strength. It clings to grains of dust with ${NUM[b.legs]} stubby, clawed legs.`;
  }
  out.push({ k: 'gravity', label: `Gravity · ${gs}`, text: gt });

  // Air
  let at;
  if (pressure === 0) {
    at = habitat === 'under-ice'
      ? 'No air reaches the ocean under the ice. It takes dissolved oxygen and chemicals from the water through feathery gills.'
      : 'There is no air at all. It doesn’t breathe: when conditions turn bad it dries out into a dormant husk and waits, the way Earth’s tardigrades survive even open space.';
  } else if (habitat === 'sea' || habitat === 'under-ice') {
    at = env.gas
      ? `Above its ocean is a thick hydrogen sky at ${pressureText(pressure)} pressure. The water below is warm and dark, and it breathes through gills.`
      : 'It breathes through gills, pulling oxygen from the water as Earth’s fish do.';
  } else if (pressure < 0.1 && b.plan === 'crawler') {
    at = `The air is barely there, ${pressureText(pressure)}. It doesn’t breathe at all: its rock body takes what it needs from the stone it eats.`;
  } else if (pressure < 0.1) {
    at = `The air is ${pressureText(pressure)}. A barrel chest and breathing sacs along its back pull in what little there is, and it seals its nostrils when the dust blows.`;
  } else if (b.plan === 'flyer') {
    at = `The air is ${times(density)} as dense as Earth’s and the pull is gentle, so flying is cheap. It has broad wings and spends most of its life aloft.`;
  } else if (b.plan === 'floater') {
    at = env.gas
      ? `The air is hydrogen and helium at ${pressureText(pressure)} pressure. It eats the organic specks that drift down from above, like plankton.`
      : `It lives in the layer of cloud where the pressure is ${pressureText(pressure)} and the temperature is mild, far above the crushing surface. The droplets around it are sulfuric acid, so its skin has to resist acid.`;
  } else if (density > 2) {
    at = `The air is ${times(density)} as dense as Earth’s. It needs only small lungs, and sounds carry far, so it calls more than it looks.`;
  } else {
    at = `The air is ${pressureText(pressure)} pressure${pressure > 0.6 && pressure < 1.6 ? ', close to Earth’s,' : ''} and it breathes it much as we do.`;
  }
  out.push({ k: 'air', label: pressure === 0 ? 'Air · none' : `Air · ${pressure >= 1.9 ? Math.round(pressure) : pressure.toFixed(pressure < 0.1 ? 3 : 1)} atm`, text: at });

  // Light
  let lt;
  if (star === 'none') lt = 'With no star, the only light is what living things make. It has no eyes; long feelers taste the water, and it flashes patterns of its own light to find others.';
  else if (dark) lt = `Its world circles ${STARS[star].name}, but no sunlight reaches where it lives. It has no eyes and finds its way with feelers${b.glow ? ', and it carries its own glowing lure' : ''}.`;
  else if (b.plan === 'crawler' && !b.eyes) lt = `Its world circles ${STARS[star].name}, but at its size eyes are no use: it feels its way grain by grain.${star === 'red' ? ' Its dark skin soaks up what warmth the dim red light brings.' : ''}`;
  else if (b.plan === 'plant') lt = star === 'red'
    ? 'A red dwarf gives off most of its light as infrared. To catch as much of it as possible the leaves here are nearly black, not green.'
    : star === 'orange' ? 'An orange star’s light is redder than the Sun’s, so the leaves here may be orange-red, soaking up the colours there are most of.' : 'Under a Sun-like star the leaves are green, like Earth’s.';
  else if (star === 'red') lt = `Its world circles a red dwarf, whose light is dim and mostly infrared. ${b.eyes > 2 ? `It has ${NUM[b.eyes]} huge eyes that` : 'Its huge eyes'} see heat, and its skin is almost black to soak up warmth.${b.armor ? ' Red dwarfs flare, so it grew a shell against the bursts of radiation.' : ''}`;
  else if (star === 'orange') lt = `An orange dwarf’s light is softer and redder than the Sun’s, so its ${b.eyes > 2 ? `${NUM[b.eyes]} ` : ''}eyes are large and tuned toward red.`;
  else lt = b.eyeSize < 1 ? 'Under a fierce Sun-like star its eyes are small, set deep under a heavy brow, with a clear inner eyelid against the glare.' : `Under a Sun-like star it sees much as we do, with ${NUM[b.eyes]} forward-facing eyes.`;
  out.push({ k: 'light', label: `Light · ${star === 'none' ? 'none' : dark ? 'dark' : STARS[star].name.replace(/^an? /, '').replace(/ like the Sun$/, '')}`, text: lt });

  // Heat and chemistry
  let ht;
  if (chem === 'silicon') ht = `At ${tempText(temp)} water can’t stay liquid, so it can’t be built like us. The lab guesses at a body of silicon, like rock, and like Star Trek’s Horta.`;
  else if (b.plan === 'crawler') ht = `With no air to hold heat, the ground swings from baking to freezing between day and night, around ${tempText(temp)} on average. It rides out the extremes dried up and dormant.`;
  else if (chem === 'ammonia') ht = 'Deep in an ice giant, water mixes with ammonia under huge pressure. Its blood would be part ammonia, which keeps it liquid.';
  else if (temp < 262 && habitat !== 'under-ice') ht = `At ${tempText(temp)} it lives with frost. ${b.covering === 'fur' ? 'Thick fur and a layer of fat keep it warm, and' : ''} its blood is salty enough not to freeze${chem === 'brine' ? ', like the brines that may seep under Mars' : ''}.`;
  else if (habitat === 'under-ice') ht = `The water is about ${tempText(temp)}, kept liquid by heat from the planet’s core. It gathers around hot vents on the sea floor, as tube worms do on Earth.`;
  else if (b.plan === 'floater') ht = `It rides at the height where it is about ${tempText(temp)}, warm enough for water droplets to stay liquid. Too high it freezes, too low it cooks, so it spends its life adjusting how much gas it holds.`;
  else if (temp > 305 && b.sail) ht = `At ${tempText(temp)} its problem is shedding heat. The sail on its back is full of blood vessels and works as a radiator, and it rests in the shade by day.`;
  else if (temp > 305) ht = `At ${tempText(temp)} it keeps cool with a pale skin that reflects light, and it does its moving at night.`;
  else if (temp < 283) ht = `At ${tempText(temp)} it lives in the cold, near freezing. A thick layer of fat under its skin keeps it warm, like a seal’s blubber.`;
  else ht = `At ${tempText(temp)}, mild by Earth’s standards, it needs no special tricks against heat or cold.`;
  out.push({ k: 'heat', label: `Heat · ${signed(celsius(temp))} °C`, text: ht });

  return out;
}

export function summary(c) {
  return `${c.name.common} (${c.name.genus} ${c.name.species}), grown for ${label(c.cls)}`;
}
