// The planetary survey files: Starfleet's planet classes, and the kinds of planet astronomers have actually found.
// `letter` is the Starfleet class (null where Starfleet never named one). `art` picks how js/planet-art.js paints it.
// `typical` are the readings the survey shows, and the ranges the "cover your tracks" drill draws a world from:
// width and mass against Earth, temperature at the surface (or the cloud tops) in kelvin, the year in Earth days.
// `worlds` are real planets; `star` is the host's name in data/stars.json, so Engage can set course for it.

export const CLASSES = [
  {
    id: 'M', letter: 'M', name: 'Minshara class', short: 'Earth-like', art: 'earth',
    real: 'A temperate rocky planet',
    about: 'Breathable air, liquid water across most of the surface, and a climate where people can walk around without a suit. The word is Vulcan; Starfleet uses the letter. Nearly every world in Star Trek where the crew beams down in uniform is Class M.',
    typical: { width: [0.8, 1.3], mass: [0.5, 2], temp: [260, 310], year: [200, 600],
      air: 'Nitrogen and oxygen, about Earth’s pressure', water: 'Oceans over half the surface or more', life: 'Plants and animals' },
    tell: 'Breathable air, open oceans and animal life together: only Class M has all three.',
    home: 'Earth, and nowhere else in the Solar System.',
    worlds: [
      { name: 'Proxima b', star: 'Proxima Centauri', ly: 4.2, note: 'About Earth’s mass, in the zone where water could be liquid. Nobody yet knows whether it has air at all; its star’s flares may have stripped it.' },
      { name: 'Teegarden’s Star b', star: 'Teegarden\'s Star', ly: 12.5, note: 'One of the most Earth-like planets known by size and by the light it gets.' },
      { name: 'TRAPPIST-1 e', star: 'TRAPPIST-1', ly: 40, note: 'A little smaller than Earth, in the middle of its star’s temperate zone. Webb is looking for an atmosphere.' },
    ],
    candidate: true,
  },
  {
    id: 'L', letter: 'L', name: 'Marginal', short: 'Forested, no animals', art: 'forest',
    real: 'A temperate rocky planet where life never got past plants',
    about: 'Thick with forests and grassland, but with no animal life. The air is oxygen and argon: breathable in a pinch, not comfortable for long. Starfleet treats these as worlds people could settle with some work.',
    typical: { width: [0.7, 1.1], mass: [0.4, 1.3], temp: [250, 300], year: [150, 500],
      air: 'Oxygen and argon, a little thin', water: 'Lakes and inland seas, under half the surface', life: 'Plants only' },
    tell: 'Plants everywhere but nothing moving, under oxygen and argon: that’s Class L.',
    home: 'None today. Earth went through billions of years with life only in its seas before anything grew on land.',
    worlds: [],
  },
  {
    id: 'K', letter: 'K', name: 'Adaptable', short: 'Thin air, needs domes', art: 'mars',
    real: 'A cold, dry rocky planet with a thin atmosphere',
    about: 'Too thin and too cold to breathe outside, but solid ground, a little air and some water ice. People can live here inside pressure domes, and Starfleet colonies often do.',
    typical: { width: [0.4, 0.7], mass: [0.1, 0.5], temp: [180, 250], year: [300, 900],
      air: 'Thin carbon dioxide, under a hundredth of Earth’s pressure', water: 'Ice at the poles and underground', life: 'None found' },
    tell: 'Small, cold, thin air and ice caps: livable only under a dome, which makes it Class K.',
    home: 'Mars. It had rivers and lakes billions of years ago, before it lost most of its air.',
    worlds: [],
  },
  {
    id: 'H', letter: 'H', name: 'Desert', short: 'Hot and dry', art: 'desert',
    real: 'A dry rocky planet',
    about: 'Hot, arid and mostly sand and rock, with little rain. Hardy, drought-proof plants and animals can get by, and so can people who carry water.',
    typical: { width: [0.6, 1.1], mass: [0.3, 1.3], temp: [300, 360], year: [100, 400],
      air: 'Breathable but dry and dusty', water: 'Under a fifth of the surface, mostly underground', life: 'Sparse, drought-hardy' },
    tell: 'Warm, breathable air but almost no surface water: a Class H desert.',
    home: 'None in the Solar System today.',
    worlds: [],
    science: 'Astronomers think dry “land planets” could stay livable closer to their stars than Earth could, because they hold less water vapour to trap heat.',
  },
  {
    id: 'N', letter: 'N', name: 'Reducing', short: 'Runaway greenhouse', art: 'venus',
    real: 'A rocky planet smothered by its own atmosphere',
    about: 'A crushing, scalding atmosphere of carbon dioxide with clouds of sulfuric acid. Any oceans it had boiled away long ago. Seen from orbit it is a featureless ball of pale yellow cloud.',
    typical: { width: [0.8, 1.05], mass: [0.6, 1.1], temp: [600, 750], year: [150, 300],
      air: 'Carbon dioxide at 90 times Earth’s pressure, sulfuric acid clouds', water: 'None left', life: 'None' },
    tell: 'Earth-sized but hot enough to melt lead under thick cloud: Class N, like Venus.',
    home: 'Venus, the hottest planet in the Solar System though Mercury is closer to the Sun.',
    worlds: [],
    science: 'Astronomers keep a list of planets in each star’s “Venus zone”, and Webb is checking some of them for thick air.',
  },
  {
    id: 'O', letter: 'O', name: 'Pelagic', short: 'Ocean world', art: 'ocean',
    real: 'An ocean planet',
    about: 'Covered almost entirely in water, with only scattered islands, if any. Warm, wet and cloudy. Life, if it’s there, is in the sea.',
    typical: { width: [0.9, 1.6], mass: [0.7, 4], temp: [270, 320], year: [100, 500],
      air: 'Nitrogen and water vapour, very humid', water: 'One ocean over 97% of the surface or more', life: 'Possible, in the sea' },
    tell: 'Nearly all ocean with a few specks of land: Class O.',
    home: 'None on the surface. Jupiter’s moon Europa and Saturn’s moon Enceladus have salty oceans under their ice.',
    worlds: [
      { name: 'K2-18 b', ly: 124, note: 'Larger than Earth, in its star’s temperate zone. Webb found methane and carbon dioxide; whether it has an ocean under that air is hotly argued.' },
    ],
    candidate: true,
  },
  {
    id: 'P', letter: 'P', name: 'Glaciated', short: 'Frozen over', art: 'ice',
    real: 'An icy or “snowball” planet',
    about: 'Locked in ice from pole to pole, with a thin, cold atmosphere. There may be liquid water deep under the ice, warmed from below.',
    typical: { width: [0.5, 1.2], mass: [0.2, 1.5], temp: [150, 240], year: [300, 1500],
      air: 'Thin and cold nitrogen', water: 'All frozen: ice sheets everywhere', life: 'None on the surface' },
    tell: 'Ice from pole to pole under thin, cold air: a glaciated Class P.',
    home: 'None today, but Earth itself froze over at least twice, about 700 million years ago.',
    worlds: [
      { name: 'LHS 1140 b', ly: 49, note: 'A heavy, temperate planet that may be an “eyeball”: ice everywhere except an open ocean facing its star.' },
    ],
    candidate: true,
  },
  {
    id: 'D', letter: 'D', name: 'Planetoid', short: 'Airless rock', art: 'rock',
    real: 'A dwarf planet, a large moon or a bare rocky planet',
    about: 'Small, airless and cratered, baking in sunlight and freezing in shadow. Nothing lives here, but mining outposts and research stations do.',
    typical: { width: [0.1, 0.4], mass: [0.001, 0.05], temp: [40, 400], year: [80, 90000],
      air: 'None', water: 'Perhaps ice in shadowed craters', life: 'None' },
    tell: 'Tiny, airless and covered in craters: a Class D planetoid.',
    home: 'Earth’s Moon, Ceres and hundreds of other moons and dwarf planets.',
    worlds: [
      { name: 'TRAPPIST-1 b', star: 'TRAPPIST-1', ly: 40, note: 'Earth-sized, but Webb found it is bare rock with no thick atmosphere, about 230 °C on its day side.' },
    ],
  },
  {
    id: 'Y', letter: 'Y', name: 'Demon class', short: 'Toxic and deadly', art: 'demon',
    real: 'Nothing quite like it has been found',
    about: 'The most hostile class there is: a toxic, corrosive atmosphere, surface temperatures above 500 K and radiation that can damage a ship in orbit. Voyager’s crew landed on one anyway.',
    typical: { width: [0.8, 1.4], mass: [0.6, 2.5], temp: [500, 900], year: [5, 60],
      air: 'Toxic and corrosive', water: 'None', life: 'Nothing you’d want to meet' },
    tell: 'Searing heat, poisonous air and dangerous radiation: stay away, it’s Demon class.',
    home: 'None.',
    worlds: [],
  },
  {
    id: 'J', letter: 'J', name: 'Gas giant', short: 'Jupiter-like', art: 'jovian',
    real: 'A gas giant',
    about: 'A huge ball of hydrogen and helium with no surface to stand on, striped with bands of cloud and swirling storms. Gas giants usually come with families of moons, and the moons are often where the interesting places are.',
    typical: { width: [8, 12], mass: [50, 600], temp: [90, 170], year: [1500, 15000],
      air: 'Hydrogen and helium, deeper than any ship could go', water: 'Deep inside, as vapour', life: 'None known' },
    tell: 'Ten times Earth’s width, cold, banded clouds and no surface: Class J, a gas giant.',
    home: 'Jupiter and Saturn.',
    worlds: [
      { name: 'Ægir', star: 'Ran', ly: 10.5, note: 'About Jupiter’s mass, circling Epsilon Eridani every seven years.' },
      { name: 'Thestias', star: 'Pollux', ly: 34, note: 'About twice Jupiter’s mass, circling an orange giant star.' },
    ],
  },
  {
    id: 'T', letter: 'T', name: 'Gas ultragiant', short: 'Bigger than Jupiter', art: 'ultra',
    real: 'A super-Jupiter',
    about: 'A gas giant several times heavier than Jupiter, though not much wider, because the extra weight squeezes it. Young ones still glow from the heat of forming. Much heavier again and it would be a brown dwarf, a failed star.',
    typical: { width: [10, 13], mass: [1500, 4000], temp: [250, 1200], year: [5000, 100000],
      air: 'Hydrogen and helium', water: 'Traces, deep inside', life: 'None' },
    tell: 'Jupiter-sized but thousands of times Earth’s mass: an ultragiant, Class T.',
    home: 'None. Jupiter is the heaviest planet in the Solar System.',
    worlds: [
      { name: 'Epsilon Indi Ab', star: 'ε Indi', ly: 12, note: 'About six times Jupiter’s mass and only a few degrees above freezing. Webb photographed it directly in 2024.' },
      { name: 'Beta Pictoris b', star: 'β Pictoris', ly: 63, note: 'About ten times Jupiter’s mass and still hot from forming, inside a huge disc of dust.' },
      { name: 'HR 8799 b, c, d and e', star: 'HIP 114189', ly: 133, note: 'Four super-Jupiters, photographed together in 2008: the first family of planets ever seen directly.' },
    ],
  },
  {
    id: 'R', letter: 'R', name: 'Rogue', short: 'No star at all', art: 'rogue',
    real: 'A free-floating, or rogue, planet',
    about: 'A planet thrown out of its home system, drifting through the dark between the stars. With no sun it is frozen on the outside, though its core can keep it warm far underground.',
    typical: { width: [0.5, 3], mass: [0.2, 10], temp: [30, 60], year: null,
      air: 'Frozen onto the ground, or none', water: 'Frozen solid', life: 'None on the surface' },
    tell: 'No star and no year, just a cold world drifting: a rogue planet, Class R.',
    home: 'None, as far as anyone knows.',
    worlds: [],
    science: 'Surveys that watch for planets bending the light of background stars suggest there could be more rogue planets in the Milky Way than stars.',
  },

  // Found by astronomers, never named by Starfleet.
  {
    id: 'super-earth', letter: null, name: 'Super-Earth', short: 'Bigger rocky planet', art: 'superearth',
    real: 'A rocky planet heavier than Earth',
    about: 'Rocky like Earth but up to about eight times heavier, with stronger gravity and probably thicker air. Among the most common planets around other stars, yet the Solar System has none. Starfleet would sort each one by its surface: many would be Class K or M.',
    typical: { width: [1.2, 1.6], mass: [2, 8], temp: [220, 450], year: [10, 120],
      air: 'Unknown, probably thick', water: 'Unknown', life: 'Unknown' },
    tell: 'Rocky but half again Earth’s width and several times its mass: a super-Earth.',
    home: 'None, which surprised astronomers.',
    worlds: [
      { name: 'Luyten b', star: 'Luyten\'s Star', ly: 12.2, note: 'About three times Earth’s mass, in the zone where water could be liquid.' },
      { name: 'Gliese 667 Cc', star: 'Gliese 667C', ly: 23.6, note: 'About four times Earth’s mass, circling the smallest star of a triple system in its temperate zone.' },
    ],
  },
  {
    id: 'sub-neptune', letter: null, name: 'Sub-Neptune', short: 'Small and hazy', art: 'subneptune',
    real: 'A planet between Earth and Neptune in size, wrapped in thick gas',
    about: 'Two to three times Earth’s width, with a rocky or watery core buried under deep hydrogen and haze. It’s the most common kind of planet the Kepler telescope found, and there is nothing like it orbiting the Sun.',
    typical: { width: [2, 3.5], mass: [5, 15], temp: [300, 700], year: [3, 50],
      air: 'Thick hydrogen and haze', water: 'Perhaps steam, deep down', life: 'Unlikely' },
    tell: 'Two to three times Earth’s width under thick, hazy hydrogen: a sub-Neptune.',
    home: 'None.',
    worlds: [
      { name: 'GJ 1214 b', ly: 48, note: 'So hazy that Webb couldn’t see through its clouds; it may be a steamy, water-rich world underneath.' },
    ],
  },
  {
    id: 'lava-world', letter: null, name: 'Lava world', short: 'Molten surface', art: 'lava',
    real: 'A rocky planet so close to its star its surface melts',
    about: 'Circling so close that a year lasts less than a day, the side facing the star is a sea of molten rock. The air, if any, is vaporised rock. The far side may be crusted over and dark.',
    typical: { width: [1.2, 2], mass: [3, 9], temp: [1500, 2700], year: [0.4, 1],
      air: 'Rock vapour, or none', water: 'None', life: 'None' },
    tell: 'A year shorter than a day and a day side of molten rock: a lava world.',
    home: 'None, though Jupiter’s moon Io is covered in volcanoes.',
    worlds: [
      { name: '55 Cancri e', star: 'Copernicus', ly: 41, note: 'Twice Earth’s width, circling in 18 hours. Webb found signs of an atmosphere over its magma ocean in 2024.' },
    ],
  },
  {
    id: 'hot-jupiter', letter: null, name: 'Hot Jupiter', short: 'Giant, roasting', art: 'hotjupiter',
    real: 'A gas giant orbiting very close to its star',
    about: 'A gas giant circling closer to its star than Mercury does to the Sun, in days instead of years. The day side reaches over a thousand degrees and the giant puffs up. Nobody thought these could exist until the first was found.',
    typical: { width: [10, 20], mass: [100, 2000], temp: [1000, 2500], year: [1, 5],
      air: 'Hydrogen and helium, with metal vapour', water: 'Steam, high up', life: 'None' },
    tell: 'Jupiter-sized but with a year of only a few days, glowing hot: a hot Jupiter.',
    home: 'None.',
    worlds: [
      { name: 'Dimidium', star: 'Helvetios', ly: 50, note: 'Half Jupiter’s mass, circling 51 Pegasi in four days. The first planet ever found around a Sun-like star, in 1995.' },
      { name: 'Tau Boötis b', star: 'τ Boötis', ly: 51, note: 'Six times Jupiter’s mass with a year of three days.' },
    ],
  },
  {
    id: 'ice-giant', letter: null, name: 'Ice giant', short: 'Neptune-like', art: 'icegiant',
    real: 'An ice giant',
    about: 'Smaller than a gas giant, with a deep layer of water, ammonia and methane under its hydrogen. The methane gives it its blue. Starfleet lumps these in with Class J, but astronomers count them as their own kind.',
    typical: { width: [3.5, 4.5], mass: [12, 20], temp: [50, 80], year: [30000, 60000],
      air: 'Hydrogen, helium and methane', water: 'A deep slushy layer, with ammonia', life: 'None' },
    tell: 'Four times Earth’s width, blue from methane, and very cold: an ice giant.',
    home: 'Uranus and Neptune.',
    worlds: [
      { name: 'Gliese 436 b', ly: 32, note: 'A warm Neptune trailing a cloud of hydrogen behind it like a comet’s tail.' },
    ],
  },
];

export const byId = new Map(CLASSES.map(c => [c.id, c]));

// "Class M", or the plain name for the kinds Starfleet never named.
export const label = c => (c.letter ? `Class ${c.letter}` : c.name);

// The survey files that mention a star, for Engage's log: [{ world, cls }].
export function filesForStar(name) {
  const out = [];
  for (const cls of CLASSES) for (const w of cls.worlds) if (w.star === name) out.push({ world: w, cls });
  return out;
}
