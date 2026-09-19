"""Import reviewed Aircrafter rows. Development dependency: openpyxl.

Usage: python scripts/import-gear3d-aircrafter.py path/to/aircraft.xlsx
Only complete, independently reviewed configurations enter the live catalog.
The workbook contains main/belly footprints, not complete airframes or nose gear.
"""
import hashlib
import json
import sys
from collections import Counter
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parents[1]
workbook = Path(sys.argv[1])
rows = list(openpyxl.load_workbook(workbook, data_only=True).active.values)
records = [dict(zip(rows[0], row), sourceRow=i) for i, row in enumerate(rows[1:], 2)]
active = [r for r in records if str(r['Deprecated']).lower() != 'true']
digest = hashlib.sha256(workbook.read_bytes()).hexdigest()
boeing = 'https://www.boeing.com/content/dam/boeing/v2/airports/acaps/787_ACAP_Rev_Q.pdf'
airbus = 'https://aircraft.airbus.com/sites/g/files/jlcbta126/files/2024-12/AC_A350_1224.pdf'
a320 = 'https://www.aircraft.airbus.com/sites/g/files/jlcbta126/files/2023-12/ac_a320_1223.pdf'
a319 = 'https://mediaassets.airbus.com/pm_38_916_916263-0hxcf0237y.pdf?fileName=aca31901-jul-2026-2.pdf'
a321 = 'https://mediaassets.airbus.com/pm_38_916_916230-7u6neg4lfg.pdf?fileName=aca32101-jul-2026.pdf'
a330 = 'https://www.aircraft.airbus.com/sites/g/files/jlcbta126/files/2025-12/AC_A330_20251201.pdf'
a220 = 'https://www.aircraft.airbus.com/sites/g/files/jlcbta126/files/2025-12/A220-ACP-Issue013-00-27Nov2025.pdf'
# name, wheelbase mm, nose pitch mm, nose tire, MTOW, units, body length,
# nose-to-nose-gear, source. Boeing dimensions converted from published inches.
reviewed = [
    ('B787-8', 897*25.4, 28.5*25.4, '40x16R16', 502500, 'lb', 56720, 5410, boeing),
    ('B787-9', 1017*25.4, 28.5*25.4, '40x16R16', 561500, 'lb', 62810, 5410, boeing),
    ('B787-10', 1137*25.4, 28.5*25.4, '40x16R16', 560000, 'lb', 68300, 5410, boeing),
    ('A320-200 std', 12640, 500, '30x8.8R15', 73500, 'kg', 37570, 5070, a320),
    ('A350-900', 28665, 748, '1050x395R16', 272000, 'kg', 66610, 4630, airbus),
    ('A350-1000', 32484, 748, '1050x395R16', 308000, 'kg', 73590, 4630, airbus),
    ('A319-100 std', 11039, 500, '30x8.8R15', 64000, 'kg', 33840, 5070, a319),
    ('A321-200 std', 16906, 500, '30x8.8R15', 89000, 'kg', 44510, 5070, a321),
    ('A330-200 WV020', 22180, 710, '1050x395R16', 230000, 'kg', 58820, 6670, a330),
    ('A330-300 WV020', 25375, 710, '1050x395R16', 230000, 'kg', 63670, 6670, a330),
    ('A220-100', 43*304.8, 18.57*25.4, '27x8.5R12', 140500, 'lb', 1377*25.4, 139*25.4, a220),
    ('A220-300', 602.6*25.4, 18.57*25.4, '27x8.5R12', 156300, 'lb', 1523.2*25.4, 133.4*25.4, a220),
]
units = []

# Explicit identities: workbook 'Manufacturer' often contains a category instead.
identities = {
    'B787-8': ('Boeing', '787-8'), 'B787-9': ('Boeing', '787-9'),
    'B787-10': ('Boeing', '787-10'),
    **{name: ('Airbus', name.replace(' std', '').replace(' WV020', ''))
       for name in ['A320-200 std', 'A350-900', 'A350-1000', 'A319-100 std',
                    'A321-200 std', 'A330-200 WV020', 'A330-300 WV020', 'A220-100', 'A220-300']}
}
# Who issues each manufacturer's airport planning document. The upstream E-Lab's
# provenance gate requires a publisher on every source, and a URL cannot stand in
# for one: two of the regional manuals are linked from third-party mirrors.
publishers = {
    'Boeing': 'Boeing Commercial Airplanes', 'Airbus': 'Airbus S.A.S.',
    'Embraer': 'Embraer S.A.', 'Bombardier / Canadair': 'Bombardier Inc.',
    'De Havilland Canada': 'De Havilland Aircraft of Canada Limited', 'ATR': 'ATR',
}
regional = json.loads((ROOT/'scripts/gear3d-body-assets/regional-aircraft.json').read_text(encoding='utf-8'))
extras = {item['name']: item for item in regional}
for item in regional:
    identities[item['name']] = (item['manufacturer'], item['model'])
    reviewed.append(tuple(item[key] for key in ['name', 'wheelbase', 'nosePitch', 'noseTire',
        'mtow', 'massUnit', 'length', 'noseOffset', 'url']))
