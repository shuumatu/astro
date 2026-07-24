# Naked-eye catalog builder

The catalog is generated from official Hipparcos/VizieR and Gaia TAP queries. Upstream responses are cached
under `data/catalog-cache/`, which is excluded from Git.

Run from the repository root with Node.js 20 or newer:

```powershell
node tools/catalog/build-naked-eye-catalog.mjs
```

Use `--refresh` to discard valid cached responses and query every upstream source again.
The script validates input columns, stable identifiers, coordinate ranges, output size,
and the SHA-256 checksum of the compressed artifact.

The checked-in output is written to:

```text
backend/services/astronomy-service/src/main/resources/catalogs/naked-eye/
  catalog.json.gz
  manifest.json
```

Before publishing a new catalog, update `CATALOG_VERSION` and `PUBLISHED_AT` together.
The visual-magnitude limit uses Johnson V from the original Hipparcos catalogue. Gaia DR3
astrometry is used only through the official Hipparcos best-neighbour crossmatch. The
fallback order is Gaia DR3, Hipparcos-2, then the original Hipparcos astrometry.

Schema v2 contains physical star data only. Names, constellation/asterism paths and
boundaries are versioned separately by `build-sky-content.mjs`.
