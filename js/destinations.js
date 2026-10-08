// The stars with notes in the captain's log. `star` is the name in data/stars.json; everything else is what the
// log says on arrival. Temperatures in kelvin, brightness (all light, not just visible) and width against the Sun.
// Any other star can be visited too: the log then works out what it can from the catalogue.

export const HOME = 'Sol';

export const DESTINATIONS = [
  {
    star: 'Sol', worlds: true, title: 'Sol', aka: 'the Sun', group: 'home',
    kind: 'Yellow dwarf, spectral type G2', temp: 5772, lum: 1, radius: 1,
    planets: 'Eight, and one of them is home.',
    hold: { au: 1, label: 'in Earth’s orbit' },
    notes: [
      'The Sun is an ordinary star: there are hundreds of billions like it in the Milky Way.',
      'Its light takes 8 minutes 20 seconds to reach Earth.',
    ],
  },
  {
    star: 'Proxima Centauri', worlds: true, title: 'Proxima Centauri', group: 'neighbors',
    kind: 'Red dwarf, spectral type M5.5', temp: 3042, lum: 0.0017, radius: 0.154,
    planets: 'Two confirmed. Proxima b, found in 2016, is at least as heavy as Earth and orbits in 11 days, inside the zone where water could be liquid. Proxima d, found in 2022, is about a quarter of Earth’s mass.',
    hold: { au: 0.0485, label: 'in Proxima b’s orbit' },
    notes: [
      'The nearest star to the Sun, and far too faint to see from Earth without a telescope.',
      'It throws off violent flares that can brighten it many times over in minutes.',
      'It circles Alpha Centauri A and B about 13,000 AU away, taking roughly half a million years to go round once.',
    ],
  },
  {
    star: 'Rigil Kentaurus', title: 'Alpha Centauri', aka: 'Rigil Kentaurus and Toliman', group: 'neighbors',
    kind: 'Two Sun-like stars, spectral types G2 and K1', temp: 5790, lum: 1.52, radius: 1.22,
    planets: 'None confirmed. In 2025 the James Webb Space Telescope spotted a possible giant planet around A, which still needs confirming.',
    notes: [
      'Alpha Centauri A, where you are now, is a near twin of the Sun. Its partner B, an orange star, is the bright light close by.',
      'A and B orbit each other every 80 years, swinging between 11 and 35 AU apart.',
      'From Earth the pair shine as one star, the third brightest in the night sky, though it never rises for most of the northern hemisphere.',
    ],
    fiction: 'The destination in Lost in Space, and the system Pandora orbits in Avatar.',
  },
  {
    star: "Barnard's Star", worlds: true, title: 'Barnard’s Star', group: 'neighbors',
    kind: 'Old red dwarf, spectral type M4', temp: 3195, lum: 0.0035, radius: 0.187,
    planets: 'Four small rocky planets, all lighter than Earth, confirmed in 2024 and 2025. They circle it in two to seven days.',
    notes: [
      'It moves across Earth’s sky faster than any other star, about the width of the Moon every 180 years.',
      'It is heading our way and will be the closest star to the Sun in about 10,000 years.',
      'At around 10 billion years old, it is more than twice the Sun’s age.',
    ],
    fiction: 'The target of Project Daedalus, a 1970s study of an uncrewed starship.',
  },
  {
    star: 'Wolf 359', title: 'Wolf 359', group: 'neighbors',
    kind: 'Red dwarf, spectral type M6', temp: 2800, lum: 0.0014, radius: 0.16,
    planets: 'None confirmed.',
    notes: [
      'One of the faintest and smallest stars known, only about a tenth of the Sun’s mass.',
      'Like many small red dwarfs it is a flare star, prone to sudden outbursts.',
    ],
    fiction: 'Famous in science fiction as the site of a great starship battle.',
  },
  {
    star: 'Lalande 21185', worlds: true, title: 'Lalande 21185', group: 'neighbors',
    kind: 'Red dwarf, spectral type M2', temp: 3550, lum: 0.022, radius: 0.39,
    planets: 'At least two. One circles in under 13 days; another takes about eight years.',
    notes: [
      'The brightest red dwarf in the northern sky. Binoculars will show it from Earth, in Ursa Major.',
    ],
  },
  {
    star: 'Sirius', title: 'Sirius', aka: 'The Dog Star', group: 'neighbors',
    kind: 'White star, spectral type A1, with a white dwarf companion', temp: 9940, lum: 25.4, radius: 1.71,
    planets: 'None known.',
    notes: [
      'The brightest star in Earth’s night sky.',
      'Its companion, Sirius B, is a white dwarf: about the Sun’s mass squeezed into something the size of Earth. The two orbit every 50 years.',
      'Ancient Egyptians watched for Sirius rising just before dawn, which came before the Nile’s yearly flood.',
    ],
  },
  {
    star: 'Ran', worlds: true, title: 'Epsilon Eridani', aka: 'Ran', group: 'neighbors',
    kind: 'Orange dwarf, spectral type K2', temp: 5084, lum: 0.34, radius: 0.74,
    planets: 'One giant planet, about Jupiter’s mass, on a seven-year orbit, inside rings of dust and ice.',
    notes: [
      'A young star, under a billion years old, with belts of debris like our asteroid and Kuiper belts.',
      'One of the two stars Frank Drake listened to in 1960 in the first search for alien radio signals.',
    ],
    fiction: 'The home of the Babylon 5 space station.',
  },
  {
    star: 'Procyon', title: 'Procyon', group: 'neighbors',
    kind: 'Yellow-white star, spectral type F5, with a white dwarf companion', temp: 6530, lum: 6.9, radius: 2.05,
    planets: 'None known.',
    notes: [
      'Its name means “before the dog”: from the north it rises just before Sirius, the Dog Star.',
      'It is beginning to swell as it runs low on hydrogen in its core.',
    ],
  },
  {
    star: '61 Cygni', title: '61 Cygni', group: 'neighbors',
    kind: 'Two orange dwarfs, spectral types K5 and K7', temp: 4400, lum: 0.15, radius: 0.67,
    planets: 'None known.',
    notes: [
      'The first star whose distance was ever measured, by Friedrich Bessel in 1838. Until then nobody knew how far away the stars were.',
      'The pair orbit each other about every 700 years.',
    ],
  },
  {
    star: 'ε Indi', worlds: true, title: 'Epsilon Indi', group: 'neighbors',
    kind: 'Orange dwarf, spectral type K5', temp: 4650, lum: 0.22, radius: 0.71,
    planets: 'A cold giant several times Jupiter’s mass, photographed directly by the James Webb Space Telescope in 2024.',
    notes: [
      'Far out from it, about 1,500 AU, a pair of brown dwarfs orbit each other: objects too small to shine as stars.',
    ],
  },
  {
    star: 'τ Ceti', title: 'Tau Ceti', group: 'neighbors',
    kind: 'Yellow dwarf, spectral type G8', temp: 5344, lum: 0.52, radius: 0.79,
    planets: 'Several possible small planets, none yet beyond doubt.',
    notes: [
      'The nearest single star like the Sun, and visible from Earth without a telescope.',
      'It has a disc of dust about ten times as massive as the Sun’s, so its planets would be bombarded often.',
      'The other star Frank Drake listened to in 1960.',
    ],
    fiction: 'A favourite of science fiction writers, from Asimov to Le Guin.',
  },
  {
    star: "Luyten's Star", worlds: true, title: 'Luyten’s Star', group: 'neighbors',
    kind: 'Red dwarf, spectral type M3.5', temp: 3380, lum: 0.0088, radius: 0.32,
    planets: 'At least two. Luyten b, found in 2017, is about three times Earth’s mass and orbits where water could be liquid.',
    hold: { au: 0.091, label: 'in Luyten b’s orbit' },
    notes: [
      'In 2017 a radio message with music was beamed here from Norway. It should arrive around 2030.',
    ],
  },
  {
    star: "Teegarden's Star", worlds: true, title: 'Teegarden’s Star', group: 'neighbors',
    kind: 'Red dwarf, spectral type M7', temp: 2900, lum: 0.00073, radius: 0.107,
    planets: 'Three small planets. Teegarden b is one of the most Earth-like worlds known by size and the light it gets.',
    hold: { au: 0.0252, label: 'in Teegarden b’s orbit' },
    notes: [
      'So faint it wasn’t found until 2003, hiding in old asteroid-survey pictures.',
    ],
  },
  {
    star: "Kapteyn's Star", title: 'Kapteyn’s Star', group: 'neighbors',
    kind: 'Red subdwarf, spectral type M1', temp: 3550, lum: 0.012, radius: 0.29,
    planets: 'Two were claimed in 2014; later work suggests the signals came from the star itself.',
    notes: [
      'About 11 billion years old, it circles the galaxy backwards compared with the Sun.',
      'It may have been pulled from a small galaxy the Milky Way swallowed long ago.',
    ],
  },
  {
    star: 'Keid', title: '40 Eridani', aka: 'Keid', group: 'famous',
    kind: 'Orange dwarf, spectral type K0, with two companions', temp: 5126, lum: 0.46, radius: 0.81,
    planets: 'A planet claimed in 2018 turned out to be the star’s own activity.',
    notes: [
      'A triple: an orange star like this one, a white dwarf and a red dwarf. The white dwarf is the easiest to see from Earth, in a small telescope.',
    ],
    fiction: 'Vulcan’s sun. Gene Roddenberry and three astronomers named it in a 1991 letter to Sky & Telescope.',
  },
  {
    star: 'Altair', title: 'Altair', group: 'famous',
    kind: 'White star, spectral type A7', temp: 7700, lum: 10.6, radius: 1.8,
    planets: 'None known.',
    notes: [
      'It spins once every nine hours, so fast it bulges at the equator, a fifth wider there than pole to pole.',
      'In 2007 it became the first ordinary star other than the Sun to have its surface pictured.',
    ],
    fiction: 'The sun of Altair IV in Forbidden Planet.',
  },
  {
    star: 'Vega', title: 'Vega', group: 'famous',
    kind: 'White star, spectral type A0', temp: 9600, lum: 40, radius: 2.4,
    planets: 'None confirmed, though a wide disc of dust surrounds it.',
    notes: [
      'In 1850 it became the first star other than the Sun to be photographed.',
      'Earth’s wobble makes it the north star around 12,000 BCE and again around 13,700 CE.',
    ],
    fiction: 'The source of the message in Contact.',
  },
  {
    star: 'Fomalhaut', title: 'Fomalhaut', group: 'famous',
    kind: 'White star, spectral type A3', temp: 8590, lum: 16.6, radius: 1.84,
    planets: '“Fomalhaut b”, photographed in 2008, turned out to be a spreading cloud of dust from a collision.',
    notes: [
      'A bright ring of icy debris circles it about 140 AU out, and the Webb telescope found more belts inside it.',
      'It is young, about 440 million years old.',
    ],
  },
  {
    star: 'TRAPPIST-1', worlds: true, title: 'TRAPPIST-1', group: 'famous',
    kind: 'Ultracool red dwarf, spectral type M8', temp: 2566, lum: 0.00055, radius: 0.119,
    planets: 'Seven, all roughly Earth-sized, announced in 2017. All seven would fit inside Mercury’s orbit, and three orbit where water could be liquid.',
    hold: { au: 0.0292, label: 'in TRAPPIST-1e’s orbit' },
    notes: [
      'From one of its planets, the neighbouring planets would sometimes look bigger than the Moon does from Earth.',
      'Webb found that the two innermost planets have no thick atmospheres.',
    ],
  },
  {
    star: 'Helvetios', worlds: true, title: '51 Pegasi', aka: 'Helvetios', group: 'famous',
    kind: 'Yellow dwarf, spectral type G5', temp: 5790, lum: 1.36, radius: 1.15,
    planets: 'Dimidium, a giant half Jupiter’s mass that circles in just over four days.',
    notes: [
      'Dimidium was the first planet ever found around a Sun-like star, in 1995. It won Michel Mayor and Didier Queloz the 2019 Nobel Prize.',
      'Nobody expected a giant planet so close to its star. It changed where astronomers looked.',
    ],
  },
  {
    star: 'Pollux', worlds: true, title: 'Pollux', group: 'famous',
    kind: 'Orange giant, spectral type K0', temp: 4586, lum: 43, radius: 9.1,
    planets: 'One giant planet, Thestias, about twice Jupiter’s mass.',
    notes: [
      'The nearest giant star to the Sun: it has used up the hydrogen in its core and swollen to nine times the Sun’s width.',
    ],
  },
  {
    star: 'Arcturus', title: 'Arcturus', group: 'famous',
    kind: 'Orange giant, spectral type K1.5', temp: 4286, lum: 170, radius: 25.4,
    planets: 'None known.',
    notes: [
      'The brightest star in the northern half of the sky.',
      'Its light opened the 1933 Chicago World’s Fair: a telescope caught it, and the current switched on the lights.',
      'An old star passing through the Sun’s neighbourhood on a steep orbit through the galaxy.',
    ],
  },
  {
    star: 'Capella', title: 'Capella', group: 'famous',
    kind: 'Two yellow giants, spectral types G8 and G0', temp: 4970, lum: 79, radius: 11.9,
    planets: 'None known.',
    notes: [
      'What looks like one star from Earth is two giants circling each other every 104 days, with a pair of red dwarfs farther out.',
    ],
  },
  {
    star: 'Aldebaran', title: 'Aldebaran', group: 'giants',
    kind: 'Orange giant, spectral type K5', temp: 3900, lum: 439, radius: 44,
    planets: 'One possible giant planet.',
    notes: [
      'The bull’s red eye in Taurus. It looks like part of the Hyades cluster, but sits about halfway between us and it.',
      'Pioneer 10 is drifting in its direction and will pass it in about two million years.',
    ],
  },
  {
    star: 'Polaris', title: 'Polaris', aka: 'The North Star', group: 'giants',
    kind: 'Yellow supergiant, spectral type F7', temp: 6015, lum: 1260, radius: 37.5,
    planets: 'None known.',
    notes: [
      'It sits within a degree of Earth’s north pole of the sky, and will be closest around the year 2100.',
      'A Cepheid: it pulses in brightness every four days. Stars like it are how astronomers measure distances to other galaxies.',
      'Its distance is still argued over; the catalogue here puts it at the far end.',
    ],
  },
  {
    star: 'Alcyone', title: 'The Pleiades', aka: 'Alcyone', group: 'giants',
    kind: 'Blue giant, spectral type B7, the brightest of the Seven Sisters', temp: 12750, lum: 2400, radius: 9.3,
    planets: 'None known.',
    notes: [
      'You are inside a cluster of over a thousand young stars, born together about 100 million years ago.',
      'From Earth, Japan calls them Subaru, which is the six stars on the carmaker’s badge.',
    ],
  },
  {
    star: 'Betelgeuse', title: 'Betelgeuse', group: 'giants',
    kind: 'Red supergiant, spectral type M2', temp: 3600, lum: 100000, radius: 760,
    planets: 'None known. In 2025 astronomers reported a small companion star tucked close to it.',
    notes: [
      'Put it where the Sun is and it would swallow everything out past Mars, and maybe Jupiter.',
      'In 2019 and 2020 it dimmed dramatically. It had puffed out a cloud of dust that blocked some of its light.',
      'It will explode as a supernova, probably within the next 100,000 years. From Earth it would shine about as bright as a half Moon for weeks.',
    ],
  },
  {
    star: 'Rigel', title: 'Rigel', group: 'giants',
    kind: 'Blue supergiant, spectral type B8', temp: 12100, lum: 120000, radius: 79,
    planets: 'None known.',
    notes: [
      'Orion’s bright foot, and one of the most luminous stars in Earth’s neighbourhood of the galaxy.',
      'It is at least four stars: the blue supergiant and a family of smaller companions.',
    ],
  },
  {
    star: 'Antares', title: 'Antares', group: 'giants',
    kind: 'Red supergiant, spectral type M1', temp: 3660, lum: 75900, radius: 680,
    planets: 'None known.',
    notes: [
      'The heart of the Scorpion. Its name means “rival of Mars” because the two look alike in colour.',
      'A small, hot blue-white companion star orbits it.',
    ],
  },
  {
    star: 'Canopus', title: 'Canopus', group: 'giants',
    kind: 'White giant, spectral type A9', temp: 7350, lum: 10700, radius: 71,
    planets: 'None known.',
    notes: [
      'The second brightest star in Earth’s night sky.',
      'Spacecraft have long used it as a guide star to know which way they are pointing.',
    ],
  },
  {
    star: 'Deneb', title: 'Deneb', group: 'giants',
    kind: 'White supergiant, spectral type A2', temp: 8525, lum: 196000, radius: 203,
    planets: 'None known.',
    notes: [
      'One of the most luminous stars that can be seen without a telescope from Earth, and the tail of Cygnus the swan.',
      'Its distance is very uncertain, anywhere from about 1,400 to 2,600 light years.',
    ],
  },
];

