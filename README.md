# Engage

**Use it: [junkdrawer.works/engage](https://junkdrawer.works/engage/)**

**Take the helm of a starship and warp to real stars.** Pick a destination, set a warp factor, and engage. The sky on the viewscreen is drawn from a real star catalogue, so as you travel, nearby stars slide past and constellations come apart the way they really would. When you drop out of warp, the captain’s log tells you what you’ve found, including where our Sun now sits in that sky.

<p align="center">
  <img src="docs/phone-helm.png" alt="The bridge in Earth's orbit, looking toward Crux and the Centaurus stars, with Proxima Centauri chosen as the destination: 4.23 light years away, 1 day at warp 9" width="250">
  &nbsp;
  <img src="docs/phone-warp.png" alt="At warp 9 toward Proxima Centauri: blue streaks rush past the Milky Way, and the readout says 3.91 light years to go and 10 hours elapsed" width="250">
  &nbsp;
  <img src="docs/phone-log.png" alt="Arrived at Proxima Centauri: a red sun above the captain's log, which describes the star and its planets" width="250">
  &nbsp;
  <img src="docs/phone-home.png" alt="Looking back from Proxima Centauri: the Sun is a magnitude 0.4 star in Cassiopeia, between Polaris and Mirfak" width="250">
  &nbsp;
  <img src="docs/phone-survey.png" alt="The planetary survey open at Class O, an ocean world covered in cloud, with thumbnails of the other classes below" width="250">
</p>

## How it works

- **Every star is real.** About 18,000 of them, from the HYG database: everything you can see from Earth with your eyes, plus every catalogued star within 80 light years. Each is drawn at its true position and as bright as it would look from wherever the ship is.
- **Set course.** Tap a star on the viewscreen, or choose from 32 destinations with notes (Proxima Centauri, TRAPPIST-1, Vulcan’s sun 40 Eridani, Betelgeuse…) or search the whole catalogue.
- **Warp factor.** Warp 1 is light speed and warp 9 is about 1,516 times it. The helm shows how long the trip would take, next to how long light needs. The flight itself is shortened to a few seconds.
- **Drop out of warp.** The ship holds where the star’s disc looks about two and a half degrees wide, or in the orbit of a known planet. The log covers the star, its planets, a few notes, how the Sun looks from there, which year of Earth’s history its light is showing, and when Earth’s first TV broadcasts arrive.
- **Look for the Sun.** The ☉ button turns the view toward home, marked even when it’s too faint to see.
- **Drag to look around, pinch or scroll to zoom.** Arrow keys work too.
- **The planetary survey** ([survey.html](https://junkdrawer.works/engage/survey.html), the ringed planet on the bridge) flips through Starfleet’s planet classes, from Class M to Demon class, next to the kinds astronomers have really found that Starfleet never named: super-Earths, sub-Neptunes, lava worlds, hot Jupiters and ice giants. Each file has typical readings, the Solar System’s examples, and real planets that fit, with **Set course** to fly there. The log links back to the files for the planets it mentions. **Cover your tracks** shows an unlogged world’s sensor readings and asks which file it would pass for.
- No account and no server. The log and where you are stay in your browser. It works offline and installs to a phone’s home screen.

## Running it

It’s a static site: plain HTML, CSS and JavaScript, with no build step.

```sh
npx serve .                   # or any static file server, then open the printed address
npm test                      # checks the numbers, then flies it in Chromium through the real page (needs Playwright)
node tools/screenshots.mjs    # redraws docs/*.png, og.png and og-survey.png (add `survey` for only the survey's)
node tools/build-artifact.mjs # single-file copies for the Artifact viewer, in dist/
node tools/make-icons.mjs     # redraws the PNG icons from icon.svg
python3 tools/build-data.py HYG_CSV D3_CELESTIAL_DATA   # rebuilds data/ and img/milkyway.png (see the script)
```

To put it online with GitHub Pages: **Settings → Pages → Build and deployment → Deploy from a branch**, then pick `main` and `/ (root)`.

### Files

- `js/app.js`: the bridge: helm, flight, looking around, the log and settings.
- `js/sky.js`: the viewscreen in WebGL: stars, constellation lines, the Milky Way, star discs and warp streaks.
- `js/physics.js`: warp speeds, brightness, colour and size of stars, trip times. Pure functions.
- `js/log.js`: writes each captain’s log entry.
- `js/destinations.js`: the 32 stars with notes, and the moments in Earth’s history the log can mention.
- `js/catalog.js`: loads the stars and names where a direction points in the sky.
- `js/audio.js`: engine sounds, made with Web Audio.
- `survey.html`, `css/survey.css`, `js/survey.js`: the planetary survey.
- `js/classes.js`: the survey files: each class, its readings, and the real planets that fit it.
- `js/planet-art.js`: paints each kind of planet from 3D noise and turns it as a lit globe on a 2D canvas.
- `data/stars.bin`, `data/stars.json`, `img/milkyway.png`: made by `tools/build-data.py` from the [HYG database](https://github.com/astronexus/HYG-Database) v4.1 by David Nash (CC BY-SA 4.0; this derived data is shared under the same licence) and [d3-celestial](https://github.com/ofrohn/d3-celestial) by Olaf Frohn (BSD 3-clause) for constellation lines, boundaries and the Milky Way.
- `fonts/`: Chakra Petch and IBM Plex Sans (SIL Open Font License), served from here so nothing loads from elsewhere.
- `sw.js`: keeps a copy for using offline.
