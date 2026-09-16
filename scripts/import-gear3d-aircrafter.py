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
# name, wheelbase mm, nose pitch mm, nose tire, MTOW, units, body length,
# nose-to-nose-gear, source. Boeing dimensions converted from published inches.
reviewed = [
    ('B787-8', 897*25.4, 28.5*25.4, '40x16R16', 502500, 'lb', 56720, 5410, boeing),
    ('B787-9', 1017*25.4, 28.5*25.4, '40x16R16', 561500, 'lb', 62810, 5410, boeing),
    ('B787-10', 1137*25.4, 28.5*25.4, '40x16R16', 560000, 'lb', 68300, 5410, boeing),
    ('A320-200 std', 12640, 500, '30x8.8R15', 73500, 'kg', 37570, 5070, a320),
    ('A350-900', 28665, 748, '1050x395R16', 272000, 'kg', 66610, 4630, airbus),
    ('A350-1000', 32484, 748, '1050x395R16', 308000, 'kg', 73590, 4630, airbus),
]
units = []
audit = []
for name, wb, nose_pitch, nose_tire, mtow, mass_unit, length, nose_offset, url in reviewed:
    matches = [r for r in active if r['Airplane Name'] == name]
    assert len(matches) == 1, name
    r = matches[0]
    transverse = [float(x)*25.4 for x in r['WheelCoord_X (in.)'].split(';')]
    longitudinal = [float(x)*25.4 for x in r['WheelCoord_Y (in.)'].split(';')]
    assert len(transverse) == len(longitudinal)
    tire = r['Repr. Tire Size'].replace('\u00d7', 'x')
    corrections = []
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
    model = name.lstrip('B') if name.startswith('B') else name.replace(' std','')
    unit = dict(schemaVersion='1.0', id=name.lower().replace(' std',''), domain='aircraft',
                manufacturer='Boeing' if name.startswith('B') else 'Airbus', model=model,
                gearDesignation={1:'D',2:'2D',3:'3D'}[gears[1]['tandemRows']],
                mtow=dict(value=mtow, unit=mass_unit, basis='Manufacturer ACAP general characteristics, selected weight variant. '+url),
                maxTaxiWeight=dict(value=r['Gross Taxi Weight (lbs)'], unit='lb', basis=source),
                percentOnMainGear=95, wheelbase=wb, mainGearTrack=abs(gears[1]['y'])*2,
                tirePressure=dict(value=pressure, unit='psi', basis='Manufacturer landing gear footprint, selected weight variant. '+url),
                assumedFields=['percentOnMainGear'], gears=gears,
                bodyFit=dict(length=length, noseOffset=nose_offset),
                notes='Complete nose and main gear. Loads use MTOW with the FAA 95% main-gear design assumption; taxi weight is separate. Body is a representative family mesh, with manufacturer length and nose station. '+ ' '.join(corrections),
                sources=[dict(id='manufacturer-acap', title='Manufacturer airport planning manual', url=url,
                              note='General characteristics and dimensions; landing gear footprint. Boeing Rev Q October 2025; Airbus A350 December 2024 / A320 December 2023.'),
                         dict(id='aircrafter',title='Aircrafter FAARFIELD-derived workbook',publisher='ICT Mechanics',
                              note=f"public/data/aircraft.xlsx; SHA256 {digest}; row {r['sourceRow']}. Main footprint only; representative tire fields independently reviewed.")])
    units.append(unit)
    audit.append(dict(id=unit['id'], row=r['sourceRow'], name=name,
                      mainWheelCoordinatesMm=[dict(x=x,y=y) for x,y in zip(longitudinal,transverse)],
                      corrections=corrections))

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
