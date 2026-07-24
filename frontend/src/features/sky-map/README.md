# Sky map worker

This module owns browser-side loading and calculation for the naked-eye catalog. The main
thread communicates only through `SkyMapWorkerClient`; catalog parsing and all coordinate
transforms stay inside the module worker.

## Coordinate model

- Catalog positions and proper motions are ICRS. `pmRaMasPerYear` is
  `mu_alpha*cos(declination)` and is applied as a tangent vector, without dividing by
  `cos(declination)` a second time.
- `astronomy-engine` supplies the J2000-equatorial to local-horizon rotation, including
  precession, nutation, Earth rotation, and optional normal atmospheric refraction.
- Constellation geometry is fixed in ICRS and does not receive proper motion.
- The first version ignores stellar radial velocity, perspective acceleration, and annual
  parallax. These are below the visual precision needed for the naked-eye teaching chart,
  but the calculation date is limited to Julian years 1800 through 2200 to prevent misuse
  of the linear motion model.

## Rendering model

- The main renderer is a high-DPI Canvas 2D surface for the altitude grid, constellation
  lines, and thousands of visible stars.
- A small SVG overlay contains cardinal directions, constellation labels, and hover or
  selection markers. Form controls and numeric readouts remain regular DOM elements.
- Horizontal coordinates use an azimuthal-equidistant projection: zenith is at the center,
  the horizon is the rim, and north is at the top. Constellation segments are clipped at
  the horizon before projection.
- Canvas backing dimensions follow the rendered size and cap device pixel ratio at 2 to
  preserve sharp output without excessive memory use.
- Zooming uses a pointer-anchored view transform while panning is constrained by the
  projected horizon. Star hit testing uses the same transformed screen coordinates.
- HIP search operates on the current calculated frame. A result is selected and focused;
  stars outside the current horizon or magnitude limit are reported as not visible.

## Integrity model

Browsers automatically decode gzip or Brotli `Content-Encoding` before exposing response
bytes to JavaScript. The backend therefore verifies the encoded `sha256` and
`contentLength`, while the worker verifies `decodedSha256` and `decodedContentLength`
before parsing JSON.
