#!/usr/bin/env python3
"""Builds the star data Engage loads:  python3 tools/build-data.py HYG_CSV D3_CELESTIAL_DATA_DIR

Inputs (not kept in this repo):
  - the HYG database v4.1, hygdata_v41.csv, from https://github.com/astronexus/HYG-Database (CC BY-SA 4.0)
  - the data/ folder of d3-celestial, https://github.com/ofrohn/d3-celestial (BSD 3-clause), for the
    constellation lines and names and the outline of the Milky Way

Outputs:
  data/stars.bin     float32 x, y, z (parsecs, equatorial, Sol at 0), absolute magnitude, B-V colour, per star
  data/stars.json    names and spectral types in the same order, plus constellation lines and boundaries
  img/milkyway.png   the Milky Way's glow as an equirectangular map (RA across, Dec down)
"""
import csv, json, math, struct, sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

hyg_csv, d3 = Path(sys.argv[1]), Path(sys.argv[2])
root = Path(__file__).resolve().parent.parent

GREEK = dict(Alp='α', Bet='β', Gam='γ', Del='δ', Eps='ε', Zet='ζ', Eta='η', The='θ', Iot='ι', Kap='κ', Lam='λ',
             Mu='μ', Nu='ν', Xi='ξ', Omi='ο', Pi='π', Rho='ρ', Sig='σ', Tau='τ', Ups='υ', Phi='φ', Chi='χ',
             Psi='ψ', Ome='ω')
SUP = str.maketrans('0123456789', '⁰¹²³⁴⁵⁶⁷⁸⁹')

cons = json.load(open(d3 / 'constellations.json'))['features']
CON = {f['properties']['desig']: f['properties'] for f in cons}
CON['Ser'] = CON.get('Ser1', CON.get('Ser'))
con_list = sorted(k for k in CON if k not in ('Ser1', 'Ser2'))
con_index = {k: i for i, k in enumerate(con_list)}


def designation(r):
    if r['proper']:
        return r['proper']
    con = CON.get(r['con'])
    gen = con['gen'] if con else r['con']
    if r['bayer']:
        letter, _, num = r['bayer'].partition('-')
        return GREEK.get(letter, letter) + num.translate(SUP) + ' ' + gen
    if r['flam']:
        return r['flam'] + ' ' + gen
    if r['gl']:
        g = r['gl']
        return g.replace('Gl ', 'Gliese ').replace('GJ ', 'Gliese ')
    if r['hip']:
        return 'HIP ' + r['hip']
    if r['hd']:
        return 'HD ' + r['hd']
    return 'HYG ' + r['id']


stars = []  # (x, y, z, absmag, ci, name, spect, con)
for r in csv.DictReader(open(hyg_csv)):
    dist, mag = float(r['dist']), float(r['mag'])
    if r['id'] == '0':
        stars.append((0.0, 0.0, 0.0, 4.83, 0.656, 'Sol', 'G2V', ''))
        continue
    unknown = dist >= 100000
    if not (mag <= 7.0 or (dist <= 25 and not unknown)):
        continue
    x, y, z = float(r['x']), float(r['y']), float(r['z'])
    absmag = float(r['absmag'])
    if unknown:  # no parallax: put it far away, as bright as it looks from here
        dist = 1000.0
        ra, dec = float(r['rarad']), float(r['decrad'])
        x, y, z = dist * math.cos(dec) * math.cos(ra), dist * math.cos(dec) * math.sin(ra), dist * math.sin(dec)
        absmag = mag - 5 * math.log10(dist / 10)
    ci = float(r['ci']) if r['ci'] else 0.6
    stars.append((x, y, z, absmag, ci, designation(r), r['spect'], r['con']))


def add(name, ra_deg, dec_deg, dist_pc, vmag, ci, spect, con):
    ra, dec = math.radians(ra_deg), math.radians(dec_deg)
    x, y, z = dist_pc * math.cos(dec) * math.cos(ra), dist_pc * math.cos(dec) * math.sin(ra), dist_pc * math.sin(dec)
    stars.append((x, y, z, vmag - 5 * math.log10(dist_pc / 10), ci, name, spect, con))


# Two faint neighbours with famous planets that HYG leaves out (positions from SIMBAD, J2000).
add('TRAPPIST-1', 346.6224, -5.0414, 12.47, 18.80, 2.0, 'M8V', 'Aqr')
add("Teegarden's Star", 43.2537, 16.8813, 3.832, 15.13, 2.0, 'M7V', 'Ari')

