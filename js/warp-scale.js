// The warp scale explorer's numbers: the places on the ladder from the Moon to Andromeda, the ships racing there, how
// long each takes, and the race clock. Pure, so test/warp.test.mjs can check it without a browser.
import { warpSpeed, plural, formatYear } from './physics.js';
import { readings, planetAt, earthAt, moonAt, jdOf, C_KM_S } from './ephemeris.js';

export const AU_PER_LY = 63241.1;
export const SECONDS_PER_YEAR = 31557600; // a Julian year, the one light years are measured in
const LIGHT_SECOND_LY = 1 / SECONDS_PER_YEAR;

// The ships in the race, fastest first. Warp 1 is the speed of light exactly: that's how the scale is defined.
// "custom" is whatever warp factor the slider is at.
export const LANES = [
  { id: 'w9975', label: 'Warp 9.975', warp: 9.975, note: 'Voyager’s top cruising speed', color: '#ffb54a' },
  { id: 'custom', label: 'Your warp', warp: 9, note: 'Set it below', color: '#c9a2ff' },
  { id: 'w5', label: 'Warp 5', warp: 5, note: 'Starfleet’s speed limit after Force of Nature', color: '#86d8ff' },
  { id: 'w1', label: 'Warp 1', warp: 1, note: 'Light itself, and the Phoenix’s first flight in 2063', color: '#f4f7ff' },
  { id: 'voyager', label: 'Voyager 1', kmS: 16.9, note: 'The fastest thing leaving the Solar System', color: '#6fe3a4' },
];

export const GROUPS = [
  ['home', 'The Solar System'],
  ['near', 'Neighbours'],
  ['galaxy', 'The Milky Way'],
  ['beyond', 'Further out'],
];

