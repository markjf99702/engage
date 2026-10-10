// Starfleet's charts laid over the real sky: what Star Trek put at the stars you can see from your back garden.
// `star` is the name in data/stars.json. `tag` is what the overlay calls it; `line` is the story, with where it's from.
// Every other star Engage has notes on is tagged too, by its own name, so the sky shows everywhere the bridge can go.

export const CHARTS = [
  { star: 'Keid', tag: 'Vulcan', line: 'Spock’s home world circles 40 Eridani A. Gene Roddenberry and three astronomers put it here in a 1991 letter to Sky & Telescope, and you can see the star without a telescope from a dark enough garden.' },
  { star: 'Rigil Kentaurus', tag: 'Cochrane’s home', line: '“Zefram Cochrane of Alpha Centauri,” Kirk calls the man who invented warp drive, in Metamorphosis.' },
  { star: 'Wolf 359', tag: 'Wolf 359', line: 'Where the Borg destroyed 39 starships in 2367, in The Best of Both Worlds. Far too faint to see: it’s a red dwarf only a tenth the Sun’s mass.' },
  { star: 'Rigel', tag: 'Rigel VII', line: 'Captain Pike fought the Kalar warriors on Rigel VII, in The Cage, the very first pilot.' },
  { star: 'Vega', tag: 'Vega colony', line: 'In The Cage, the Enterprise was bound for the Vega colony with her wounded when she picked up a distress call from Talos IV.' },
  { star: 'Altair', tag: 'Altair VI', line: 'In Amok Time, Kirk was ordered to the inauguration on Altair VI and took Spock to Vulcan instead.' },
  { star: 'Deneb', tag: 'Farpoint', line: 'Farpoint Station stood on Deneb IV, where the Enterprise-D met Q on her first mission, in Encounter at Farpoint.' },
  { star: 'Capella', tag: 'Capella IV', line: 'Kirk bargained for mining rights with the warrior Capellans on Capella IV, in Friday’s Child.' },
  { star: 'Pollux', tag: 'Pollux IV', line: 'The being who had been the god Apollo held the Enterprise in his hand over Pollux IV, in Who Mourns for Adonais?' },
  { star: 'Aldebaran', tag: 'Aldebaran whiskey', line: 'Guinan poured Scotty a glass of it from her private stock, in Relics. “It’s green.”' },
  { star: 'Antares', tag: 'Antares', line: 'Charlie Evans came aboard the Enterprise from the ship Antares, in Charlie X.' },
  { star: 'Procyon', tag: 'Procyon V', line: 'In Enterprise, Daniels showed Archer the Battle of Procyon V, fought centuries in the future.' },
  { star: '61 Cygni', tag: 'Tellar', line: 'Star Trek: Star Charts puts Tellar Prime, home of the argumentative Tellarites, at 61 Cygni.' },
];

export const chartFor = name => CHARTS.find(c => c.star === name);