# Constellation lines: match each vertex to the nearest bright catalogue star.
pos = np.array([s[:3] for s in stars], dtype=np.float64)
dist = np.linalg.norm(pos, axis=1)
dist[0] = 1
unit = pos / dist[:, None]
appmag = np.array([s[3] for s in stars]) + 5 * np.log10(dist / 10)
bright = np.where((appmag < 6.6) & (np.arange(len(stars)) > 0))[0]


def nearest(lon, lat):
    ra, dec = math.radians(lon % 360), math.radians(lat)
    v = np.array([math.cos(dec) * math.cos(ra), math.cos(dec) * math.sin(ra), math.sin(dec)])
    dots = unit[bright] @ v
    i = int(np.argmax(dots))
    return int(bright[i]) if dots[i] > math.cos(math.radians(0.4)) else None


lines, missed = [], 0
for f in json.load(open(d3 / 'constellations.lines.json'))['features']:
    for strip in f['geometry']['coordinates']:
        idx = [nearest(lon, lat) for lon, lat in strip]
        for a, b in zip(idx, idx[1:]):
            if a is None or b is None:
                missed += 1
            elif a != b:
                lines.append([a, b])

with open(root / 'data/stars.bin', 'wb') as out:
    for s in stars:
        out.write(struct.pack('<5f', *s[:5]))
json.dump({
    'source': 'HYG database v4.1 (CC BY-SA 4.0, astronexus.com); constellation lines from d3-celestial (BSD)',
    'names': [s[5] for s in stars],
    'spect': [s[6] for s in stars],
    'constellations': [[k, CON[k]['name'], CON[k]['gen']] for k in con_list],
    'lines': lines,
    # IAU boundaries, [constellation index, ring of [RA degrees -180..180, Dec]], for naming where a direction points.
    'bounds': [[con_index[f['id'] if f['id'] in con_index else f['id'][:3]],
                [[round(lon, 3), round(lat, 3)] for lon, lat in f['geometry']['coordinates'][0]]]
               for f in json.load(open(d3 / 'constellations.bounds.json'))['features']],
}, open(root / 'data/stars.json', 'w'), ensure_ascii=False, separators=(',', ':'))
print(f'{len(stars)} stars, {len(lines)} line segments, {missed} unmatched')

# The Milky Way: d3-celestial's outlines come in five brightness levels (ol1 faint ... ol5 bright).
W, H = 2048, 1024
acc = np.zeros((H, W), dtype=np.float32)


def ring_paths(ring):
    """A ring as pixel paths: unwrapped across RA 12h, drawn three times so either side of the seam is covered.
    A ring that goes all the way round the sky (an edge of the band) is closed through the south pole."""
    lons, lats = [ring[0][0]], [ring[0][1]]
    for lon, lat in ring[1:]:
        lon += round((lons[-1] - lon) / 360) * 360
        lons.append(lon)
        lats.append(lat)
    pts = list(zip(lons, lats))
    if abs(lons[-1] - lons[0]) > 300:
        pts += [(lons[-1], -90), (lons[0], -90)]
    return [[((lon + shift + 180) / 360 * W, (90 - lat) / 180 * H) for lon, lat in pts] for shift in (-360, 0, 360)]


for f in json.load(open(d3 / 'milkyway.json'))['features']:
    level = int(f['id'][2])
    polys = f['geometry']['coordinates']
    if f['geometry']['type'] == 'Polygon':
        polys = [polys]
    for rings in polys:
        # Each ring flips what it covers (even-odd), the way d3-celestial fills them: a ring can be a patch or a hole.
        cover = np.zeros((H, W), dtype=bool)
        for ring in rings:
            mask = Image.new('1', (W, H), 0)
            d = ImageDraw.Draw(mask)
            for path in ring_paths(ring):
                d.polygon(path, fill=1)
            cover ^= np.asarray(mask, dtype=bool)
        acc += cover * 0.17

# Mottle it so it reads as clouds of stars rather than flat shapes.
rng = np.random.default_rng(7)
mottle = np.zeros((H, W), dtype=np.float32)
for scale, weight in ((8, 0.5), (32, 0.3), (128, 0.2)):
    small = Image.fromarray((rng.random((H // scale + 1, W // scale + 1)) * 255).astype(np.uint8))
    mottle += np.asarray(small.resize((W, H), Image.BICUBIC).crop((0, 0, W, H)), dtype=np.float32) / 255 * weight
acc = Image.fromarray(np.clip(acc * 255, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(5))
acc = np.asarray(acc, dtype=np.float32) / 255 * (0.55 + 0.9 * mottle)
img = Image.fromarray(np.clip(acc * 255, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.5))
img.save(root / 'img/milkyway.png', optimize=True)
print('milky way written')
