// First contact, as rules: no drawing and no page, so it can be tested on its own.
// An unknown ship hails you. The universal translator turns their words into ours, but they speak in images from
// their own stories ("Kesh and Ravu at Tavar"), the way the Tamarians did, so what each phrase means has to be worked
// out from when they say it. Each game makes up a new language from its seed: new names, new places, new images.
// The encounter is the same shape every time: they greet you, warn you of a danger, ask you to cross it with them,
// give you a way through, tell you when to wait and when to go. You answer with their own phrases.

export const PATIENCE = 5; // misunderstandings they'll sit through before they give up
export const MAX_REPLY = 3; // phrases in one reply

// What each phrase can mean, in the order the notebook lists them.
export const MEANINGS = [
  ['meet', 'Hello, meeting'],
  ['we', 'We, us'],
  ['you', 'You'],
  ['yes', 'Yes, agreed'],
  ['no', 'No, not'],
  ['see', 'Look, see'],
  ['danger', 'Danger'],
  ['understand', 'Understanding'],
  ['together', 'Together'],
  ['give', 'Giving, a gift'],
  ['wait', 'Wait, hold still'],
  ['go', 'Go, move'],
  ['fight', 'Fighting, weapons'],
];
export const MEANING = Object.fromEntries(MEANINGS);

// Images their stories use for each idea. {A} and {B} are heroes, {P} a place, {H} their home.
const IMAGES = {
  meet: ['{A} and {B} at {P}', '{A} at {P}, the gates open', '{A} and {B}, the bread broken'],
  we: ['the children of {H}', 'the fires of {H}', '{H}, its lamps lit'],
  you: ['{A}, the stranger at the well', 'sails from beyond {P}', '{A}, a guest at {P}'],
  yes: ['{A}, {his} cup raised', '{A}, when the bells rang', '{A} at {P}, the oath sworn'],
  no: ['{A}, the door shut', '{A}, {his} back turned', '{P}, the bridge fallen'],
  see: ['{A} on the tower', '{A}, {his} lantern lifted', '{A} at {P}, the veil drawn'],
  danger: ['{P}, when the sky burned', '{A}, the sea rising', '{P}, the ash falling'],
  understand: ['{A}, {his} eyes open', '{A} at {P}, the riddle answered', '{A}, the map unrolled'],
  together: ['{A} and {B}, back to back', '{A} and {B}, one oar each', '{A} and {B} at {P}, the rope between them'],
  give: ['{A}, {his} hands open', '{A} at {P}, the bowl full', '{A}, {his} cloak given'],
  wait: ['{A} at {P}, the river still', '{A}, {his} breath held', '{A}, the long night'],
  go: ['{A}, {his} sails full', '{A} at {P}, the road open', '{A}, the wind behind {him}'],
  fight: ['{A}, {his} blade drawn', '{A} at {P}, the shields locked', '{A}, {his} fist raised'],
};

// What stands between the two ships and where they're going.
export const DANGERS = {
  storm: {
    name: 'the ion storm',
    pic: 'a wall of blue lightning, light-years long, rolling toward you',
    sensor: 'an ion storm front',
    gift: 'With them, your shields could shrug off the lightning.',
    gap: 'A dark lane opens in the storm.',
  },
  creature: {
    name: 'the creature',
    pic: 'something vast and pale, shaped like a jellyfish the size of a moon, with broken hulls trailing behind it',
    sensor: 'a living thing as big as a moon, which feeds on starship shields',
    gift: 'With them, the creature shouldn’t be able to taste your shields.',
    gap: 'The creature turns aside to feed on a passing comet.',
  },
  mines: {
    name: 'the minefield',
    pic: 'thousands of dark spheres, each with one blinking red light',
    sensor: 'an old minefield, still armed, drifting on the current',
    gift: 'With them, the mines shouldn’t be able to see you.',
    gap: 'A safe path through the mines lights up on your screen: their ship has marked it.',
  },
};

