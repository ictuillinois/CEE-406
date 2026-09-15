import { useMemo, useState } from "react";
import { useTheme, HUES, chartColors } from "../chartTheme";
import Card from "../ui/Card";
import Equation from "../ui/Equation";
import KpiStrip, { Kpi } from "../ui/KpiStrip";
import DataEditor from "../fitting/DataEditor";
import FittingPlot from "../fitting/FittingPlot";
import { makeRows, numberOrNaN, fmt, type EditRow } from "../fitting/shared.ts";
import { HW2_MR } from "./data.ts";
import {
  fitModulus,
  invariants,
  predict,
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
    colors = HUES[theme],
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
  const traces: any[] = [
    {
      x: points.map((p) => p.theta),
      y: points.map((p) => p.mr / 1000),
      mode: "markers",
      name: "Included readings",
      text: points.map((p) => `ID ${p.id} · σ₃ ${p.s3} kPa · σd ${p.sd} kPa`),
      hovertemplate:
        "%{text}<br>θ %{x:.2f} kPa<br>Mr %{y:.3f} MPa<extra></extra>",
      marker: { color: colors.orange, size: 7 },
    },
  ];
  if (fit) {
    const groups = [...new Set(points.map((p) => p.s3))].sort((a, b) => a - b);
    for (const s3 of fit.model === "bulk" ? [0] : groups) {
      const subset =
        fit.model === "bulk" ? points : points.filter((p) => p.s3 === s3);
      const lo = Math.min(...subset.map((p) => p.theta)),
        hi = Math.max(...subset.map((p) => p.theta));
      const x = Array.from({ length: 60 }, (_, i) => lo + ((hi - lo) * i) / 59);
      traces.unshift({
        x,
        y: x.map((t) => predict(fit, t, Math.max(0, t - 3 * s3)) / 1000),
        mode: "lines",
        name: fit.model === "bulk" ? "Bulk-stress fit" : `Fit · σ₃ ${s3} kPa`,
        line: { color: colors.blue, width: 2 },
        hovertemplate:
          "%{x:.2f} kPa<br>%{y:.3f} MPa<extra>%{fullData.name}</extra>",
      });
    }
  }
  const residualTraces = fit
    ? [
        {
          x: fit.points.map((p) => p.theta),
          y: fit.points.map((p) => p.logResidual),
          mode: "markers",
          text: fit.points.map((p) => `ID ${p.id}`),
          marker: { color: colors.orange, size: 8 },
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
          reset={() => changeRows(makeRows(HW2_MR))}
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
          {parsed.length} included readings. Fit each model separately to
          compare them. Editing data or pressure clears prior fits and
          predictions.
        </p>
        {error && (
          <p className="fit-error" role="alert">
            {error}
          </p>
        )}
        <p className="fit-status">
          Choose exclusions from residual structure and test context. No
          readings are removed automatically.
        </p>
      </aside>
      <div className="cee-results">
        <FittingPlot
          title="Stress response"
          subtitle={
            fit
              ? `${names[fit.model]} · curves hold confining stress constant; markers are included readings.`
              : "Raw HW2 readings. Choose a model and fit it to draw the response curves."
          }
          xTitle="Bulk stress θ (kPa)"
          yTitle="Resilient modulus Mr (MPa)"
          traces={traces}
          legend={[
            { label: "Included readings", color: colors.orange },
            ...(fit
              ? [
                  {
                    label: "Fitted response",
                    color: colors.blue,
                    shape: "line" as const,
                  },
                ]
              : []),
          ]}
        />
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
                { label: "Log residual", color: colors.orange },
                { label: "Zero residual", color: ink.secondary, shape: "dash" },
              ]}
            />
          </>
        ) : (
          <p className="fit-status">
            Coefficients and residuals appear after you fit the selected model.
          </p>
        )}
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
                  setPrediction(null);
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
                  setPrediction(null);
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
            Ordinary least squares is applied to the natural-log response. R² is
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
