// ACR/PCR Compatibility — decide where an aircraft may operate from the
// runway rating codes. ICAO ACR/PCR, which replaced ACN/PCN in November 2024.
// Supports HW10 Problem 1a.
import { useMemo, useState } from 'react';
import Tip from '../Tip';
import { useTheme, num, fmt, HUES } from '../chartTheme';
import KpiStrip, { Kpi } from '../ui/KpiStrip';
import Card from '../ui/Card';
import {
  parseRunwayCode, evaluate, PAVEMENT_TYPE, SUBGRADE, TIRE, EVALUATION,
  OVERLOAD_ALLOWANCE, type RunwayCode,
} from './equations';
import '../tools.css';

interface RunwayRow { id: number; code: string; acr: string }
let nextId = 100;

/** The three runways of HW10 Problem 1a. */
const DEMO: [string, string][] = [
  ['700/R/C/Y/T', '680'],
  ['650/F/C/Y/T', '680'],
  ['600/F/B/X/T', '620'],
];

export default function AcrApp() {
  const [rows, setRows] = useState<RunwayRow[]>(
    DEMO.map(([code, acr]) => ({ id: nextId++, code, acr }))
  );
  const [aircraft, setAircraft] = useState('B747-400');
  const [tire, setTire] = useState('200');

  const theme = useTheme();
  const tirePsi = num(tire, 200);

  const results = useMemo(() => rows.map(r => {
    const parsed = parseRunwayCode(r.code);
    const acr = num(r.acr, NaN);
    return {
      id: r.id,
      raw: r.code,
      parsed,
      acr,
      verdict: parsed && Number.isFinite(acr) ? evaluate(parsed, acr, tirePsi) : null,
    };
  }), [rows, tirePsi]);

  const usable = results.filter(r => r.verdict?.ok).length;
  const overload = results.filter(r => r.verdict?.overload).length;

  const update = (id: number, patch: Partial<RunwayRow>) =>
    setRows(rs => rs.map(r => (r.id === id ? { ...r, ...patch } : r)));

  const describe = (c: RunwayCode) =>
    `PCR ${c.pcr} · ${PAVEMENT_TYPE[c.type]} · subgrade ${c.subgrade} (${SUBGRADE[c.subgrade].name}) · ` +
    `tire ${c.tire} (${TIRE[c.tire].psi === null ? 'unlimited' : `≤ ${TIRE[c.tire].psi} psi`}) · ${EVALUATION[c.method]}`;

  return (
    <div className="cee-tool">
      <aside className="cee-panel">
        <h2 className="cee-panel__title">Aircraft</h2>
        <div className="cee-field">
          <label className="cee-field__label" htmlFor="acr-ac">
            <span>Designation<Tip text="Label only — it does not look anything up. The ACR values come from the aircraft's published ACR table for each pavement type and subgrade." /></span>
          </label>
          <input id="acr-ac" className="cee-input" type="text" value={aircraft}
            onChange={e => setAircraft(e.target.value)} />
        </div>
        <div className="cee-field">
          <label className="cee-field__label" htmlFor="acr-tp">
            <span>Tire pressure<Tip text="Main gear tire pressure. It is checked against the runway's tire pressure code independently of the strength check — an aircraft can pass on strength and still be excluded on tire pressure." /></span>
            <span className="cee-field__unit">psi</span>
          </label>
          <input id="acr-tp" className="cee-input" type="number" min="0" step="5" value={tire}
            onChange={e => setTire(e.target.value)} />
        </div>

        <h2 className="cee-panel__title" style={{ marginTop: '1rem' }}>Runways</h2>
        <div className="cee-field">
          <span className="cee-field__label">
            <span>Rating &amp; aircraft ACR<Tip text="Enter the runway's five-part PCR code, then the aircraft's ACR quoted for THAT pavement type and subgrade category — a different runway means a different ACR from the same table." /></span>
            <span className="cee-field__unit">code · ACR</span>
          </span>
          {rows.map(r => (
            <div className="cee-axle-row cee-axle-row--2" key={r.id}>
              <input className="cee-input" type="text" value={r.code} aria-label="Runway rating code"
                onChange={e => update(r.id, { code: e.target.value })} />
              <input className="cee-input" type="number" min="0" step="10" value={r.acr}
                aria-label="Aircraft ACR" onChange={e => update(r.id, { acr: e.target.value })} />
              <button className="cee-axle-remove" type="button" aria-label="Remove runway"
                onClick={() => setRows(rs => rs.filter(x => x.id !== r.id))}>×</button>
            </div>
          ))}
          <button className="cee-btn cee-btn--ghost cee-btn--sm" type="button"
            onClick={() => setRows(rs => [...rs, { id: nextId++, code: '600/F/C/Y/T', acr: '600' }])}>
            + Add runway
          </button>
        </div>

        <p className="cee-hint">
          ICAO ACR/PCR, in force since November 2024. The code reads
          <code> PCR / type / subgrade / tire / method</code>.
        </p>
      </aside>

      <div className="cee-results">
        <details className="cee-howto">
          <summary>How to use this tool</summary>
          <div className="cee-howto__body">
            <ol>
              <li><strong>Read the runway code</strong>: PCR number, R or F for rigid or flexible, the subgrade category A–D, the tire pressure code W–Z, and how the rating was derived.</li>
              <li><strong>Look up the aircraft's ACR</strong> for that same pavement type and subgrade category — the ACR is not a single number, it is a table.</li>
              <li><strong>Compare.</strong> ACR ≤ PCR is unrestricted. Above that, up to about {(OVERLOAD_ALLOWANCE * 100).toFixed(0)}% is an occasional-overload movement, not a routine one.</li>
              <li><strong>Check the tire pressure separately.</strong> It is an independent gate; passing on strength does not help if the tires are too hard for the surface.</li>
            </ol>
            This tool does the comparison and the code parsing — the part students most often get wrong — but the ACR values are yours to look up, because they come from published aircraft tables that are not reproduced here.
          </div>
        </details>

        <KpiStrip>
          <Kpi accent label="Runways usable" value={usable} unit={`of ${results.length}`}
            tip="Runways where the aircraft may operate without restriction: ACR within PCR and tire pressure within the coded limit." />
          <Kpi label="Overload only" value={overload}
            tip="Runways the aircraft can use only as an occasional overload movement, not for scheduled operations." />
          <Kpi compact label="Aircraft" value={aircraft || '—'}
            tip="The aircraft under evaluation." />
          <Kpi label="Tire pressure" value={fmt(tirePsi, 0)} unit="psi"
            tip="Checked against each runway's tire pressure code." />
        </KpiStrip>

        {results.map(r => (
          <Card
            key={r.id}
            title={r.raw}
            subtitle={r.parsed ? describe(r.parsed) : 'Not a valid five-part rating code'}
            affordance={
              r.verdict ? (
                <span
                  className="cee-chip"
                  style={{
                    cursor: 'default',
                    color: r.verdict.ok ? 'var(--cee-positive)' : r.verdict.overload ? 'var(--cee-warning)' : 'var(--cee-negative)',
                    borderColor: 'currentColor',
                  }}
                >
                  {r.verdict.ok ? 'Permitted' : r.verdict.overload ? 'Overload only' : 'Not permitted'}
                </span>
              ) : undefined
            }
          >
            {!r.parsed ? (
              <p className="cee-warn"><span className="cee-warn__icon">⚠️</span><span>
                Could not parse <strong>{r.raw}</strong>. The format is
                <code> PCR/type/subgrade/tire/method</code>, for example <code>700/R/C/Y/T</code>.
              </span></p>
            ) : !Number.isFinite(r.acr) ? (
              <p className="cee-warn"><span className="cee-warn__icon">⚠️</span><span>
                Enter the aircraft's ACR for a {PAVEMENT_TYPE[r.parsed.type].toLowerCase()} pavement on
                subgrade {r.parsed.subgrade}.
              </span></p>
            ) : (
              <>
                <div className="cee-probe__vals" style={{ marginTop: 0 }}>
                  <span>ACR <strong>{fmt(r.acr, 0)}</strong></span>
                  <span>PCR <strong>{fmt(r.parsed.pcr, 0)}</strong></span>
                  <span>ACR/PCR <strong>{fmt(r.verdict!.ratio, 3)}</strong></span>
                  <span>Subgrade <strong>{r.parsed.subgrade}</strong> · {r.parsed.type === 'R'
                    ? SUBGRADE[r.parsed.subgrade].rigid
                    : SUBGRADE[r.parsed.subgrade].flexible}</span>
                </div>
                <ul style={{ margin: '0.75rem 0 0', paddingLeft: '1.1rem' }}>
                  {r.verdict!.reasons.map((reason, i) => (
                    <li key={i} style={{ fontSize: '0.8125rem', lineHeight: 1.6, color: 'var(--cee-secondary)', marginBottom: '0.25rem' }}>
                      {reason}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card>
        ))}

        <p className="cee-note">
          ICAO Annex 14 ACR/PCR. The ACR is reported for a specific pavement type and one of four
          subgrade categories — A high, B medium, C low, D ultra low — so the same aircraft has a
          different ACR on each runway. Tire pressure codes cap the surface at W unlimited,
          X ≤ 254 psi, Y ≤ 181 psi, Z ≤ 73 psi. The final letter records whether the PCR came from a
          technical evaluation (T) or from using-aircraft experience (U); it does not change the
          comparison, but a U rating carries more uncertainty. The
          {' '}{(OVERLOAD_ALLOWANCE * 100).toFixed(0)}% overload allowance applies to occasional
          movements on pavements in good condition, not to scheduled traffic.
        </p>
      </div>
    </div>
  );
}