audit = []
for name, wb, nose_pitch, nose_tire, mtow, mass_unit, length, nose_offset, url in reviewed:
    matches = [r for r in active if r['Airplane Name'] == name]
    assert len(matches) == 1, name
    r = matches[0]
    extra = extras.get(name)
    transverse = [float(x)*25.4 for x in r['WheelCoord_X (in.)'].split(';')]
    longitudinal = [float(x)*25.4 for x in r['WheelCoord_Y (in.)'].split(';')]
    assert len(transverse) == len(longitudinal)
    tire = (r['Repr. Tire Size'] or '').replace('\u00d7', 'x')
    corrections = []
    assumptions = ['percentOnMainGear']
    if extra:
        tire = extra['mainTire']
        corrections.extend(extra['corrections'])
        assumptions.extend(extra.get('assumedFields', []))
    if name.startswith('A321'):
        tire='1270x455R22'
        corrections.append('Main tire corrected from inherited 46x17R20 to manufacturer 1270x455R22 (A321 AC 7-2-0 page 3, WV000).')
    if name.startswith('A220'):
        tire='H42x15.0R21'
        corrections.append('Missing main tire supplied from Airbus ACP pavement footprint tables: H42x15.0R21.')
        corrections.append('Wheelbase uses aircraft general-dimension drawing: 43 ft (-100) / 602.6 in (-300). Pavement-module figures instead state 513.10 / 576.10 in. These conflicting manufacturer dimensions are unresolved; this entry uses the general geometry for visualization.')
        assumptions.append('wheelbase (conflicting manufacturer diagrams; general geometry selected)')
    source = f"Aircrafter aircraft.xlsx row {r['sourceRow']} ({name}), FAARFIELD-derived main-wheel coordinates; inches converted to mm. Manufacturer footprint cross-check: {url}."
    gears = [dict(id='NLG', role='nose', type='dual', wheelsAcross=2, tandemRows=1,
                  x=0, y=0, dualSpacing=nose_pitch, tandemSpacing=None, tire=nose_tire,
                  source='Manufacturer landing gear footprint: nose tire, pitch and wheelbase. '+url)]
    for side, sign in [('L', -1), ('R', 1)]:
        coords = [(x, y) for x, y in zip(longitudinal, transverse) if y*sign > 0]
        xs, ys = sorted(set(x for x, y in coords)), sorted(set(y for x, y in coords))
        assert len(ys) == 2 and len(coords) == len(xs)*2
        gear = dict(id='MLG-'+side, role='main', type='dual', wheelsAcross=2,
                    tandemRows=len(xs), x=wb, y=sum(ys)/2, dualSpacing=ys[1]-ys[0],
                    tandemSpacing=xs[1]-xs[0] if len(xs)>1 else None,
                    tire=tire, source=source)
        if name == 'A350-1000':
            gear.update(y=sign*5367, dualSpacing=1397, dualSpacingByRow=[1397,1474,1397],
                        tandemSpacing=1400, tire='50x20R22',
                        source='Airbus A350 AC Dec 2024, 7-2-0 page 6: 10.734 m track, 1.400 m tandem pitch, 1.397/1.474/1.397 m axle pitches, 50x20R22 main tire. Supersedes workbook geometry and inherited tire. '+url)
        if extra:
            gear.update(y=sign*extra['track']/2, dualSpacing=extra['mainPitch'],
                        source=extra['reference']+'. '+url)
        gears.append(gear)
    if name == 'A350-1000':
        corrections.append('Airbus overrides workbook: track 10374.093 -> 10734 mm; middle axle pitch 1396.898 -> 1474 mm; tire 1400x530R23 -> 50x20R22.')
    pressure = r['Tire Pressure (psi)']
    if name == 'B787-10':
        pressure = 236
        corrections.append('Main tire pressure 224 -> 236 psi per Boeing Rev Q section 7.2.')
    if name == 'A350-900':
        pressure = 244
        corrections.append('Main tire pressure 241 -> 244 psi for 272900 kg WV002 per Airbus 7-2-0 page 2.')
    if name.startswith('A220'):
        pressure = 200 if name.endswith('100') else 223
        corrections.append('Loading variant and pressure updated to the cited ACP, rather than mixing current tire data with older workbook weights.')
    manufacturer, model = identities[name]
    identifier = name.lower().replace(' std','').replace(' wv020','')
    taxi = dict(value=r['Gross Taxi Weight (lbs)'], unit='lb', basis=source)
    if name.startswith('A220'):
        taxi=dict(value=141500 if name.endswith('100') else 157000, unit='lb', basis='Airbus ACP aircraft description weight table. '+url)
    if extra:
        identifier = extra['id']
        pressure = extra['pressure']
        taxi = dict(value=extra['taxi'], unit=mass_unit, basis=extra['reference']+'. '+url)
    unit = dict(schemaVersion='1.0', id=identifier, domain='aircraft',
                manufacturer=manufacturer, model=model,
                gearDesignation={1:'D',2:'2D',3:'3D'}[gears[1]['tandemRows']],
                mtow=dict(value=mtow, unit=mass_unit, basis='Manufacturer ACAP general characteristics, selected weight variant. '+url),
                maxTaxiWeight=taxi,
                percentOnMainGear=95, wheelbase=wb, mainGearTrack=abs(gears[1]['y'])*2,
                tirePressure=dict(value=pressure, unit='psi', basis='Manufacturer landing gear footprint, selected weight variant. '+url),
                assumedFields=assumptions, gears=gears,
                bodyFit=dict(length=length, noseOffset=nose_offset),
                notes='Complete nose and main gear. Loads use MTOW with the FAA 95% main-gear design assumption; taxi weight is separate. Body is a representative family mesh, with manufacturer length and nose station. '+ ' '.join(corrections),
                sources=[dict(id='manufacturer-acap', title='Manufacturer airport planning manual',
                              publisher=publishers[manufacturer], url=url,
                              note='General characteristics and dimensions; landing gear footprint. Revision is identified by the linked document; detailed section references and discrepancies are recorded in the review.'),
                         dict(id='aircrafter',title='Aircrafter FAARFIELD-derived workbook',publisher='ICT Mechanics',
                              note=f"public/data/aircraft.xlsx; SHA256 {digest}; row {r['sourceRow']}. Main footprint only; representative tire fields independently reviewed.")])
    units.append(unit)
    if extra:
        unit['bodyFit'].update(extra.get('bodyFit', {}))
        unit['bodyFit']['source'] = extra['bodyReference']
        unit['notes'] = ('Complete nose and main gear; 95% main-gear loading is a design assumption. '
                         'Representative airframe, not manufacturer CAD. '+' '.join(corrections))
        unit['sources'][0]['note'] = extra['reference']
        unit['sources'].extend(extra.get('sources', []))
    audit.append(dict(id=unit['id'], row=r['sourceRow'], name=name,
                      mainWheelCoordinatesMm=[dict(x=x,y=y) for x,y in zip(longitudinal,transverse)],
                      corrections=corrections))
    if extra:
        audit[-1].update(workbookCategory=r['Manufacturer'], manufacturer=manufacturer,
                         geometryOverride=dict(track=extra['track'], mainPitch=extra['mainPitch']),
                         reference=extra['reference'])

def write(path, data):
    (ROOT/path).write_text(json.dumps(data, indent=2, ensure_ascii=False)+'\n', encoding='utf-8')

write(Path('public/gear3d/data/aircraft/aircrafter-reviewed.json'), dict(schemaVersion='1.0',units=units))
write(Path('docs/gear3d-body-review/aircrafter-audit.json'), dict(
    workbook='ict-mechanics/public/data/aircraft.xlsx', sha256=digest,
    rows=len(records), activeRows=len(active), categories=dict(Counter(r['Manufacturer'] for r in active)),
    imported=audit,
    limitations=['Workbook has no 3D airframes or nose gear coordinates.',
                 'Main/belly-only rows cannot be combined without relative station data.',
                 'Representative tire fields require manufacturer verification.',
                 'Nonreviewed rows are deliberately excluded from the live catalog.']))
print(f'Imported {len(units)} independently reviewed aircraft; audited {len(active)} active workbook rows.')
