# Third-party data notices

## Hipparcos Catalogue (I/239)

ESA, 1997, *The Hipparcos and Tycho Catalogues*, ESA SP-1200. The project uses Johnson V
photometry, identifiers, colour indices, spectral types, and fallback astrometry obtained
through the CDS/VizieR service.

- Catalogue: https://cdsarc.cds.unistra.fr/viz-bin/cat/I/239
- CDS acknowledgement: https://cds.unistra.fr/acknowledgement

## Hipparcos-2 (I/311)

F. van Leeuwen, 2007, *Hipparcos, the New Reduction of the Raw Data*. The project uses the
new reduction as the preferred astrometric fallback at epoch J1991.25.

- Catalogue: https://cdsarc.cds.unistra.fr/viz-bin/cat/I/311

## Gaia Data Release 3

This project makes use of data from the European Space Agency (ESA) mission Gaia
(https://www.cosmos.esa.int/gaia), processed by the Gaia Data Processing and Analysis
Consortium (DPAC, https://www.cosmos.esa.int/web/gaia/dpac/consortium). Funding for DPAC
has been provided by national institutions, in particular the institutions participating
in the Gaia Multilateral Agreement.

- Release documentation: https://www.cosmos.esa.int/web/gaia/dr3
- Archive: https://gea.esac.esa.int/archive/

## Stellarium Sky Cultures: Chinese and Western

Chinese star and asterism names, Chinese and Western figure names, and figure line data
are adapted from Stellarium Sky Cultures at commit
`014fbb5e59233d133c22f9811af96b67d05a95c9`. The culture descriptions license their
text and line/data content under CC BY-SA (the upstream files do not identify a version).

The Chinese culture was initially contributed by Karrie Berglund of Digitalis Education
Solutions based on Hong Kong Space Museum star maps. Sun Shuwei contributed more than
200 star officials and more than 3,000 stars, primarily based on Yi Shitong's *Chinese
and Western Contrast Star Chart and Catalogue 1950.0*. Text was reworked by the
Stellarium team. The Western culture data is credited to the Stellarium team.

This project converts integer HIP paths to stable `HIP:<id>` references, expands
generated Chinese star names into explicit simplified and traditional records, omits
figures without HIP paths, and does not import illustrations or long-form mythology.
The exact import report is `tools/catalog/sky-content/import-report.json`. Redistributors
must preserve attribution and apply the upstream CC BY-SA terms to adapted culture data.

The Western IAU constellation artwork is copied without modification from the same pinned
upstream commit. It is rendered only for the Western IAU culture using the upstream image
anchors. The illustrations are by Johan Meuris and are licensed under the Free Art License.
The original culture description and attribution are distributed at
`frontend/public/sky-cultures/western/ATTRIBUTION.md`.

- Source: https://github.com/Stellarium/stellarium-skycultures/tree/014fbb5e59233d133c22f9811af96b67d05a95c9
- Chinese credits and license: https://github.com/Stellarium/stellarium-skycultures/blob/014fbb5e59233d133c22f9811af96b67d05a95c9/chinese/description.md
- Western credits and license: https://github.com/Stellarium/stellarium-skycultures/blob/014fbb5e59233d133c22f9811af96b67d05a95c9/western/description.md
- License information: https://creativecommons.org/share-your-work/cclicenses/

## IAU Working Group on Star Names

Official Western star names are taken from the International Astronomical Union Working
Group on Star Names catalogue snapshot retrieved on 2026-07-24. Names were matched to
the physical Hipparcos catalogue by the official ICRS coordinates; unmatched entries
are not published in the initial culture pack.

- Catalogue: https://iauarchive.eso.org/public/themes/naming_stars/
- Snapshot SHA-256: `67392808893e0d45fc7e5ded7cdb4eb12987fed62b0d03e8d89d631181f7646d`

## Stellarium Bayer and Flamsteed designations

Bayer and Flamsteed designation mappings are adapted from Stellarium's
`stars/hip_gaia3/name.fab` at commit
`3abb0f6eedf4e71540d05860a9a67c74144a0bdf`. The project imports only mappings whose
HIP identifier is present in the physical naked-eye catalogue, preserves Stellarium's
designation order, and derives English Greek-letter spellings for search only.

The upstream Stellarium repository distributes this file without a separate file-level
license notice under the repository's GNU General Public License version 2 terms.
Redistributors must review and comply with those terms in addition to preserving this
attribution.

- Source: https://github.com/Stellarium/stellarium/blob/3abb0f6eedf4e71540d05860a9a67c74144a0bdf/stars/hip_gaia3/name.fab
- License: https://github.com/Stellarium/stellarium/blob/3abb0f6eedf4e71540d05860a9a67c74144a0bdf/COPYING

## Hong Kong Space Museum astronomy glossaries

Simplified and traditional Chinese names for the 88 Western constellations and safely
matched IAU bright stars are factual correspondences taken from Hong Kong Space Museum
glossaries retrieved on 2026-07-24. The project republishes only the name mappings needed
for sky-chart labels and search; page text, layout, images, and other table columns are not
included. Exact source snapshot checksums are recorded in
`tools/catalog/sky-content/import-report.json`.

- Western constellations (simplified Chinese): https://hk.space.museum/sc/web/spm/resources/teachers-corner/constellations-and-myths/glossary-of-western-constellations.html
- Western constellations (traditional Chinese): https://hk.space.museum/tc/web/spm/resources/teachers-corner/constellations-and-myths/glossary-of-western-constellations.html
- Bright stars (simplified Chinese): https://hk.space.museum/sc/web/spm/resources/teachers-corner/constellations-and-myths/glossary-of-bright-stars.html
- Bright stars (traditional Chinese): https://hk.space.museum/tc/web/spm/resources/teachers-corner/constellations-and-myths/glossary-of-bright-stars.html

## D3-Celestial constellation boundaries

IAU constellation boundary geometry is derived from D3-Celestial at commit
`7e720a3de062059d4c5400a379146a601d9010e0`, Copyright (c) 2015 Olaf Frohn and
contributors, licensed under the BSD 3-Clause License.

- Source: https://github.com/ofrohn/d3-celestial/tree/7e720a3de062059d4c5400a379146a601d9010e0
- License: https://github.com/ofrohn/d3-celestial/blob/7e720a3de062059d4c5400a379146a601d9010e0/LICENSE

BSD 3-Clause License:

Copyright (c) 2015, Olaf Frohn. All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are
permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this list of
   conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright notice, this list
   of conditions and the following disclaimer in the documentation and/or other materials
   provided with the distribution.
3. Neither the name of the copyright holder nor the names of its contributors may be used
   to endorse or promote products derived from this software without specific prior
   written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY
EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE
COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION)
HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR
TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

## Featured star-pattern references

The Summer Triangle and Winter Triangle membership records contain factual HIP
identifiers cross-checked against EarthSky. No article text or images are redistributed.

- Summer Triangle: https://earthsky.org/favorite-star-patterns/summer-triangle-asterism-vega-deneb-altair/
- Winter Triangle: https://earthsky.org/favorite-star-patterns/winter-triangle/

## Astronomy Engine

The browser-side sky-coordinate calculations use Astronomy Engine version `2.1.19`.

- Source: https://github.com/cosinekitty/astronomy/tree/v2.1.19
- License: MIT

Copyright (c) 2019-2023 Don Cross <cosinekitty@gmail.com>

Permission is hereby granted, free of charge, to any person obtaining a copy of this
software and associated documentation files (the "Software"), to deal in the Software
without restriction, including without limitation the rights to use, copy, modify, merge,
publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons
to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or
substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR
PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE
FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
DEALINGS IN THE SOFTWARE.

## NASA Blue Marble Earth texture

`frontend/public/demos/meteor-shower/earth-day.jpg` is derived from the NASA Visible Earth
"Blue Marble" land surface, shallow water and shaded topography image, downsampled to
2048x1024 for the interactive meteor shower demo.

- Source: https://visibleearth.nasa.gov/images/57752/blue-marble-land-surface-shallow-water-and-shaded-topography
- Credit: NASA Goddard Space Flight Center, Reto Stockli (NASA/GSFC) with data from the
  MODIS instrument on NASA's Terra satellite
- Terms: NASA imagery is generally not subject to copyright in the United States; the NASA
  name and logo remain protected.