// The places, nearest first. Stars use the same catalogue distances as the bridge, so the helm agrees. The Solar
// System's distances change, so `live` works them out for a date from the same orbits Long missions uses.
// `course` is the star's name in the catalogue, for Set course on the bridge.
export const PLACES = [
  {
    id: 'moon', name: 'The Moon', group: 'home', color: '#d8d4cc', kind: 'moon',
    live: jd => Math.hypot(...moonAt(jd)) / C_KM_S * LIGHT_SECOND_LY,
    about: 'About 1.3 light-seconds away. The Apollo crews took three days to get there.',
    trek: 'Starships don’t go to warp this close to a planet. This is what impulse engines are for.',
  },
  {
    id: 'mars', name: 'Mars', group: 'home', color: '#e0805a', kind: 'planet',
    live: jd => fromEarth('mars', jd),
    about: 'Anywhere from 3 to 22 light-minutes, depending on where the two planets are in their orbits. That’s why a rover on Mars can’t be driven with a joystick.',
    trek: 'The Utopia Planitia Fleet Yards, where the Enterprise-D and Voyager were built, orbit Mars.',
  },
  {
    id: 'sun', name: 'The Sun', group: 'home', color: '#ffd27a', kind: 'star',
    live: jd => Math.hypot(...earthAt(jd)) / AU_PER_LY,
    about: 'Sunlight is about 8 minutes 20 seconds old when it reaches you.',
    trek: 'In The Voyage Home, the Bird-of-Prey whips round the Sun at high warp to travel back in time.',
  },
  {
    id: 'jupiter', name: 'Jupiter', group: 'home', color: '#d9b48c', kind: 'planet',
    live: jd => fromEarth('jupiter', jd),
    about: 'Between 35 and 52 light-minutes away. Juno took five years to get there.',
    trek: 'Jupiter Station, where Dr. Lewis Zimmerman wrote the Emergency Medical Hologram, orbits here.',
  },
  {
    id: 'pluto', name: 'Pluto', group: 'home', color: '#cdb59a', kind: 'planet',
    live: jd => fromEarth('pluto', jd),
    about: 'Nearly five light-hours away. New Horizons, the fastest probe ever launched, took nine and a half years to fly past it.',
    trek: 'In The First Duty, Wesley Crusher’s squadron crashes on a training flight near Saturn, about a quarter of the way out here.',
  },
  {
    id: 'voyager', name: 'Voyager 1', group: 'home', color: '#6fe3a4', kind: 'probe',
    live: jd => readings('v1', jd).earthAU / AU_PER_LY,
    about: 'The farthest thing people have made, launched in 1977. Around the end of 2026 it reaches one light-day from Earth.',
    trek: 'In The Motion Picture, V’Ger turns out to be Voyager 6, coming home three centuries later.',
  },
  {
    id: 'oort', name: 'The Oort cloud’s edge', group: 'home', ly: 100000 / AU_PER_LY, color: '#9fb6d8', kind: 'cloud',
    about: 'The comets’ home, so far out the Sun barely holds on to them. Voyager 1 won’t reach even the inside of the cloud for about 300 years.',
  },
  {
    id: 'proxima', name: 'Proxima Centauri', group: 'near', ly: 4.23, color: '#ff9a6a', kind: 'star', course: 'Proxima Centauri',
    about: 'The nearest star. Breakthrough Starshot hopes to send probes the weight of a paperclip here at a fifth of light speed, in about 20 years.',
    trek: 'Zefram Cochrane’s Phoenix first broke the warp barrier in 2063. At warp 1 she’d have reached here in just over four years.',
  },
  {
    id: 'wolf', name: 'Wolf 359', group: 'near', ly: 7.8, color: '#ff8a5c', kind: 'star', course: 'Wolf 359',
    about: 'A dim red dwarf, one of the closest stars to the Sun, and far too faint to see without a telescope.',
    trek: 'Where the Borg destroyed 39 Starfleet ships in 2367, with Picard as Locutus.',
  },
  {
    id: 'vulcan', name: '40 Eridani A', group: 'near', ly: 16.26, color: '#ffc98a', kind: 'star', course: 'Keid',
    about: 'An orange dwarf a little smaller than the Sun, in a triple system you can see from Earth with your eyes.',
    trek: 'Star Trek puts Vulcan in orbit round this star. At warp 9.975 Spock could be home in under a day.',
  },
  {
    id: 'vega', name: 'Vega', group: 'near', ly: 25.04, color: '#cfe0ff', kind: 'star', course: 'Vega',
    about: 'One of the brightest stars in the sky, with a wide disc of dust round it.',
    trek: 'The Vega colony is where the Enterprise was headed in The Cage, the very first pilot.',
  },
  {
    id: 'trappist', name: 'TRAPPIST-1', group: 'near', ly: 40.67, color: '#ff7a50', kind: 'star', course: 'TRAPPIST-1',
    about: 'A tiny red star with seven Earth-sized planets, three of them where water could be liquid.',
  },
  {
    id: 'pleiades', name: 'The Pleiades', group: 'galaxy', ly: 403, color: '#bcd4ff', kind: 'cluster', course: 'Alcyone',
    about: 'The Seven Sisters: a young cluster of hot blue stars, about 100 million years old, and easy to see on a winter night.',
  },
  {
    id: 'betelgeuse', name: 'Betelgeuse', group: 'galaxy', ly: 498, color: '#ffa060', kind: 'star', course: 'Betelgeuse',
    about: 'A red supergiant in Orion that will explode as a supernova some time in the next 100,000 years.',
    trek: 'Home of the Betelgeusians, one of the races at the Federation council in The Voyage Home.',
  },
  {
    id: 'rigel', name: 'Rigel', group: 'galaxy', ly: 863, color: '#c4d8ff', kind: 'star', course: 'Rigel',
    about: 'A blue supergiant, Orion’s foot, around 100,000 times as bright as the Sun.',
    trek: 'Rigel VII is where Captain Pike’s landing party had the deadly fight he can’t stop thinking about in The Cage.',
  },
  {
    id: 'orion', name: 'The Orion Nebula', group: 'galaxy', ly: 1344, color: '#ff9fc6', kind: 'nebula',
    about: 'A cloud where new stars are being born, faintly visible to the eye in Orion’s sword.',
    trek: 'A nebula is a captain’s favourite place to hide, the way Kirk lured Khan into the Mutara Nebula.',
  },
  {
    id: 'deneb', name: 'Deneb', group: 'galaxy', ly: 1412, color: '#e4ecff', kind: 'star', course: 'Deneb',
    about: 'A white supergiant, the tail of the Swan. Its distance is hard to measure: the catalogue says 1,400 light years, newer estimates nearer 2,600.',
    trek: 'Farpoint Station, in the very first episode of The Next Generation, is on Deneb IV.',
  },
  {
    id: 'core', name: 'The galactic core', group: 'galaxy', ly: 26670, color: '#ffe2a8', kind: 'core', headline: true,
    about: 'Sagittarius A*, a black hole four million times the Sun’s mass, at the centre of the Milky Way. The light reaching us now left it during the last ice age.',
    trek: 'In The Final Frontier the Enterprise-A gets here in what seems like days. On this scale even warp 9.975 takes about four years.',
  },
  {
    id: 'delta', name: 'Where Voyager was stranded', group: 'beyond', ly: 70000, color: '#c9a2ff', kind: 'ship',
    about: 'The far side of the galaxy, in the Delta Quadrant: the Milky Way is about 100,000 light years across.',
    trek: 'Janeway reckoned 75 years to get home at maximum warp. Flying nonstop at warp 9.975 it’s just over ten, so her 75 allowed for a lot of stopping.',
  },
  {
    id: 'lmc', name: 'The Large Magellanic Cloud', group: 'beyond', ly: 160000, color: '#d6dcff', kind: 'galaxy',
    about: 'A small galaxy in orbit round our own, a smudge in the southern sky. In 1987 a star there exploded and could be seen without a telescope.',
    trek: 'To get here you’d cross the galactic barrier at the Milky Way’s edge, which went badly for the Enterprise in Where No Man Has Gone Before.',
  },
  {
    id: 'andromeda', name: 'Andromeda', group: 'beyond', ly: 2537000, color: '#e8dcff', kind: 'galaxy',
    about: 'The nearest big galaxy, and the farthest thing you can see with your eyes. It’s heading our way and will merge with the Milky Way in about 4.5 billion years.',
    trek: 'In By Any Other Name, the Kelvans take over the Enterprise for a 300-year trip home to Andromeda. That’s about 8,500 times light, faster than warp 9.99.',
  },
];
export const byId = new Map(PLACES.map(p => [p.id, p]));

