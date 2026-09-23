import { useMemo, useState } from "react";
import { useTheme, fitterColors, chartColors } from "../chartTheme";
import Card from "../ui/Card";
import Equation from "../ui/Equation";
import KpiStrip, { Kpi } from "../ui/KpiStrip";
import DataEditor from "../fitting/DataEditor";
import FittingPlot from "../fitting/FittingPlot";
import { makeRows, numberOrNaN, fmt, type EditRow } from "../fitting/shared.ts";
import { HW2_MR, HW2_CONFINEMENTS, displayConfinement } from "./data.ts";
import {
  fitModulus,
  invariants,
  predict,
  shearNormalizedModulus,
  KPA_PER_PSI,
  type Fit,
  type Model,
} from "./equations.ts";
import "../tools.css";
import "../fitting/fitting.css";
const names = { generalized: "Generalized model", bulk: "Bulk-stress model" };
const equations = [
  {
    tex: "M_r=\\sigma_d/\\varepsilon_r,\\qquad\\theta=\\sigma_d+3\\sigma_3,\\qquad\\tau_{oct}=\\sqrt{2}\\sigma_d/3",
    plain:
      "Mr = deviator stress / resilient strain; theta = deviator stress + 3 confining stress; octahedral shear = sqrt(2) deviator stress / 3",
  },
  {
    tex: "M_r=k_1p_a(\\theta/p_a)^{k_2}(1+\\tau_{oct}/p_a)^{k_3}",
    plain:
      "Generalized model: Mr = k1 pa (theta/pa)^k2 (1 + octahedral shear/pa)^k3",
  },
  {
    tex: "\\ln(M_r/p_a)=\\ln k_1+k_2\\ln(\\theta/p_a)+k_3\\ln(1+\\tau_{oct}/p_a)",
    plain:
      "Linearized generalized model: ln(Mr/pa) = ln(k1) + k2 ln(theta/pa) + k3 ln(1 + octahedral shear/pa)",
  },
  {
    tex: "M_r=k_1\\theta^{k_2},\\qquad\\ln M_r=\\ln k_1+k_2\\ln\\theta",
    plain:
      "Bulk-stress model: Mr = k1 theta^k2; ln(Mr) = ln(k1) + k2 ln(theta)",
  },
  {
    tex: "\\widehat{\\boldsymbol\\beta}=\\arg\\min_{\\boldsymbol\\beta}\\sum_i(y_i-\\mathbf{x}_i^T\\boldsymbol\\beta)^2,\\qquad k_1=e^{\\beta_0}",
    plain:
      "Fit minimizes the sum of squared log-response residuals; k1 = exp(intercept)",
  },
  {
    tex: "R^2=1-\\frac{\\sum_i(y_i-\\widehat y_i)^2}{\\sum_i(y_i-\\bar y)^2},\\qquad e_i=M_{r,i}-\\widehat M_{r,i}",
    plain:
      "R squared = 1 minus residual sum of squares divided by total sum of squares; residual = observed minus predicted modulus",
  },
  {
    tex: "\\Delta M=M_{r,g}-M_{r,b},\\quad\\Delta\\%=100\\frac{M_{r,g}-M_{r,b}}{M_{r,b}},\\quad M_r[\\mathrm{psi}]=\\frac{M_r[\\mathrm{kPa}]}{6.894757293168}",
    plain:
      "Difference = generalized minus bulk model; percent difference uses bulk model as denominator; psi = kPa / 6.894757293168",
  },
];
export default function MrFitterApp() {
  const [rows, setRows] = useState(() => makeRows(HW2_MR));
  const [model, setModel] = useState<Model | "">("");
  const [responseView, setResponseView] = useState<"normalized" | "raw">("raw");
  const [nominalGrouping, setNominalGrouping] = useState(true);
  const [pa, setPa] = useState("101.325");
  const [fits, setFits] = useState<Partial<Record<Model, Fit>>>({});
  const [error, setError] = useState("");
  const [theta, setTheta] = useState(""),
    [sd, setSd] = useState("");
  const [prediction, setPrediction] = useState<{
    theta: number;
    sd: number;
    values: { model: Model; value: number }[];
  } | null>(null);
  const theme = useTheme(),
    colors = fitterColors(theme),
    ink = chartColors(theme);
  const invalidate = () => {
    setFits({});
    setPrediction(null);
    setError("");
  };
  const changeRows = (r: EditRow[]) => {
    setRows(r);
    invalidate();
  };
  const parsed = useMemo(
    () =>
      rows
        .filter((r) => r.included)
        .map((r) => ({
          id: r.id,
          s3: numberOrNaN(r.values[0]),
          sd: numberOrNaN(r.values[1]),
          strain: numberOrNaN(r.values[2]),
        })),
    [rows],
  );
  const invalid = parsed.filter(
    (p) =>
      ![p.s3, p.sd, p.strain].every(Number.isFinite) ||
      p.s3 < 0 ||
      p.sd <= 0 ||
      p.strain <= 0,
  );
  const points = parsed.filter((p) => !invalid.includes(p)).map(invariants);
  const fit = model ? fits[model] : undefined;
  const fitSelected = () => {
    if (!model) return;
    const result = fitModulus(parsed, model, numberOrNaN(pa));
    if (!result) {
      setError(
        "The fit needs independent stress states and more readings than parameters. Check the data and atmospheric pressure.",
      );
      return;
    }
    setFits((f) => ({ ...f, [model]: result }));
    setPrediction(null);
    setError("");
  };
  const updatePrediction = (nextTheta: string, nextSd: string) => {
    const t = numberOrNaN(nextTheta), d = numberOrNaN(nextSd);
    setPrediction(
      Object.keys(fits).length && Number.isFinite(t) && Number.isFinite(d) && t > 0 && d >= 0 && d <= t
        ? { theta: t, sd: d, values: (Object.keys(fits) as Model[]).map((m) => ({ model: m, value: predict(fits[m]!, t, d) })) }
        : null,
    );
  };
  const normalized = fit?.model === "generalized" && responseView === "normalized";
  const displayModulus = (value: number, deviator: number) =>
    (normalized ? shearNormalizedModulus(fit!, value, deviator) : value) / 1000;
  const confinement = (s3: number) => displayConfinement(s3, nominalGrouping);
  const levels = [...new Set(points.map((p) => confinement(p.s3)))].sort((a, b) => a - b);
  // Reserve the five preset colors, even when a group is excluded.
  const colorLevels = [...HW2_CONFINEMENTS, ...[...new Set(rows.map((r) => confinement(numberOrNaN(r.values[0]))))]
    .filter((s3) => Number.isFinite(s3) && s3 >= 0 && !HW2_CONFINEMENTS.includes(s3 as typeof HW2_CONFINEMENTS[number]))
    .sort((a, b) => a - b)];
  const palette = [colors.blue, colors.emerald, colors.orange, colors.violet, colors.pink];
  const symbols = ["circle", "square", "diamond", "triangle-up", "hexagon"];
  const groupColor = (s3: number) => palette[colorLevels.indexOf(confinement(s3)) % palette.length];
  const groupSymbol = (s3: number) => symbols[colorLevels.indexOf(confinement(s3)) % symbols.length];
  const groupLabel = (s3: number) => `σ₃ = ${fmt(s3, 6)} kPa`;
  const responseLegend: { label: string; color: string; shape?: "line" | "dash" }[] = levels.map((s3) => ({
    label: groupLabel(s3), color: groupColor(s3),
  }));
  const traces: any[] = levels.map((s3) => {
    const group = points.filter((p) => confinement(p.s3) === s3);
    return {
      x: group.map((p) => p.theta),
      y: group.map((p) => displayModulus(p.mr, p.sd)),
      mode: "markers", name: `${groupLabel(s3)} · readings`, legendgroup: String(s3),
      text: group.map((p) => `ID ${p.id} · recorded σ₃ ${p.s3} kPa · σd ${p.sd} kPa${p.s3 !== s3 ? `<br>Display group: nominal σ₃ ${s3} kPa` : ""}<br>Measured Mr ${fmt(p.mr / 1000, 5)} MPa`),
      hovertemplate: `%{text}<br>θ %{x:.2f} kPa<br>${normalized ? "Normalized Mr" : "Mr"} %{y:.3f} MPa<extra></extra>`,
      marker: { color: groupColor(s3), symbol: groupSymbol(s3), size: 9, line: { color: ink.ink, width: 1.2 } },
    };
  });
  if (fit) {
    const lo = Math.min(...points.map((p) => p.theta));
    const hi = Math.max(...points.map((p) => p.theta));
    // The normalized generalized model and the bulk model each have ONE
    // continuous power curve. Raw generalized data require stress slices.
    const slices = normalized || fit.model === "bulk" ? [0] : levels;
    for (const s3 of slices) {
      const start = normalized || fit.model === "bulk" ? lo : Math.max(lo, 3 * s3);
      if (start >= hi) continue;
      const x = Array.from({ length: 401 }, (_, i) => start + (hi - start) * i / 400);
      const color = normalized || fit.model === "bulk" ? ink.ink : groupColor(s3);
      const name = normalized ? "Generalized power curve · shear normalized"
        : fit.model === "bulk" ? "Bulk-stress power curve" : `Model slice · σ₃ = ${fmt(s3)} kPa`;
      traces.unshift({
        x,
        y: x.map((t) => predict(fit, t, normalized ? 0 : Math.max(0, t - 3 * s3)) / 1000),
        mode: "lines", name, legendgroup: String(s3),
        line: { color, width: 3, simplify: false },
        hovertemplate: "%{x:.2f} kPa<br>%{y:.3f} MPa<extra>%{fullData.name}</extra>",
      });
      if (normalized || fit.model === "bulk") responseLegend.push({ label: name, color, shape: "line" });
    }
  }
  if (prediction) {
    const s3 = (prediction.theta - prediction.sd) / 3;
    for (const p of prediction.values.filter((p) => Number.isFinite(p.value))) {
      const color = p.model === "generalized" ? colors.violet : colors.emerald;
      const lo = Math.max(Math.min(...points.map((p) => p.theta), prediction.theta), 3 * s3);
      const hi = Math.max(...points.map((p) => p.theta), prediction.theta);
      const x = Array.from({ length: 301 }, (_, i) => lo + (hi - lo) * i / 300);
      traces.push({
        x, y: x.map((t) => displayModulus(predict(fits[p.model]!, t, Math.max(0, t - 3 * s3)), Math.max(0, t - 3 * s3))),
        mode: "lines", name: `${names[p.model]} · prediction path · σ₃ ${fmt(s3)} kPa`,
        line: { color, width: 2, dash: "dash" },
        hovertemplate: "%{x:.2f} kPa<br>%{y:.3f} MPa<extra>%{fullData.name}</extra>",
      }, {
        x: [0, prediction.theta, prediction.theta], y: [displayModulus(p.value, prediction.sd), displayModulus(p.value, prediction.sd), 0],
        mode: "lines", name: "Prediction guides", line: { color, width: 1.5, dash: "dash" }, hoverinfo: "skip",
      }, {
        x: [prediction.theta], y: [displayModulus(p.value, prediction.sd)], mode: "markers", name: `${names[p.model]} prediction`,
        marker: { color, size: 13, symbol: p.model === "generalized" ? "diamond" : "square", line: { color: ink.ink, width: 1.5 } },
        hovertemplate: `θ %{x:.2f} kPa<br>${normalized ? "Normalized prediction" : "Predicted Mr"} %{y:.3f} MPa<br>Actual prediction ${fmt(p.value / 1000, 5)} MPa<extra>%{fullData.name}</extra>`,
      });
    }
  }
  const residualTraces = fit
    ? [
        {
          x: fit.points.map((p) => p.theta),
          y: fit.points.map((p) => p.logResidual),
          mode: "markers",
          text: fit.points.map((p) => `ID ${p.id} · recorded σ₃ ${p.s3} kPa · ${groupLabel(confinement(p.s3))} group`),
          marker: { color: fit.points.map((p) => groupColor(p.s3)), symbol: fit.points.map((p) => groupSymbol(p.s3)), size: 9, line: { color: ink.ink, width: 1.2 } },
          hovertemplate:
            "%{text}<br>θ %{x:.2f}<br>log residual %{y:.4f}<extra></extra>",
        },
        {
          x: [
            Math.min(...points.map((p) => p.theta)),
            Math.max(...points.map((p) => p.theta)),
          ],
          y: [0, 0],
          mode: "lines",
          line: { color: ink.secondary, dash: "dot", width: 1 },
          hoverinfo: "skip",
        },
      ]
    : [];
  const canPredict =
    Object.keys(fits).length > 0 &&
    Number.isFinite(numberOrNaN(theta)) &&
    Number.isFinite(numberOrNaN(sd)) &&
    numberOrNaN(theta) > 0 &&
    numberOrNaN(sd) >= 0 &&
    numberOrNaN(sd) <= numberOrNaN(theta);
  return (
    <div className="cee-tool fit-tool">
      <aside className="cee-panel">
        <h2 className="cee-panel__title">Triaxial test data</h2>
        <DataEditor
          rows={rows}
          columns={["σ₃ (kPa)", "σd (kPa)", "εr (–)"]}
          onChange={changeRows}
          reset={() => { changeRows(makeRows(HW2_MR)); setNominalGrouping(true); setResponseView("raw"); }}
          exclude
        />
        {invalid.length > 0 && (
          <p className="fit-error" role="alert">
            Check IDs {invalid.map((p) => p.id).join(", ")}: confining stress
            must be nonnegative; deviator stress and strain must be positive.
            Blank entries are not zero.
          </p>
        )}
        <label className="fit-field">
          Atmospheric pressure (kPa)
          <input
            className="cee-input"
            type="number"
            step="any"
            value={pa}
            onChange={(e) => {
              setPa(e.target.value);
              invalidate();
            }}
          />
        </label>
        <label className="fit-field">
          Model to fit
          <select
            className="cee-input"
            value={model}
            onChange={(e) => {
              setModel(e.target.value as Model | "");
              setError("");
            }}
          >
            <option value="">Choose a model…</option>
            <option value="generalized">Generalized · k₁, k₂, k₃</option>
            <option value="bulk">Bulk stress · k₁, k₂</option>
          </select>
        </label>
        <button
          type="button"
          className="cee-btn cee-btn--primary"
          disabled={
            !model ||
            invalid.length > 0 ||
            parsed.length < (model === "generalized" ? 4 : 3) ||
            !(numberOrNaN(pa) > 0)
          }
          onClick={fitSelected}
        >
          Fit selected model
        </button>
        <p className="cee-hint">
          {parsed.length} readings. Fit each model to compare. Editing data or pressure clears fits and predictions.
        </p>
        {error && (
          <p className="fit-error" role="alert">
            {error}
          </p>
        )}
        <p className="fit-status">
          Review residuals before excluding readings. Exclusions are manual.
        </p>
      </aside>
      <div className="cee-results">
        <FittingPlot
          title="Stress response"
          subtitle={
            fit
              ? normalized
                ? "One continuous power curve after removing the fitted shear effect from each reading."
                : fit.model === "bulk" ? "One continuous power-law fit through the bulk-stress response."
                : `${levels.length} confinement curves from one jointly fitted model. Marker and curve colors identify the same confinement level.`
              : "Raw HW2 readings. Choose a model and fit it to draw the response curves."
          }
          xTitle="Bulk stress θ (kPa)"
          yTitle={normalized ? "Shear-normalized modulus (MPa)" : "Resilient modulus Mr (MPa)"}
          controls={(
            <div className="fit-response-controls">
              {fit?.model === "generalized" && <><div className="fit-view-toggle" role="group" aria-label="Stress response view">
                <button type="button" aria-pressed={!normalized} onClick={() => setResponseView("raw")}>Raw stress response</button>
                <button type="button" aria-pressed={normalized} onClick={() => setResponseView("normalized")}>Single power curve</button>
              </div>
              {normalized ? <>
                <Equation {...{ tex: "M_r^*=\\frac{M_r}{(1+\\tau_{oct}/p_a)^{k_3}}=k_1p_a(\\theta/p_a)^{k_2}", plain: "Shear-normalized modulus equals measured modulus divided by the fitted shear factor; its fitted response is one bulk-stress power curve." }} display />
                <p className="cee-hint">The vertical axis is adjusted using fitted k₃; original readings and predictions remain in the tables. All three coefficients are fitted together.</p>
              </> : <p className="cee-hint">The generalized model depends on bulk AND shear stress. Each line holds confinement constant; portions outside that confinement’s measured range are model projections, not additional test data. All curves share the same k₁, k₂, k₃.</p>}</>}
              {points.some((p) => p.s3 === 104.11) && <label className="cee-hint fit-grouping-note">
                <input type="checkbox" checked={nominalGrouping} onChange={(e) => setNominalGrouping(e.target.checked)} />
                Group 104.11 kPa with nominal 103.42 kPa for display. Regression always uses the recorded stresses.
              </label>}
            </div>
          )}
          traces={traces}
          legend={[
            ...(prediction ? prediction.values.map((p) => ({ label: `${names[p.model]} prediction / dashed path`, color: p.model === "generalized" ? colors.violet : colors.emerald, shape: "dash" as const })) : []),
            ...responseLegend,
          ]}
        />
        <Card
          title="Predict at your stress state"
          subtitle="Enter bulk and deviator stress. Bulk stress alone does not define the generalized model’s shear term."
        >
          <div className="fit-fields">
            <label className="fit-field">
              Bulk stress θ (kPa)
              <input
                className="cee-input"
                type="number"
                step="any"
                value={theta}
                onChange={(e) => {
                  setTheta(e.target.value);
                  updatePrediction(e.target.value, sd);
                }}
              />
            </label>
            <label className="fit-field">
              Deviator stress σd (kPa)
              <input
                className="cee-input"
                type="number"
                step="any"
                value={sd}
                onChange={(e) => {
                  setSd(e.target.value);
                  updatePrediction(theta, e.target.value);
                }}
              />
            </label>
          </div>
          <p className="cee-hint">
            Use θ &gt; 0 and 0 ≤ σd ≤ θ, so σ₃ = (θ − σd)/3 is nonnegative. Both
            fields are in kPa.
          </p>
          <button
            type="button"
            className="cee-btn cee-btn--primary"
            disabled={!canPredict}
            onClick={() =>
              setPrediction({
                theta: Number(theta),
                sd: Number(sd),
                values: (Object.keys(fits) as Model[]).map((m) => ({
                  model: m,
                  value: predict(fits[m]!, Number(theta), Number(sd)),
                })),
              })
            }
          >
            Calculate prediction
          </button>
          {prediction && (
            <div aria-live="polite">
              <p className="fit-status">
                σ₃ = {fmt((prediction.theta - prediction.sd) / 3)} kPa · τoct ={" "}
                {fmt((Math.SQRT2 * prediction.sd) / 3)} kPa.{" "}
                {prediction.theta < Math.min(...points.map((p) => p.theta)) ||
                prediction.theta > Math.max(...points.map((p) => p.theta)) ||
                prediction.sd < Math.min(...points.map((p) => p.sd)) ||
                prediction.sd > Math.max(...points.map((p) => p.sd))
                  ? "Extrapolation: this state lies outside the tested bulk/deviator ranges."
                  : "Within the tested bulk/deviator ranges; this does not guarantee coverage of their joint stress state."}
              </p>
              <div className="cee-tablewrap">
                <table className="cee-table" aria-label="Modulus predictions">
                  <thead>
                    <tr>
                      <th>Fitted model</th>
                      <th>Mr (kPa)</th>
                      <th>Mr (psi)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prediction.values.map((p) => (
                      <tr key={p.model}>
                        <th scope="row">{names[p.model]}</th>
                        <td>{fmt(p.value, 7)}</td>
                        <td>{fmt(p.value / KPA_PER_PSI, 7)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {prediction.values.length === 2 &&
                (() => {
                  const g = prediction.values.find(
                      (p) => p.model === "generalized",
                    )!.value,
                    b = prediction.values.find(
                      (p) => p.model === "bulk",
                    )!.value;
                  return (
                    <p>
                      Generalized − bulk: {fmt((g - b) / KPA_PER_PSI, 6)} psi ·{" "}
                      {fmt((100 * (g - b)) / b, 5)}% relative to the bulk-stress
                      model.
                    </p>
                  );
                })()}
              {prediction.values.some((p) => !Number.isFinite(p.value)) && (
                <p role="alert">
                  This stress state produces a nonfinite prediction. Use a
                  smaller extrapolation range.
                </p>
              )}
            </div>
          )}
        </Card>
        {fit ? (
          <>
            <KpiStrip>
              <Kpi
                compact
                label="k₁"
                value={fmt(fit.k1, 6)}
                tip={
                  fit.model === "generalized"
                    ? "Dimensionless scale in the normalized generalized model."
                    : "Unit-dependent coefficient: this fit uses kPa for both modulus and bulk stress."
                }
              />
              <Kpi
                compact
                label="k₂"
                value={fmt(fit.k2, 6)}
                tip="Exponent on bulk stress."
              />
              {fit.model === "generalized" && (
                <Kpi
                  compact
                  label="k₃"
                  value={fmt(fit.k3, 6)}
                  tip="Exponent on normalized octahedral shear plus one."
                />
              )}
              <Kpi
                compact
                label="R² · log response"
                value={fmt(fit.r2log, 5)}
                tip="Fit quality in the log space used by the regression."
              />
              <Kpi
                compact
                label="R² · modulus"
                value={fmt(fit.r2, 5)}
                tip="Fit quality after transforming predictions back to modulus. It may differ from log-space R squared."
              />
            </KpiStrip>
            <FittingPlot
              title="Inspect the residuals"
              subtitle="Observed minus fitted log modulus. Hover for reading IDs; investigate patterns before changing the included data."
              xTitle="Bulk stress θ (kPa)"
              yTitle="ln(Mr) − ln(predicted Mr)"
              traces={residualTraces}
              legend={[
                ...levels.map((s3) => ({ label: groupLabel(s3), color: groupColor(s3) })),
                { label: "Zero residual", color: ink.secondary, shape: "dash" },
              ]}
            />
          </>
        ) : (
          <p className="fit-status">
            Coefficients and residuals appear after you fit the selected model.
          </p>
        )}
        <Card title="Equations and fitting method" className="fit-equations">
          <p>
            Conventional repeated-load triaxial test: σ₁ = σ₃ + σd and σ₂ = σ₃.
            Strain is dimensionless, not microstrain. Input stresses and both
            fitted models use kPa.
          </p>
          {equations.map((e) => (
            <Equation key={e.tex} {...e} display />
          ))}
          <p>
            Both models are nonlinear power laws in stress. Linear least squares
            in log space estimates their exponents for that objective; the curves
            evaluate those equations continuously. This emphasizes relative errors.
            Fitting in modulus space would emphasize large absolute errors and is
            not inherently better. R² is
            reported in both log and modulus space; state which you use. The
            generalized k₁ is dimensionless. In the bulk-stress model, k₁ has
            units kPa^(1 − k₂) and changes with the chosen stress unit. Neither
            model is constrained to a prescribed coefficient sign.
          </p>
        </Card>
        <Card
          title="Calculation worksheet"
          subtitle="Included readings, derived stress invariants, and the selected fit. IDs remain unchanged when readings are excluded."
        >
          <div
            className="cee-tablewrap fit-scroll"
            tabIndex={0}
            role="region"
            aria-label="Modulus calculations"
          >
            <table className="cee-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>θ (kPa)</th>
                  <th>τoct (kPa)</th>
                  <th>Mr (kPa)</th>
                  <th>Predicted (kPa)</th>
                  <th>Residual (kPa)</th>
                  <th>Log residual</th>
                </tr>
              </thead>
              <tbody>
                {points.map((p) => {
                  const fitted = fit?.points.find((q) => q.id === p.id);
                  return (
                    <tr key={p.id}>
                      <th scope="row">{p.id}</th>
                      <td>{fmt(p.theta, 6)}</td>
                      <td>{fmt(p.tau, 6)}</td>
                      <td>{fmt(p.mr, 7)}</td>
                      <td>{fmt(fitted?.predicted, 7)}</td>
                      <td>{fmt(fitted?.residual, 6)}</td>
                      <td>{fmt(fitted?.logResidual, 6)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
