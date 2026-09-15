"""Final fragment mapping: one explicit assignment per source fragment.

Every assignment below is read off ``.cache/refractor-audit/fragments-measured.json``, which measures
each fragment about the published optical frame using the model's own numbers. The *layout* that the
assignments encode, with s from the objective end (negative) to the eyepiece end (positive), mm:

    -339 .. +305   the 643 mm tube shell, exactly coaxial (r 23.6 at -s, 59.5 at +s)
    -294 .. -272   two solid discs spanning the whole 108.8 mm bore, exactly coaxial
    -443 .. +442   the coaxial train of narrow rings along the axis (r 0.3..39 mm, off < 35 mm)
    -113 ..  +12   the focuser   (off 61..85 mm, height 1.10..1.15 m)
       +8 .. +103  the finder    (off 61..74 mm, height 1.20..1.23 m, i.e. higher up)
    +272 .. +294   the front cell and retainer rings (off 25..65 mm)
    +116 .. +667   the mount castings and linkage (off 119..410 mm)
    +622 .. +1215  the counterweight drum and the tripod legs
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / '.cache/refractor-audit'
rows = json.loads((OUT / 'fragments-measured.json').read_text())
by_tag = {x['tag']: x for x in rows}

TAXONOMY = ['objectiveCell', 'lensRetainer', 'opticalTube', 'dewShield', 'eyepieceHolder', 'focuser',
            'finderScope', 'mount', 'counterweight', 'tripod', 'hardware', 'unknown']

ASSIGNMENT = {
    # the 643 mm shell
    'n4-m2-p0:c1': 'opticalTube',

    # the two solid discs across the whole bore, plus the flange ring beside them
    'n12-m6-p0:c0': 'dewShield',
    'n12-m6-p0:c1': 'dewShield',
    'n14-m7-p0:c17': 'lensRetainer',

    # the front opening: the cell rings and the retainers that hold a lens
    'n10-m5-p0:c0': 'objectiveCell',
    'n14-m7-p0:c5': 'objectiveCell',
    'n4-m2-p0:c2': 'objectiveCell',
    'n14-m7-p0:c15': 'objectiveCell',
    'n14-m7-p0:c16': 'objectiveCell',
    'n10-m5-p0:c2': 'objectiveCell',
    'n10-m5-p0:c1': 'lensRetainer',
    'n14-m7-p0:c4': 'lensRetainer',
    'n4-m2-p0:c17': 'lensRetainer',
    'n12-m6-p0:c3': 'lensRetainer',
    'n12-m6-p0:c4': 'lensRetainer',
    'n4-m2-p0:c16': 'lensRetainer',
    'n4-m2-p0:c18': 'lensRetainer',
    'n10-m5-p0:c6': 'lensRetainer',
    'n10-m5-p0:c7': 'lensRetainer',

    # the coaxial train along the axis: the eyepiece and focuser tubes
    'n4-m2-p0:c7': 'eyepieceHolder',
    'n4-m2-p0:c6': 'eyepieceHolder',
    'n14-m7-p0:c25': 'eyepieceHolder',
    'n14-m7-p0:c30': 'eyepieceHolder',
    'n14-m7-p0:c23': 'eyepieceHolder',
    'n14-m7-p0:c24': 'eyepieceHolder',

    # the focuser on the tube's flank
    'n4-m2-p0:c3': 'focuser',
    'n4-m2-p0:c4': 'focuser',
    'n10-m5-p0:c9': 'focuser',
    'n14-m7-p0:c18': 'focuser',
    'n14-m7-p0:c19': 'focuser',
    'n10-m5-p0:c8': 'focuser',

    # the finder on the tube's upper side
    'n4-m2-p0:c8': 'finderScope',
    'n14-m7-p0:c10': 'finderScope',

    # the mount under the tube
    # The 6412-face column is the largest single part. It sits 321 mm off the optical axis at
    # heights 0.73..0.93 m and its inner surface does not match the tube, so the measurements do
    # not establish its function: it stays reported as unconfirmed.
    'n0-m0-p0:c0': 'unknown',
    'n4-m2-p0:c0': 'mount',
    'n2-m1-p0:c0': 'mount',
    'n14-m7-p0:c3': 'mount',
    'n14-m7-p0:c6': 'mount',
    'n4-m2-p0:c5': 'mount',
    'n14-m7-p0:c7': 'mount',
    'n14-m7-p0:c11': 'mount',
    'n14-m7-p0:c12': 'mount',
    'n14-m7-p0:c8': 'mount',
    'n14-m7-p0:c9': 'mount',
    'n14-m7-p0:c22': 'mount',
    'n14-m7-p0:c14': 'mount',
    'n14-m7-p0:c13': 'mount',
    'n14-m7-p0:c20': 'mount',
    'n6-m3-p0:c0': 'mount',
    'n6-m3-p0:c1': 'mount',
    'n6-m3-p0:c2': 'mount',
    'n6-m3-p0:c3': 'mount',
    'n4-m2-p0:c10': 'mount',
    'n4-m2-p0:c22': 'mount',
    'n12-m6-p0:c2': 'mount',
    'n12-m6-p0:c5': 'mount',
    'n4-m2-p0:c13': 'mount',
    'n4-m2-p0:c23': 'mount',
    'n14-m7-p0:c26': 'mount',
    'n14-m7-p0:c27': 'mount',
    'n14-m7-p0:c28': 'mount',
    'n10-m5-p0:c13': 'mount',
    'n10-m5-p0:c10': 'mount',

    # the balance
    'n4-m2-p0:c19': 'counterweight',
    'n14-m7-p0:c29': 'counterweight',
    'n4-m2-p0:c21': 'counterweight',
    'n4-m2-p0:c20': 'counterweight',
    'n4-m2-p0:c12': 'counterweight',
    'n14-m7-p0:c2': 'counterweight',
    'n14-m7-p0:c0': 'counterweight',
    'n14-m7-p0:c1': 'counterweight',
    'n10-m5-p0:c11': 'counterweight',
    'n10-m5-p0:c12': 'counterweight',
    'n4-m2-p0:c14': 'counterweight',

    # the ground end
    'n4-m2-p0:c9': 'tripod',
    'n4-m2-p0:c11': 'tripod',
    'n8-m4-p0:c5': 'tripod',
    'n8-m4-p0:c3': 'tripod',
    'n8-m4-p0:c4': 'tripod',
    'n8-m4-p0:c0': 'tripod',
    'n8-m4-p0:c1': 'tripod',
    'n8-m4-p0:c2': 'tripod',
    'n14-m7-p0:c21': 'tripod',

    # the small fittings that the measurements do not tie to one assembly
    'n4-m2-p0:c15': 'mount',
    'n10-m5-p0:c3': 'hardware',
    'n10-m5-p0:c4': 'hardware',
    'n10-m5-p0:c5': 'hardware',
}

unassigned = sorted(set(by_tag) - set(ASSIGNMENT))
if unassigned:
    print('!!! these fragments have no assignment:')
    for tag in unassigned:
        x = by_tag[tag]
        print(f'   {tag:20s} off {x["off"] * 1000:8.1f} s {x["sMid"] * 1000:+8.1f} '
              f'r {x["rMin"] * 1000:6.1f}..{x["rMax"] * 1000:6.1f} h {x["height"]:.3f} '
              f'({x["faces"]}f)')
extra = sorted(set(ASSIGNMENT) - set(by_tag))
if extra:
    print('!!! these assignments name fragments that do not exist:', extra)

groups = {}
for tag, part in ASSIGNMENT.items():
    if tag in by_tag:
        groups.setdefault(part, []).append(by_tag[tag])
missing = [p for p in TAXONOMY if p not in groups]
print()
print('%-16s %5s %7s %22s %19s' % ('category', 'frags', 'faces', 's band (mm)', 'off axis (mm)'))
for pid in TAXONOMY:
    v = groups.get(pid, [])
    if not v:
        print('%-16s %5d' % (pid, 0))
        continue
    print('%-16s %5d %7d %9.1f..%-11.1f %7.1f..%-8.1f' % (
        pid, len(v), sum(y['faces'] for y in v),
        min(y['sMin'] for y in v) * 1000, max(y['sMax'] for y in v) * 1000,
        min(y['off'] for y in v) * 1000, max(y['off'] for y in v) * 1000))

if missing:
    raise SystemExit(f'these categories are empty: {missing}')

json.dump(ASSIGNMENT, open(OUT / 'part-of.json', 'w'), indent=2)
print()
print('WROTE', OUT / 'part-of.json')
