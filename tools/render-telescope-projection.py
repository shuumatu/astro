"""Offline geometric QA, not a screenshot: run frontend/scripts/export-telescope-audit.mjs first."""
import json
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw

out = Path(__file__).resolve().parents[1]/'.cache/telescope-audit'
data = json.loads((out/'optics-projection.json').read_text())
axis = np.array(data['exitAxis'])
im = Image.new('RGB', (1600, 850), '#101820')
draw = ImageDraw.Draw(im)
def project(points):
    p = np.array(points)
    return np.c_[180+(p[:,0]+.45)*1750, 600-((p-np.array([0,0,.40827]))@axis)*1750]

for obj in data['mechanics']:
    faces = project(obj['positions']).reshape(-1,3,2)
    fill={'primaryMirror':'#ffc56e','secondaryMirror':'#8fe7ff','secondaryHolder':'#71818e'}.get(obj['part'],'#243746')
    for face in faces:
        draw.polygon([tuple(p) for p in face],fill=fill,outline=None if obj['part'] in ['primaryMirror','secondaryMirror'] else '#304858')
for obj in data['optics']:
    pts = project(obj['positions'])
    if obj['line']:
        colors=['#ffd975','#77dbc9','#b1a0ff']
        draw.line([tuple(p) for p in pts],fill=colors[obj['step']],width=3)
    else:
        color='#ffc56e' if obj['name']=='TeachingPrimaryMirror' else '#8fe7ff' if obj['name']=='TeachingSecondaryMirror' else '#ffffff'
        for face in pts.reshape(-1,3,2): draw.polygon([tuple(p) for p in face],fill=color)
draw.text((60,40),'ACTUAL GLB + optics.ts: projection onto the folded optical plane (not a browser screenshot)',fill='white')
draw.text((60,70),'Yellow: incident / Green: primary reflection / Purple: secondary reflection / White: focus',fill='#bbd4e2')
draw.text((60,100),'Teaching view: former unverified perforated disk removed. Source mechanical geometry is not an optical prescription.',fill='#e4b59d')
im.save(out/'optics-projection.png')
print(out/'optics-projection.png')