function fromEarth(planet, jd) {
  const p = planetAt(planet, jd), e = earthAt(jd);
  return Math.hypot(p[0] - e[0], p[1] - e[1], p[2] - e[2]) / AU_PER_LY;
}

// How far each place is, in light years, on a date.
export const distanceLy = (place, date = new Date()) => (place.live ? place.live(jdOf(date)) : place.ly);

// Each lane's speed in multiples of light. Voyager 1's comes from its trajectory when there's a date.
export function laneSpeed(lane, customWarp = 9, date) {
  if (lane.id === 'voyager') return (date ? readings('v1', jdOf(date)).speedKmS : lane.kmS) / C_KM_S;
  return warpSpeed(lane.id === 'custom' ? customWarp : lane.warp);
}

export const tripYears = (ly, speedC) => ly / speedC;

// The race clock. Trips run from fractions of a millisecond to hundreds of millions of years, so the clock runs on a
// log scale: it starts at a twentieth of the fastest trip and every second of the race covers the same factor of time.
export function raceClock(times) {
  const from = Math.min(...times) / 20, to = Math.max(...times) * 1.02;
  const decades = Math.log10(to / from);
  const seconds = Math.min(Math.max(decades * 1.05, 5), 13);
  return {
    seconds,
    at: s => from * Math.pow(to / from, Math.min(Math.max(s / seconds, 0), 1)),
    // When, in seconds of the race, a trip of this length ends.
    when: t => seconds * Math.log10(t / from) / decades,
  };
}

