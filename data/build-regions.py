"""Build the game atlas from Natural Earth's 10m admin-1 and populated places GeoJSON files."""
from collections import defaultdict
from pathlib import Path
import json
import sys
import unicodedata

ROOT = Path(__file__).resolve().parents[1]
world = json.loads((ROOT / 'dist/world-data.json').read_text())['countries']
admin = json.loads(Path(sys.argv[1]).read_text())['features']
cities = json.loads(Path(sys.argv[2]).read_text())['features']
sites = json.loads((ROOT / 'data/mineral-sites.json').read_text())

def normalized(value):
    return ''.join(c for c in unicodedata.normalize('NFKD', value or '') if c.isascii() and c.isalnum()).lower()

def contains(ring, point):
    x, y = point
    return sum((a[1] > y) != (b[1] > y) and x < (b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0] for a,b in zip(ring,ring[1:])) % 2 == 1

def simplify(points, epsilon):
    a,b = points[0],points[-1]
    dx,dy = b[0]-a[0],b[1]-a[1]
    length = dx*dx+dy*dy
    farthest,split = 0,0
    for i,(x,y) in enumerate(points[1:-1],1):
        t = min(1,max(0,((x-a[0])*dx+(y-a[1])*dy)/length)) if length else 0
        error = (x-a[0]-t*dx)**2+(y-a[1]-t*dy)**2
        if error > farthest:
            farthest,split = error,i
    if farthest <= epsilon**2:
        return [a,b]
    return simplify(points[:split+1],epsilon)[:-1]+simplify(points[split:],epsilon)

def path(polygons):
    rings=[]
    for polygon in polygons:
        ring=polygon[0]
        points=simplify(ring,.10)
        if len(points)<4: continue
        rings.append('M'+'L'.join(f'{(x+180)*10/3:.1f},{(84-y)*3.5:.1f}' for x,y in points[:-1])+'Z')
    return ''.join(rings)

by_country=defaultdict(list)
for f in cities:
    p=f['properties']
    if 'capital' in p['FEATURECLA'].lower():
        by_country[p['ADM0_A3']].append(p)

regions=defaultdict(list)
for f in admin:
    p=f['properties']
    code=p['adm0_a3']
    if code not in world or not f['geometry']: continue
    polygons=f['geometry']['coordinates']
    if f['geometry']['type']=='Polygon': polygons=[polygons]
    iso=p['iso_3166_2']
    name=p["name_pt"] or p["name"] or p["name_en"] or iso or p["adm1_code"]
    if code=="BRA": name=p["name"] or name
    names={normalized(p[k]) for k in ('name','name_en','name_pt','woe_name')}-{''}
    candidates=[]
    for city in by_country[code]:
        point=[city['LONGITUDE'],city['LATITUDE']]
        if not any(contains(poly[0],point) and not any(contains(h,point) for h in poly[1:]) for poly in polygons): continue
        match=normalized(city['ADM1NAME']) in names
        # Prefer a named administrative match. Territorial capitals and city-states
        # may match geometrically even when source names use different spellings.
        candidates.append((2*match+(not city['ADM0CAP']),city['POP_MAX'],city))
    capital=max(candidates,key=lambda v:v[:2])[2] if candidates else None
    local=[capital['NAME_PT'] or capital['NAME'],round(capital['LONGITUDE'],4),round(capital['LATITUDE'],4),False,capital['POP_MAX']] if capital else None
    region_sites=[item[1:] for item in sites if item[0]==iso]
    regions[code].append([p['adm1_code'],name,local,region_sites,path(polygons),round(p['longitude'],3),round(p['latitude'],3),p['type_en']])
out=ROOT/'dist/regions'
out.mkdir(exist_ok=True)
# Group by continent to limit the number of browser and repository requests.
groups=defaultdict(dict)
for code,items in regions.items():
    group={'Americas':'americas','Europe':'europe','Africa':'africa','Asia':'asia','Oceania':'oceania'}.get(world[code][2],'other')
    groups[group][code]=sorted(items,key=lambda r:r[1])
for group,items in groups.items():
    (out / (group+'.json')).write_text(json.dumps(items,ensure_ascii=False,separators=(',',':')))
print(sum(map(len,regions.values())),len(regions),sum(r[2] is not None for rr in regions.values() for r in rr),sum(len(r[3]) for rr in regions.values() for r in rr))