export function rng(seed) {
  let a = seed >>> 0; // mulberry32
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const pick = (r, list) => list[Math.floor(r() * list.length)];

// A new language: its sounds, its heroes and places, and one image for each idea.
export function makeLanguage(seed) {
  const r = rng(seed ^ 0x5eed);
  const shuffle = list => { const a = [...list]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const cons = shuffle(['k', 't', 'v', 'r', 's', 'm', 'n', 'l', 'th', 'd', 'g', 'z', 'sh', 'b', 'p', 'h', 'j', 'kh', 'q', 'f']).slice(0, 9);
  const vows = shuffle(['a', 'e', 'i', 'o', 'u', 'ai', 'ae', 'ou', 'y']).slice(0, 4);
  const codas = shuffle(['n', 'r', 'l', 's', 'k', 'th', 'm']).slice(0, 3);
  const used = new Set();
  const word = () => {
    for (;;) {
      const n = r() < 0.6 ? 2 : r() < 0.7 ? 1 : 3;
      let w = '';
      for (let i = 0; i < n; i++) w += pick(r, cons) + pick(r, vows) + (r() < 0.3 ? pick(r, codas) : '');
      if (n === 1 && !codas.some(c => w.endsWith(c))) w += pick(r, codas);
      w = w[0].toUpperCase() + w.slice(1);
      if (w.length >= 3 && w.length <= 9 && !used.has(w) && !/^(.{2,})\1$/i.test(w)) { used.add(w); return w; }
    }
  };
  const home = word();
  const people = home.replace(/[aeiouy]+$/, '') + pick(r, ['i', 'ari', 'ans', 'en', 'ites']);
  const pronouns = [['his', 'him'], ['her', 'her'], ['their', 'them']];
  const phrases = {};
  for (const [id] of MEANINGS) {
    const [his, him] = pick(r, pronouns);
    phrases[id] = pick(r, IMAGES[id])
      .replace('{A}', word()).replace('{B}', word()).replace('{P}', word()).replace('{H}', home)
      .replaceAll('{his}', his).replace('{him}', him);
    phrases[id] = phrases[id][0].toUpperCase() + phrases[id].slice(1);
  }
  const captain = word();
  const [his, him] = pick(r, pronouns);
  const danger = pick(r, Object.keys(DANGERS));
  // The story they'll tell about this day, if it goes well.
  phrases.story = `${captain} and the stranger at ${word()}`;
  return { seed, home, people, captain, his, him, danger, phrases, look: Math.floor(r() * 2 ** 31) };
}

// The encounter, beat by beat. Each beat has what they say (a few ways, tried in turn when you need to hear it again),
// what answers they hope for (`accept`), what they won't mind hearing alongside (`fits`), answers that end it another
// way (`alt`), and what they say when you get it right.
const BEATS = [
  {
    id: 'hail',
    lines: [
      [['meet', 'we'], 'The ship stops off your bow and opens a channel. Their captain touches {his} own chest while speaking.'],
      [['meet', 'you'], 'The captain spreads both hands toward your viewscreen.'],
      [['we', 'meet', 'you'], 'The captain touches {his} chest, points at you, then clasps both hands together.'],
    ],
    accept: ['meet'], fits: ['we', 'you', 'yes'],
    ok: () => [['yes', 'meet'], 'The captain lifts a cup toward you and drinks. The crew behind {him} relax.'],
  },
  {
    id: 'warn',
    lines: [
      [['see', 'danger'], 'A picture comes through on the channel: {pic}.'],
      [['danger', 'you'], 'The captain points at you, then at the picture, and sweeps a hand across it like a wave breaking.'],
      [['danger', 'we', 'you'], 'Sensors find it: {sensor}, {dist} light-hours off and drifting across both your paths.'],
    ],
    accept: ['understand', 'see', 'yes'], fits: ['danger', 'we', 'you'],
    alt: { no: 'parted', go: 'parted' },
    ok: () => [['understand', 'yes'], 'The captain lets out a long breath and closes {his} eyes for a moment, relieved.'],
  },
  {
    id: 'ask',
    lines: [
      [['we', 'you', 'together'], 'Their ship comes about and slides in alongside yours, close enough to see the lights in her ports.'],
      [['together', 'danger'], 'The captain lays two fingers side by side and runs them through the picture of {name}.'],
      [['see', 'together'], 'A course plot arrives: two ships, one track, straight through {name}.'],
    ],
    accept: ['together', 'yes'], fits: ['we', 'you', 'danger', 'understand', 'go'],
    alt: { no: 'alone' },
    ok: () => [['yes', 'together'], 'Their ship matches your course and speed to the metre.'],
  },
  {
    id: 'give',
    lines: [
      [['we', 'give'], 'A data packet arrives: shield harmonics tuned to {name}. {gift}'],
      [['give', 'you'], 'The captain holds out both hands, palms up.'],
    ],
    accept: ['give', 'yes', 'understand'], fits: ['we', 'you', 'together'],
    ok: g => g.gave
      ? [['yes', 'give'], 'Your engineers send back your own deflector readings. The captain studies them and laughs, a sound like gravel in water.']
      : [['yes'], 'Your engineers load the harmonics. The captain nods once.'],
  },
  {
    id: 'wait',
    lines: [
      [['danger', 'wait'], '{Name} reaches the edge of sensor range. Their engines go dark.'],
      [['wait', 'you'], 'Your helm officer reaches for the throttle. On screen, the captain raises one hand toward you, palm out.'],
    ],
    accept: ['wait', 'yes', 'understand'], fits: ['we', 'you', 'together', 'danger'],
    ok: () => [['wait'], 'Both ships drift with their engines cold while {name} rolls past ahead.'],
  },
  {
    id: 'run',
    lines: [
      [['go', 'together'], '{Gap} Their engines flare.'],
      [['you', 'go'], 'The captain points at you, then throws an arm forward.'],
    ],
    accept: ['go', 'yes', 'together'], fits: ['we', 'you', 'understand'],
    alt: { no: 'alone' },
    ok: () => [['story'], 'Both ships come out the other side. The captain says something new, and the whole crew behind {him} say it back.'],
  },
];
export const BEAT_IDS = BEATS.map(b => b.id);

// Fills in a stage direction for this game.
function say(g, text) {
  const d = DANGERS[g.lang.danger];
  const cap = s => s[0].toUpperCase() + s.slice(1);
  return text.replaceAll('{his}', g.lang.his).replaceAll('{him}', g.lang.him)
    .replace('{pic}', d.pic).replace('{sensor}', d.sensor).replace('{gift}', d.gift).replace('{Gap}', d.gap)
    .replaceAll('{name}', d.name).replaceAll('{Name}', cap(d.name)).replace('{dist}', g.dist);
}

export function newGame({ seed = Date.now() } = {}) {
  const lang = makeLanguage(seed);
  const g = {
    seed, lang, dist: 3 + Math.floor(rng(seed)() * 7),
    beat: 0, tries: [0], patience: PATIENCE, turn: 0, over: null,
    misses: 0, standard: 0, shields: false, gave: false,
    heard: [], // phrase ids in the order you first heard them
    count: {}, // how often each was said
    tags: {}, // your guess at each, by phrase id
    log: [],
  };
  crew(g, 'Communications', 'She’s hailing us. The translator has their words, but not what they mean.');
  them(g, ...BEATS[0].lines[0]);
  g.tries[0] = 1;
  return g;
}

// Something they say: phrase ids and what you see while they say it.
function them(g, ids, act) {
  for (const id of ids) {
    if (!g.heard.includes(id)) g.heard.push(id);
    g.count[id] = (g.count[id] || 0) + 1;
  }
  const line = { who: 'them', ids, act: say(g, act) };
  g.log.push(line);
  return line;
}
function crew(g, who, text, tone) {
  const line = { who, text, tone };
  g.log.push(line);
  return line;
}

export const phrase = (g, id) => g.lang.phrases[id];
export const beat = g => BEATS[g.beat];

// Their next way of putting the current beat. Once they've used them all they start over, and their patience wears.
function again(g, out) {
  const b = BEATS[g.beat];
  const i = g.tries[g.beat] || 0;
  if (i >= b.lines.length) lose(g, out, 'The captain waits, then says it all again, more slowly.');
  if (g.over) return;
  out.push(them(g, ...b.lines[i % b.lines.length]));
  g.tries[g.beat] = i + 1;
}

function lose(g, out, why) {
  if (g.over) return;
  g.patience = Math.max(0, g.patience - 1);
  if (why) out.push(crew(g, 'Communications', why));
  if (g.patience <= 0) end(g, out, g.fought ? 'hostile' : 'silence');
}

function end(g, out, how) {
  g.over = how;
  const d = DANGERS[g.lang.danger];
  const lines = {
    contact: ['Communications', 'They’re sending us their star charts. All of them. I think we’ve made a friend.', 'good'],
    alone: ['Helm', `Their ship is going on alone, into ${d.name}.`, 'bad'],
    parted: ['Helm', 'Their ship is turning away. They’re leaving.', 'bad'],
    silence: ['Communications', 'They’ve closed the channel.', 'bad'],
    hostile: ['Tactical', 'A warning shot, across our bow. They’re going to warp.', 'bad'],
    fled: ['Helm', 'Breaking off. They’re not following.', 'bad'],
  }[how];
  out.push(crew(g, ...lines));
}

// One thing you do. `what` is { say: [phrase ids] }, or 'listen', 'standard', 'shields' or 'leave'.
// Returns the lines it adds to the log.
export function act(g, what) {
  if (g.over) return [];
  const out = [];
  g.turn++;
  if (what === 'listen') {
    out.push(crew(g, 'You', 'You wait and listen.', 'you'));
    again(g, out);
  } else if (what === 'standard') {
    out.push(crew(g, 'You', 'This is a Federation starship. We come in peace. Do you understand me?', 'you'));
    g.standard++;
    out.push(them(g, ['understand', 'no'], g.standard === 1
      ? 'The captain listens politely, then shakes {his} head and spreads {his} hands.'
      : 'The captain’s shoulders drop. {His} crew mutter to each other.'.replace('{His}', g.lang.his[0].toUpperCase() + g.lang.his.slice(1))));
    if (g.standard > 1) lose(g, out);
    if (!g.over) again(g, out);
  } else if (what === 'shields') {
    g.shields = !g.shields;
    out.push(crew(g, 'Tactical', g.shields ? 'Shields up.' : 'Shields down.'));
    if (g.shields) {
      out.push(them(g, ['you', 'fight'], 'Their ship turns its bow toward you. Weapon ports slide open.'));
      g.fought = true;
      lose(g, out);
    } else {
      out.push(crew(g, 'Sensors', 'Their weapon ports close.'));
    }
  } else if (what === 'leave') {
    out.push(crew(g, 'You', 'Break off. Take us out of here.', 'you'));
    end(g, out, 'fled');
  } else if (what && Array.isArray(what.say)) {
    reply(g, what.say.slice(0, MAX_REPLY), out);
  }
  return out;
}

function reply(g, ids, out) {
  ids = ids.filter(id => g.heard.includes(id));
  if (!ids.length) { g.turn--; return; }
  const line = { who: 'you', ids };
  g.log.push(line);
  out.push(line);
  const b = BEATS[g.beat];
  const said = new Set(ids);
  if (said.has('fight')) {
    g.fought = true;
    out.push(them(g, ['fight', 'no'], 'Weapons come up on their ship. The captain shouts the words twice, then waves {his} crew back from their stations.'));
    g.misses++;
    lose(g, out); lose(g, out);
    if (!g.over) again(g, out);
    return;
  }
  const yes = b.accept.some(id => said.has(id));
  const alt = Object.keys(b.alt || {}).find(id => said.has(id));
  const odd = ids.some(id => !b.accept.includes(id) && !b.fits.includes(id) && id !== alt);
  if (alt && !yes && !odd) { end(g, out, b.alt[alt]); return; }
  if (yes && !alt && !odd) {
    if (b.id === 'give' && said.has('give')) g.gave = true;
    out.push(them(g, ...b.ok(g)));
    if (g.beat === BEATS.length - 1) { end(g, out, 'contact'); return; }
    g.beat++;
    g.tries[g.beat] = 0;
    again(g, out);
    return;
  }
  // They didn't follow.
  g.misses++;
  out.push(them(g, ['understand', 'no'], g.misses === 1
    ? 'The captain tilts {his} head and repeats your words back, slowly, like a question.'
    : 'The captain frowns and holds up a hand.'));
  lose(g, out);
  if (!g.over) again(g, out);
}

// The debrief: what happened, what each phrase meant, and how much of it you worked out.
export function debrief(g) {
  const d = DANGERS[g.lang.danger];
  const L = g.lang;
  const ends = {
    contact: ['First contact', `You and the ${L.people} came through ${d.name} side by side. Their captain, ${L.captain}, has a new story to tell, and you’re in it. From now on, this is how the ${L.people} will say that two strangers became friends:`],
    alone: ['Ships passing', `You turned their offer down. The ${L.people} went through ${d.name} alone, and you never learned whether they made it.`],
    parted: ['Strangers still', `They were trying to warn you about ${d.name}, and you left before they could finish. It crossed the space where you’d been holding an hour later.`],
    silence: ['The channel closes', `The ${L.people} gave up trying to make themselves understood. They were warning you about ${d.name}, and asking you to cross it with them.`],
    hostile: ['A warning shot', `Every time weapons came into it, the ${L.people} got more frightened, until they fired across your bow and left. They had been trying to warn you about ${d.name}.`],
    fled: ['Broke off', `You left before you understood them. They were trying to warn you about ${d.name}.`],
  };
  const [title, summary] = ends[g.over] || ['Still talking', ''];
  const rows = g.heard.filter(id => id !== 'story').map(id => ({ id, text: L.phrases[id], meaning: MEANING[id], guess: g.tags[id] || null, right: g.tags[id] === id }));
  const decoded = rows.filter(r => r.right).length;
  const share = rows.length ? decoded / rows.length : 0;
  const fluency = share === 1 ? 'Fluent' : share >= 0.75 ? 'Conversational' : share >= 0.4 ? 'Halting' : 'Lost in translation';
  const transcript = g.log.filter(l => l.ids).map(l => ({ who: l.who, said: l.ids.map(id => L.phrases[id]), meant: l.ids.map(id => (id === 'story' ? 'A new story: the day you met' : MEANING[id])) }));
  return { title, summary, outcome: g.over, people: L.people, captain: L.captain, story: g.over === 'contact' ? L.phrases.story : null, rows, decoded, of: rows.length, fluency, transcript, misses: g.misses, turns: g.turn };
}

// A right answer for where things stand, from what you've heard so far. For the tests and the page's hook.
export function hint(g) {
  if (g.over) return null;
  return BEATS[g.beat].accept.find(id => g.heard.includes(id)) || null;
}
