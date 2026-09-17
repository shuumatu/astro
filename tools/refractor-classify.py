"""Reviewed refractor fragment mapping.

The source names and materials are meaningless, so every connected fragment is assigned from its
 shape and its position in the complete assembly. The measured audit axis is kept only as review
 evidence; the published teaching frame is fitted directly from the objective and eyepiece.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / '.cache/refractor-audit'
rows = json.loads((OUT / 'fragments-measured.json').read_text())
by_tag = {row['tag']: row for row in rows}

TAXONOMY = [
    'opticalTube', 'objectiveCell', 'objectiveLens', 'tubeRings', 'fasteners', 'finderScope',
    'focuser', 'diagonal', 'eyepieceLensGroup', 'mount', 'counterweight', 'tripod',
]

# Grouping the tags by assembly makes the visual review auditable. Each source fragment appears
# exactly once; the checks below reject omissions, duplicates and obsolete tags.
GROUPS = {
    # The single connected shell includes the long main tube and its enlarged front sun shade.
    'opticalTube': ['n4-m2-p0:c1'],

    # Retaining collar immediately around the two objective elements at the large-aperture end.
    'objectiveCell': ['n14-m7-p0:c17'],

    # Two coaxial convex glass blanks filling the front aperture: the achromatic objective pair.
    'objectiveLens': ['n12-m6-p0:c0', 'n12-m6-p0:c1'],

    # Two split tube rings, their saddle/dovetail plates and the four adjacent fasteners.
    'tubeRings': [
        'n4-m2-p0:c3', 'n4-m2-p0:c4', 'n4-m2-p0:c6', 'n4-m2-p0:c7',
        'n4-m2-p0:c8', 'n10-m5-p0:c8', 'n10-m5-p0:c9',
        'n14-m7-p0:c18', 'n14-m7-p0:c19',
    ],

    # Parallel small telescope above the main tube, including both lenses, barrel and alignment screws.
    'finderScope': [
        'n4-m2-p0:c2', 'n4-m2-p0:c16', 'n4-m2-p0:c23', 'n10-m5-p0:c3', 'n10-m5-p0:c4',
        'n10-m5-p0:c5', 'n12-m6-p0:c2', 'n12-m6-p0:c5', 'n14-m7-p0:c3',
        'n14-m7-p0:c6', 'n14-m7-p0:c7',
    ],

    # Rear axial drawtube/body, paired focus wheels and the small controls next to them.
    'focuser': [
        'n4-m2-p0:c17', 'n4-m2-p0:c18', 'n10-m5-p0:c0', 'n10-m5-p0:c1',
        'n10-m5-p0:c2', 'n10-m5-p0:c6', 'n10-m5-p0:c7', 'n14-m7-p0:c8',
        'n14-m7-p0:c9', 'n14-m7-p0:c15', 'n14-m7-p0:c16',
    ],

    # Angled rear housing and its reflecting surface between the focuser and eyepiece.
    'diagonal': ['n12-m6-p0:c4', 'n14-m7-p0:c5', 'n14-m7-p0:c22'],

    # Small coaxial convex lens and its barrel at the end of the diagonal.
    'eyepieceLensGroup': ['n12-m6-p0:c3', 'n14-m7-p0:c4'],

    # Equatorial head, polar-axis housings, locks and adjustment controls.
    'mount': [
        'n0-m0-p0:c0', 'n2-m1-p0:c0', 'n4-m2-p0:c0', 'n4-m2-p0:c15',
        'n4-m2-p0:c22', 'n6-m3-p0:c0', 'n6-m3-p0:c1', 'n6-m3-p0:c2',
        'n6-m3-p0:c3', 'n14-m7-p0:c10', 'n14-m7-p0:c11', 'n14-m7-p0:c12',
        'n14-m7-p0:c13', 'n14-m7-p0:c14', 'n14-m7-p0:c20', 'n14-m7-p0:c26',
    ],

    # The hanging circular weight, the long shaft leading to it and its end lock.
    'counterweight': ['n4-m2-p0:c5', 'n10-m5-p0:c10', 'n14-m7-p0:c21'],

    # Three two-section legs, feet, leg clamps, spreader rods, connectors and central hub.
    'tripod': [
        'n4-m2-p0:c9', 'n4-m2-p0:c10', 'n4-m2-p0:c11', 'n4-m2-p0:c12',
        'n4-m2-p0:c13', 'n4-m2-p0:c14', 'n4-m2-p0:c19', 'n4-m2-p0:c20',
        'n4-m2-p0:c21', 'n8-m4-p0:c0', 'n8-m4-p0:c1', 'n8-m4-p0:c2',
        'n8-m4-p0:c3', 'n8-m4-p0:c4', 'n8-m4-p0:c5', 'n10-m5-p0:c11',
        'n10-m5-p0:c12', 'n10-m5-p0:c13', 'n14-m7-p0:c0', 'n14-m7-p0:c1',
        'n14-m7-p0:c2', 'n14-m7-p0:c23', 'n14-m7-p0:c24', 'n14-m7-p0:c25',
        'n14-m7-p0:c27', 'n14-m7-p0:c28', 'n14-m7-p0:c29', 'n14-m7-p0:c30',
    ],
}

# Dedicated mechanical classification for screws, nut-like thumb fasteners, clamping knobs and
# locking controls. The list was reviewed from the isolated fragment renders in
# .cache/refractor-audit/parts.
FASTENER_GROUPS = {
    'screw': [
        # Focuser/diagonal retaining screws, finder alignment screws, and tube-ring clamp screws.
        'n10-m5-p0:c0', 'n10-m5-p0:c1', 'n10-m5-p0:c2',
        'n10-m5-p0:c3', 'n10-m5-p0:c4', 'n10-m5-p0:c5',
        'n10-m5-p0:c6', 'n10-m5-p0:c7', 'n10-m5-p0:c8', 'n10-m5-p0:c9',
    ],
    'clampingKnob': [
        # Finder bracket lock, mount locks, tube-ring thumb knobs, counterweight lock, and leg locks.
        'n14-m7-p0:c6',
        'n14-m7-p0:c10', 'n14-m7-p0:c11', 'n14-m7-p0:c12',
        'n14-m7-p0:c13', 'n14-m7-p0:c14', 'n14-m7-p0:c18',
        'n14-m7-p0:c19', 'n14-m7-p0:c20', 'n14-m7-p0:c21',
        'n14-m7-p0:c27', 'n14-m7-p0:c28', 'n14-m7-p0:c29',
    ],
    'lockLever': ['n14-m7-p0:c26'],
}

# Fasteners are a primary selectable category. Remove them from the assembly lists above, then add
# them once under `fasteners`; their `fastenerType` below keeps the finer mechanical distinction.
fastener_tags = [tag for tags in FASTENER_GROUPS.values() for tag in tags]
fastener_set = set(fastener_tags)
for part in GROUPS:
    GROUPS[part] = [tag for tag in GROUPS[part] if tag not in fastener_set]
GROUPS['fasteners'] = fastener_tags

assignment = {}
duplicates = []
for part, tags in GROUPS.items():
    for tag in tags:
        if tag in assignment:
            duplicates.append(tag)
        assignment[tag] = part

missing = sorted(set(by_tag) - set(assignment))
extra = sorted(set(assignment) - set(by_tag))
if duplicates or missing or extra:
    raise SystemExit(f'invalid mapping: duplicates={duplicates}, missing={missing}, extra={extra}')
if set(GROUPS) != set(TAXONOMY):
    raise SystemExit('taxonomy and groups differ')

fastener_of = {}
fastener_duplicates = []
for kind, tags in FASTENER_GROUPS.items():
    for tag in tags:
        if tag in fastener_of:
            fastener_duplicates.append(tag)
        fastener_of[tag] = kind
fastener_extra = sorted(set(fastener_of) - set(by_tag))
if fastener_duplicates or fastener_extra:
    raise SystemExit(f'invalid fastener mapping: duplicates={fastener_duplicates}, extra={fastener_extra}')

print('%-20s %5s %7s %22s %19s' % ('category', 'frags', 'faces', 's band (mm)', 'off axis (mm)'))
for part in TAXONOMY:
    values = [by_tag[tag] for tag in GROUPS[part]]
    print('%-20s %5d %7d %9.1f..%-11.1f %7.1f..%-8.1f' % (
        part, len(values), sum(value['faces'] for value in values),
        min(value['sMin'] for value in values) * 1000,
        max(value['sMax'] for value in values) * 1000,
        min(value['off'] for value in values) * 1000,
        max(value['off'] for value in values) * 1000,
    ))

(OUT / 'part-of.json').write_text(json.dumps(assignment, indent=2) + '\n')
(OUT / 'fastener-of.json').write_text(json.dumps(fastener_of, indent=2) + '\n')
print('WROTE', OUT / 'part-of.json')
print('WROTE', OUT / 'fastener-of.json', f'({len(fastener_of)} fasteners)')
