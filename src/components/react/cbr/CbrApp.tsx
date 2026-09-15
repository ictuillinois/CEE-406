import { useState } from "react";
import { useTheme, fitterColors, chartColors } from "../chartTheme";
import Card from "../ui/Card";
import Equation from "../ui/Equation";
import DataEditor from "../fitting/DataEditor";
import FittingPlot from "../fitting/FittingPlot";
import { makeRows, numberOrNaN, fmt, type EditRow } from "../fitting/shared.ts";
import { HW2_CBR } from "./data.ts";
import { fitTangent, calculateCbrBracket } from "./equations.ts";
import "../tools.css";
import "../fitting/fitting.css";
type Calculation = NonNullable<ReturnType<typeof calculateCbrBracket>>;
const equations = [
  {
    tex: "\\delta_c=\\delta_m-\\delta_0,\\qquad\\delta_m=\\delta_c+\\delta_0",
    plain:
      "Corrected penetration = measured penetration minus origin correction; measured target = corrected target plus origin correction",
  },
  {
    tex: "p=m\\delta+b,\\quad m=\\frac{\\sum_i(\\delta_i-\\bar\\delta)(p_i-\\bar p)}{\\sum_i(\\delta_i-\\bar\\delta)^2},\\quad b=\\bar p-m\\bar\\delta,\\quad\\delta_0=-b/m",
    plain:
      "Selected-region line: pressure = slope times penetration + intercept; slope is covariance divided by penetration variance; origin intercept = minus intercept / slope",
  },
  {
    tex: "t=\\frac{\\delta_c-\\delta_{c,L}}{\\delta_{c,U}-\\delta_{c,L}},\\qquad p(\\delta_c)=p_L+t(p_U-p_L)",
    plain:
      "Linear interpolation: fraction = (target minus lower corrected penetration) / (upper minus lower corrected penetration); pressure = lower pressure + fraction times pressure difference",
  },
  {
    tex: "\\mathrm{CBR}_{0.10}=100\\frac{p(0.10)}{p_{s,0.10}},\\qquad\\mathrm{CBR}_{0.20}=100\\frac{p(0.20)}{p_{s,0.20}}",
    plain:
      "CBR at each standard penetration = 100 times interpolated specimen pressure / standard-stone pressure at the same penetration",
  },
];
export default function CbrApp() {
  const [rows, setRows] = useState(() => makeRows(HW2_CBR));
  const [origin, setOrigin] = useState("0");
  const [start, setStart] = useState(""),
    [end, setEnd] = useState("");
  const [choices, setChoices] = useState([
    { lower: "", upper: "", standard: "1000" },
    { lower: "", upper: "", standard: "1500" },
  ]);
  const [results, setResults] = useState<(Calculation | null)[]>([null, null]);
  const [errors, setErrors] = useState(["", ""]);
  const theme = useTheme(),
    colors = fitterColors(theme),
    ink = chartColors(theme);
  const changeRows = (r: EditRow[]) => {
    setRows(r);
    setResults([null, null]);
    setErrors(["", ""]);
  };
  const changeOrigin = (v: string) => {
    setOrigin(v);
    setResults([null, null]);
    setErrors(["", ""]);
  };
  const points = rows
    .map((r) => ({
      id: r.id,
      pen: numberOrNaN(r.values[0]),
      load: numberOrNaN(r.values[1]),
    }))
    .sort((a, b) => a.pen - b.pen);
  const invalid = points.some(
    (p) =>
      !Number.isFinite(p.pen) ||
      !Number.isFinite(p.load) ||
      p.pen < 0 ||
      p.load < 0,
  );
  const duplicate = points.some((p, i) => i > 0 && p.pen === points[i - 1].pen);
  const usable = !invalid && !duplicate && points.length >= 2;
  const offset = numberOrNaN(origin),
    validOrigin = Number.isFinite(offset) && offset >= 0;
  const si = points.findIndex((p) => String(p.id) === start),
    ei = points.findIndex((p) => String(p.id) === end);
  const tangent =
    usable && si >= 0 && ei > si ? fitTangent(points.slice(si, ei + 1)) : null;
  const traces: any[] = usable
    ? [
        {
          x: points.map((p) => p.pen),
          y: points.map((p) => p.load),
          text: points.map((p) => `ID ${p.id}`),
          name: "Measured",
          mode: "lines+markers",
          line: { color: colors.blue, width: 3 },
          marker: { color: colors.blue, size: 9, line: { color: ink.ink, width: 1.2 } },
          hovertemplate:
            "%{text}<br>Measured %{x:.4f} in<br>%{y:.2f} psi<extra></extra>",
        },
      ]
    : [];
  if (usable && validOrigin && offset !== 0)
    traces.push({
      x: points.map((p) => p.pen - offset),
      y: points.map((p) => p.load),
      name: "Corrected",
      mode: "lines+markers",
      line: { color: colors.emerald, width: 3 },
      marker: { color: colors.emerald, size: 9, symbol: "square", line: { color: ink.ink, width: 1.2 } },
      hovertemplate: "Corrected %{x:.4f} in<br>%{y:.2f} psi<extra></extra>",
    });
  const xMin = usable ? Math.min(0, points[0].pen - (validOrigin ? offset : 0), tangent?.origin ?? 0) : 0;
  const xMax = usable ? Math.max(...points.map((p) => p.pen)) : 1;
  const xPad = Math.max(xMax - xMin, 0.01) * 0.04;
  const xRange: [number, number] = [xMin - xPad, xMax + xPad];
  const yMax = usable ? Math.max(1, ...points.map((p) => p.load)) * 1.08 : 1;
  if (tangent) {
    traces.push({
      x: xRange,
      y: xRange.map((x) => tangent.slope * x + tangent.intercept),
      mode: "lines",
      name: "Selected tangent",
      line: { color: colors.violet, dash: "dash", width: 2 },
      hovertemplate:
        "%{x:.4f} in<br>%{y:.2f} psi<extra>Selected-region line</extra>",
    });
    traces.push({
      x: [tangent.origin],
      y: [0],
      mode: "markers",
      name: "Tangent intercept",
      marker: { color: colors.violet, size: 11, symbol: "diamond", line: { color: ink.ink, width: 1.2 } },
      hovertemplate: "Intercept %{x:.5f} in<extra></extra>",
    });
  }
  const calculate = (i: number) => {
    const c = choices[i],
      a = points.findIndex((p) => String(p.id) === c.lower),
      b = points.findIndex((p) => String(p.id) === c.upper);
    let message = "";
    if (!usable || !validOrigin)
      message = "Correct the test data and origin first.";
    else if (a < 0 || b < 0 || !(a === b || b === a + 1))
      message =
        "Choose adjacent readings in penetration order, or the same reading at an exact target.";
    const value = !message
      ? calculateCbrBracket(
          points[a],
          points[b],
          i === 0 ? 0.1 : 0.2,
          offset,
          numberOrNaN(c.standard),
        )
      : null;
    if (!message && !value)
      message =
        "The readings must bracket the corrected target. Standard pressure must be positive; values outside the measured range are not extrapolated.";
    setErrors((e) => e.map((v, j) => (j === i ? message : v)));
    setResults((r) => r.map((v, j) => (j === i ? value : v)));
  };
  const editChoice = (
    i: number,
    key: "lower" | "upper" | "standard",
    value: string,
  ) => {
    setChoices((cs) =>
      cs.map((c, j) => (j === i ? { ...c, [key]: value } : c)),
    );
    setResults((r) => r.map((v, j) => (j === i ? null : v)));
    setErrors((es) => es.map((v, j) => (j === i ? "" : v)));
  };
  const options = (
    <>
      <option value="">Choose a reading…</option>
      {points.map((p) => (
        <option key={p.id} value={p.id}>
          ID {p.id} · {fmt(p.pen)} in measured{validOrigin ? ` · ${fmt(p.pen - offset)} in corrected` : ""}
        </option>
      ))}
    </>
  );
  return (
    <div className="cee-tool fit-tool">
      <aside className="cee-panel">
        <h2 className="cee-panel__title">Penetration test data</h2>
        <DataEditor
          rows={rows}
          columns={["Penetration (in)", "Pressure (psi)"]}
          onChange={changeRows}
          reset={() => {
            changeRows(makeRows(HW2_CBR));
            changeOrigin("0");
            setStart("");
            setEnd("");
            setChoices([
              { lower: "", upper: "", standard: "1000" },
              { lower: "", upper: "", standard: "1500" },
            ]);
          }}
        />
        {!usable && rows.length > 0 && (
          <p className="fit-error" role="alert">
            Enter at least two complete, nonnegative readings with distinct
            penetrations. Duplicate penetrations cannot define an interpolation
            interval.
          </p>
        )}
        <h3 className="cee-panel__title">Explore a tangent</h3>
        <p className="cee-hint">
          Choose the endpoints of a region you consider linear. Two readings
          define a secant approximation to a tangent; more readings fit a
          least-squares line through the selected region.
        </p>
        <div className="fit-fields">
          <label className="fit-field">
            First reading
            <select
              className="cee-input"
              value={start}
              onChange={(e) => {
                setStart(e.target.value);
                const i = points.findIndex(
                  (p) => String(p.id) === e.target.value,
                );
                setEnd(
                  i >= 0 && i < points.length - 1
                    ? String(points[i + 1].id)
                    : "",
                );
              }}
            >
              {options}
            </select>
          </label>
          <label className="fit-field">
            Last reading
            <select
              className="cee-input"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            >
              {options}
            </select>
          </label>
        </div>
        {start && !tangent && (
          <p className="fit-error">
            Select a later last reading and a region with a positive fitted
            slope.
          </p>
        )}
        {tangent && (
          <div className="fit-status" aria-live="polite">
            Slope: {fmt(tangent.slope, 6)} psi/in
            <br />
            Pressure intercept: {fmt(tangent.intercept, 6)} psi
            <br />
            Penetration intercept: <strong>{fmt(tangent.origin, 6)} in</strong>
            <div className="fit-actions">
              <button
                type="button"
                className="cee-chip"
                disabled={tangent.origin < 0}
                onClick={() => changeOrigin(String(tangent.origin))}
              >
                Use this origin correction
              </button>
            </div>
          </div>
        )}
        <p className="cee-hint">
          The tangent is exploratory. Moving it does not change the applied
          correction until you choose to use its intercept.
        </p>
      </aside>
      <div className="cee-results">
        <FittingPlot
          title="Pressure–penetration curve"
          subtitle="Inspect the initial toe and choose a linear region. Measured and corrected curves use their respective penetration origins."
          xTitle="Penetration (in)"
          yTitle="Piston pressure (psi)"
          traces={traces}
          height={440}
          xRange={xRange}
          yRange={[-0.04 * yMax, yMax]}
          legend={[
            { label: "Measured", color: colors.blue },
            ...(validOrigin && offset !== 0
              ? [
                  {
                    label: "Corrected",
                    color: colors.emerald,
                    shape: "line" as const,
                  },
                ]
              : []),
            ...(tangent
              ? [
                  {
                    label: "Selected tangent",
                    color: colors.violet,
                    shape: "dash" as const,
                  },
                ]
              : []),
          ]}
        />
        <Card title="Origin correction">
        <label className="fit-field">
          Origin correction δ₀ (in)
          <input
            className="cee-input"
            type="number"
            step="any"
            min="0"
            value={origin}
            onChange={(e) => changeOrigin(e.target.value)}
          />
        </label>
        {!validOrigin && (
          <p role="alert" className="fit-error">
            Enter a finite, nonnegative correction. Use 0 for the measured
            origin.
          </p>
        )}
        </Card>
        <Card
          title="Measured and corrected penetrations"
          subtitle="Pressure is unchanged. Negative corrected penetrations are retained to show the part of the toe before the new origin."
        >
          <div className="cee-tablewrap">
            <table className="cee-table" aria-label="Corrected penetration worksheet">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Measured (in)</th>
                  <th>Correction (in)</th>
                  <th>Corrected (in)</th>
                  <th>Pressure (psi)</th>
                </tr>
              </thead>
              <tbody>
                {points.map((p) => (
                  <tr key={p.id}>
                    <th scope="row">{p.id}</th>
                    <td>{fmt(p.pen, 6)}</td>
                    <td>{validOrigin ? fmt(offset, 6) : "—"}</td>
                    <td>{validOrigin ? fmt(p.pen - offset, 6) : "—"}</td>
                    <td>{fmt(p.load, 6)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card
          title="Calculate the two CBR values"
          subtitle="Choose the bracketing readings for each corrected penetration, then calculate. The reference pressures are provided in HW2."
        >
          <p className="cee-hint">
            A target at corrected penetration δc is read at measured penetration
            δc + δ₀. Select adjacent IDs in penetration order. If the target is
            an exact reading, select it in both fields.
          </p>
          <div
            className="cee-tablewrap"
            tabIndex={0}
            role="region"
            aria-label="CBR calculation inputs"
          >
            <table className="cee-table">
              <thead>
                <tr>
                  <th>Target (in)</th>
                  <th>Lower reading</th>
                  <th>Upper reading</th>
                  <th>Standard (psi)</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {choices.map((c, i) => (
                  <tr key={i}>
                    <th scope="row">{i === 0 ? "0.10" : "0.20"}</th>
                    <td>
                      <select
                        className="cee-input fit-table-input"
                        aria-label={`Lower reading for ${i === 0 ? "0.10" : "0.20"}`}
                        value={c.lower}
                        onChange={(e) => editChoice(i, "lower", e.target.value)}
                      >
                        {options}
                      </select>
                    </td>
                    <td>
                      <select
                        className="cee-input fit-table-input"
                        aria-label={`Upper reading for ${i === 0 ? "0.10" : "0.20"}`}
                        value={c.upper}
                        onChange={(e) => editChoice(i, "upper", e.target.value)}
                      >
                        {options}
                      </select>
                    </td>
                    <td>
                      <input
                        className="cee-input fit-table-input"
                        aria-label={`Standard pressure for ${i === 0 ? "0.10" : "0.20"}`}
                        type="number"
                        step="any"
                        min="0"
                        value={c.standard}
                        onChange={(e) =>
                          editChoice(i, "standard", e.target.value)
                        }
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="cee-btn cee-btn--sm"
                        disabled={
                          !usable || !validOrigin || !c.lower || !c.upper
                        }
                        onClick={() => calculate(i)}
                      >
                        Calculate CBR {i === 0 ? "0.10" : "0.20"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {errors.map(
            (e, i) =>
              e && (
                <p key={i} role="alert" className="fit-error">
                  CBR {i === 0 ? "0.10" : "0.20"}: {e}
                </p>
              ),
          )}
          <div className="cee-tablewrap" aria-live="polite">
            <table className="cee-table" aria-label="CBR results">
              <thead>
                <tr>
                  <th>Corrected target (in)</th>
                  <th>Measured target (in)</th>
                  <th>Fraction t</th>
                  <th>Pressure (psi)</th>
                  <th>Standard (psi)</th>
                  <th>CBR (%)</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={i}>
                    <th scope="row">{i === 0 ? "0.10" : "0.20"}</th>
                    <td>{fmt(r?.measuredTarget, 6)}</td>
                    <td>{fmt(r?.fraction, 6)}</td>
                    <td>{fmt(r?.pressure, 6)}</td>
                    <td>{fmt(r?.standard, 6)}</td>
                    <td>
                      <strong>{fmt(r?.cbr, 6)}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="fit-status">
            Changing a reading, correction, or calculation input clears the
            affected result. Compare your uncorrected and corrected calculations
            and explain the difference in your own report.
          </p>
        </Card>
        <Card title="Equations and construction" className="fit-equations">
          {equations.map((e) => (
            <Equation key={e.tex} {...e} display />
          ))}
          <p>
            Penetrations are in inches and pressures in psi. The reference
            pressures are 1000 psi at 0.10 in and 1500 psi at 0.20 in. A reading
            exactly at the target needs no interpolation. A piecewise-linear
            dataset has no unique tangent at a corner; selecting a region makes
            your approximation explicit.
          </p>
          <p>
            Source: CEE 406 HW2, Fall 2026, Q5. Decide whether the initial curve
            shape justifies your chosen correction. The tool does not choose a
            tangent region or a governing CBR for you.
          </p>
        </Card>
      </div>
    </div>
  );
}