export const GROUPS = [
  ['neighbors', 'Next door'],
  ['famous', 'Worth the trip'],
  ['giants', 'Long hauls'],
];

// Moments on Earth that a distant watcher could be seeing now, for the line about Earth's light.
export const ANCHORS = [
  [-2560, 'the Great Pyramid of Giza was being finished'],
  [-776, 'the first Olympic Games were held'],
  [1215, 'Magna Carta was sealed'],
  [1440, 'Gutenberg was building his printing press'],
  [1492, 'Columbus crossed the Atlantic'],
  [1543, 'Copernicus put the Sun at the centre'],
  [1610, 'Galileo turned a telescope on the sky'],
  [1687, 'Newton published his laws of motion'],
  [1781, 'William Herschel discovered Uranus'],
  [1838, 'Bessel first measured the distance to a star'],
  [1846, 'Neptune was found'],
  [1876, 'the telephone was invented'],
  [1903, 'the Wright brothers first flew'],
  [1926, 'Robert Goddard launched the first liquid-fuelled rocket'],
  [1957, 'Sputnik went up'],
  [1961, 'Yuri Gagarin became the first person in space'],
  [1966, 'Star Trek premiered on television'],
  [1969, 'people first walked on the Moon'],
  [1977, 'the two Voyager spacecraft launched'],
  [1990, 'the Hubble Space Telescope launched'],
  [1995, 'the first planet around a Sun-like star was found'],
  [2012, 'Voyager 1 left the Sun’s bubble for interstellar space'],
  [2021, 'the James Webb Space Telescope launched'],
];