// Any span of time, from microseconds to billions of years, in words.
export function formatSpan(years) {
  const s = years * SECONDS_PER_YEAR;
  if (s < 1e-3) return `${sig(s * 1e6)} microseconds`;
  if (s < 1) return `${sig(s * 1e3)} milliseconds`;
  if (s < 59.5) return s < 10 ? `${sig(s)} seconds` : plural(Math.round(s), 'second');
  const min = Math.round(s / 60);
  if (min < 60) return plural(min, 'minute');
  const h = s / 3600;
  if (h < 23.5) return plural(Math.round(h), 'hour');
  const days = s / 86400;
  if (days < 1.5) return h - 24 >= 0.5 ? `1 day ${plural(Math.round(h - 24), 'hour')}` : '1 day';
  if (days < 59.5) return plural(Math.round(days), 'day');
  const months = Math.round(days / 30.44);
  if (months < 24) return plural(months, 'month');
  if (years < 20) {
    const y = Math.floor(years), m = Math.round((years - y) * 12);
    if (m === 12) return plural(y + 1, 'year');
    return m ? `${plural(y, 'year')} ${plural(m, 'month')}` : plural(y, 'year');
  }
  if (years < 1e6) return `${round2(years).toLocaleString('en-US')} years`;
  if (years < 1e9) return `${sig(years / 1e6)} million years`;
  return `${sig(years / 1e9)} billion years`;
}

// A distance the way light measures it: light-seconds up close, light years out among the stars.
export function formatLight(ly) {
  const s = ly * SECONDS_PER_YEAR;
  if (s < 60) return `${sig(s)} light-seconds`;
  if (s < 3600) return `${sig(s / 60)} light-minutes`;
  if (s < 86400 * 1.5) return `${sig(s / 3600)} light-hours`;
  if (ly < 0.1) return `${sig(s / 86400)} light-days`;
  if (ly < 10) return `${ly.toFixed(2)} light years`;
  if (ly < 1e6) return `${Number(ly.toPrecision(3)).toLocaleString('en-US')} light years`;
  return `${sig(ly / 1e6)} million light years`;
}

// The year a trip leaving now would arrive, while that's still a year worth naming.
export function arrivalYear(years, date = new Date()) {
  if (years < 1 || years > 1e5) return null;
  const y = Math.round(date.getUTCFullYear() + (date.getUTCMonth() + 0.5) / 12 + years);
  return y > 9999 ? y.toLocaleString('en-US') : String(y);
}

// When the light you see from a place now set off.
export function lightLeft(ly, date = new Date()) {
  if (ly < 1) return null;
  if (ly >= 3000) return `${formatSpan(ly)} ago`;
  return `in ${formatYear(date.getUTCFullYear() + date.getUTCMonth() / 12 - ly)}`;
}

// Where a distance sits on the ladder from a light-second to Andromeda, from 0 to 1, on a log scale.
export const LADDER = [
  [LIGHT_SECOND_LY, 'light-second'], [60 * LIGHT_SECOND_LY, 'light-minute'], [3600 * LIGHT_SECOND_LY, 'light-hour'],
  [86400 * LIGHT_SECOND_LY, 'light-day'], [1, 'light year'], [1000, '1,000 ly'], [1e6, 'million ly'],
];
const LOW = Math.log10(LIGHT_SECOND_LY / 2), HIGH = Math.log10(5e6);
export const ladderAt = ly => (Math.log10(ly) - LOW) / (HIGH - LOW);

const sig = x => Number(x.toPrecision(x < 1 ? 2 : x < 100 ? 2 : 3)).toLocaleString('en-US');
// Two significant figures past 100, so 28,341 reads as 28,000.
function round2(x) {
  const a = Math.abs(x);
  if (a < 100) return Math.round(x);
  const p = Math.pow(10, Math.floor(Math.log10(a)) - 1);
  return Math.round(x / p) * p;
}

// The same, squeezed into a ladder cell: "189 µs", "3.9 yr", "2.5M yr".
export function formatShort(years) {
  const s = years * SECONDS_PER_YEAR;
  if (s < 1e-3) return `${short(s * 1e6)} µs`;
  if (s < 1) return `${short(s * 1e3)} ms`;
  if (s < 60) return `${short(s)} s`;
  if (s < 3600) return `${short(s / 60)} min`;
  if (s < 86400) return `${short(s / 3600)} hr`;
  if (years < 1 / 12 * 2) return `${short(s / 86400)} days`;
  if (years < 1) return `${short(years * 12)} mo`;
  if (years < 1e6) return `${short(years)} yr`;
  if (years < 1e9) return `${short(years / 1e6)}M yr`;
  return `${short(years / 1e9)}B yr`;
}
const short = x => (x < 10 ? Number(x.toFixed(1)) : Number(x.toPrecision(2))).toLocaleString('en-US');
