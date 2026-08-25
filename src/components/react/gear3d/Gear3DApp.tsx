// Gear3D — the island shell.
//
// This component owns the markup and nothing else: every control below is
// driven imperatively by `initGear3D`, which is a Three.js app and not a React
// one. Keeping the two apart is the same decision crosssection/CrossSectionApp
// records — the engine stays portable and testable, and React is never asked
// to re-render a WebGL scene sixty times a second. Every input is therefore
// uncontrolled (`defaultValue` / `defaultChecked`); the engine writes to them
// directly and React must not fight it for ownership.
//
// Control help is carried on `title` rather than the site's <Tip> component,
// for the reason crosssection found: both side rails are `overflow: auto`
// scroll containers 264px and 288px wide, and an absolutely positioned popover
// anchored inside one is clipped on two edges. The how-to panel above the
// studio carries the longer explanations.
import { useEffect, useRef, useState } from 'react';
import { G3_PATHS, type G3IconName } from './icons';
import { initGear3D } from './gear3d.js';
import '../tools.css';
import './gear3d.css';

const base = import.meta.env.BASE_URL;

function Icon({ name }: { name: G3IconName }) {
  return (
    <svg
      className="g3-i"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: G3_PATHS[name] }}
    />
  );
}

export default function Gear3DApp() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let dispose: (() => void) | undefined;
    try {
      dispose = initGear3D(root);
    } catch (err) {
      // The one failure worth naming: no WebGL context. Everything else in the
      // boot path is DOM work that cannot fail on a browser that got this far.
      setFailure(
        err instanceof Error && /webgl/i.test(err.message)
          ? 'This browser could not open a WebGL context, so the 3-D viewport cannot start. Hardware acceleration is usually the cause — check it is enabled in your browser settings.'
          : 'Gear3D failed to start in this browser.'
      );
    }
    return () => { if (dispose) dispose(); };
  }, []);

  return (
    <div className="cee-tool g3-tool">

      <details className="cee-howto">
        <summary>How to use this tool</summary>
        <div className="cee-howto__body">
          <ol>
            <li><strong>Pick a vehicle.</strong> Choose a domain — truck, aircraft, or a bare gear configuration — then a class and a model. Trucks are FHWA classes 1–13; aircraft come from FAA Order 5300.7 and the manufacturers' own airport planning documents. Every axle in the library carries a cited source, and every load carries the basis it was taken from.</li>
            <li><strong>Read the layout, not the picture.</strong> The tool opens in <strong>Quad</strong> — plan, 3D, side and front together — because a gear configuration is a plan first, and a single pictorial view is the one arrangement that hides the spacings you need. Click any pane to open it full size.</li>
            <li><strong>Turn on the dimensions you need.</strong> Longitudinal spacings are on by default. Add transverse to get track widths and dual spacings. <strong>Measure</strong> (M) lets you take your own dimension between any two features — endpoints snap to tire centres and edges, contact patches, and axle centrelines.</li>
            <li><strong>Draw the footprints.</strong> Under Contact patches, tick <em>Draw footprints</em>. Three models are offered because the literature offers three: a rectangle, Huang's rectangle with semicircular ends (Ch. 2), and an ellipse. They give different contact areas for the same load, which is the point — compare them before you trust one.</li>
            <li><strong>Take the numbers out.</strong> <code>footprint.csv</code> gives you every patch corner in the engineering frame, in millimetres, ready for a finite-element pre-processor. <strong>FEM export</strong> writes the Abaqus form. The figure exports (PNG, SVG, PDF) keep the dimensions vector, so a figure stays sharp in a report at any size.</li>
          </ol>
          <p>
            Contact pressure is taken equal to inflation pressure and uniform over the patch.
            Both are idealisations, and both are stated in full in the header of every export.
            If you have <em>measured</em> footprint dimensions, enter them under Override — an
            overridden patch keeps its load and reports the contact pressure that implies, so it
            no longer equals inflation pressure, and every export says which patches were
            overridden.
          </p>
        </div>
      </details>

      {failure && <p className="cee-warn">{failure}</p>}

      <div className="g3-app" ref={rootRef}>

        {/* App header — a drafting title block. Every cell carries information
            that is actually true of the loaded model; nothing here is
            decorative copy. */}
        <div className="app-header">
          <div className="g3-titleblock">

            {/* Originator block: mark, name, and the way back. */}
            <div className="g3-tb-mark">
              <span className="g3-tb-icon" aria-hidden="true">
                {/* A wheel seen face on: tyre ring and hub, drawn for this app
                    rather than borrowed from an icon font. */}
                <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="3">
                  <circle cx="12" cy="12" r="9.4" />
                  <circle cx="12" cy="12" r="3.1" strokeWidth="2.4" />
                </svg>
              </span>
              <span className="g3-tb-id">
                <span className="g3-tb-name">Gear<b>3D</b></span>
                <a href={`${base}tools/`} className="g3-tb-back">
                  <Icon name="arrow-left" /> Tools
                </a>
              </span>
            </div>

            {/* Subject. The drawing title of the sheet: the one field that
                changes, so the one that gets weight. */}
            <div className="g3-tb-subject">
              <span className="g3-tb-label" id="g3-tb-class">—</span>
              <span className="g3-tb-title">
                <span id="g3-tb-loaded">—</span>
                <span className="g3-tb-flag" id="g3-tb-flag" hidden />
              </span>
            </div>

            <div className="g3-tb-cell">
              <span className="g3-tb-label">Tires</span>
              <span className="g3-tb-value" id="g3-tb-tires">—</span>
            </div>
            <div className="g3-tb-cell g3-tb-cell--wide">
              <span className="g3-tb-label">Library</span>
              <span className="g3-tb-value"><span id="g3-unit-count">—</span> vehicles</span>
            </div>
            <div className="g3-tb-cell g3-tb-cell--wide">
              <span className="g3-tb-label">Units</span>
              <span className="g3-tb-value">mm · kN · kPa</span>
            </div>
            <div className="g3-tb-cell g3-tb-cell--rev">
              <span className="g3-tb-label">Rev</span>
              <span className="g3-tb-value" id="g3-tb-rev">—</span>
            </div>
          </div>
        </div>

        {/* Studio */}
        <div className="g3-studio">

          {/* Toolbar */}
          <div className="g3-toolbar" role="toolbar" aria-label="Main toolbar">
            {/* Quad leads because it is the default: a gear configuration is a
                plan first, and the composite sheet answers "where are the
                wheels" that a single pictorial view answers worst. The
                V-then-digit shortcuts follow this order. */}
            <div className="g3-viewtabs" role="tablist" aria-label="View mode">
              <button type="button" className="g3-vtab is-active" data-view="quad" role="tab" aria-selected="true" title="All four views in one frame (V then 1) — click a pane to open it full size">Quad</button>
              <button type="button" className="g3-vtab" data-view="3d" role="tab" aria-selected="false" title="Free 3D view (V then 2)">3D</button>
              <button type="button" className="g3-vtab" data-view="plan" role="tab" aria-selected="false" title="Plan view — locked (V then 3)">Plan</button>
              <button type="button" className="g3-vtab" data-view="side" role="tab" aria-selected="false" title="Side view — locked (V then 4)">Side</button>
              <button type="button" className="g3-vtab" data-view="front" role="tab" aria-selected="false" title="Front view — locked (V then 5)">Front</button>
            </div>
            <span className="g3-tool-sep" />
            <button type="button" id="g3-catalogue" className="g3-btn" title="FAA Order 5300.7 gear configuration catalogue (C)">
              <Icon name="th" /> Gear catalogue
            </button>
            <span className="g3-tool-sep" />
            <button type="button" id="g3-annot" className="g3-btn is-on" title="Show or hide all dimensions, callouts and the scale bar (A)" aria-pressed="true">
              <Icon name="ruler-combined" /> Annotations
            </button>
            <button type="button" id="g3-grid" className="g3-btn is-on" title="Ground reference grid (G)" aria-pressed="true">
              <Icon name="border-all" /> Grid
            </button>
            <span className="g3-tool-sep" />
            <button type="button" id="g3-fit" className="g3-btn" title="Fit in view (F)"><Icon name="expand" /> Fit</button>
            <button type="button" id="g3-undo" className="g3-btn" title="Undo (Ctrl+Z)"><Icon name="undo" /></button>
            <button type="button" id="g3-redo" className="g3-btn" title="Redo (Ctrl+Y)"><Icon name="redo" /></button>
            <span className="g3-tool-sep" />
            <button type="button" id="g3-open" className="g3-btn" title="Open project (.gear3d)"><Icon name="folder-open" /> Open</button>
            <button type="button" id="g3-save" className="g3-btn" title="Save project (.gear3d)"><Icon name="save" /> Save</button>
            <input type="file" id="g3-file-input" accept=".gear3d,.json,application/json" hidden />
            <span className="g3-spacer" />
            <div className="g3-unitsys" role="group" aria-label="Display units">
              <button type="button" className="g3-uswitch is-active" data-units="SI" title="Millimetres, kilonewtons, kilopascals">SI</button>
              <button type="button" className="g3-uswitch" data-units="US" title="Inches, kips, psi">US</button>
            </div>
            <button type="button" id="g3-reset" className="g3-btn g3-btn--danger" title="Revert to the cited reference configuration"><Icon name="rotate-left" /> Revert</button>
            <button type="button" id="g3-export" className="g3-btn g3-btn--primary" title="Export figure"><Icon name="camera" /> Export</button>
          </div>

          {/* Left rail */}
          <aside className="g3-panel g3-left" aria-label="Model and view controls">

            <details open>
              <summary><Icon name="layer-group" /> Unit</summary>
              <div className="g3-group">
                <div className="g3-field">
                  <label htmlFor="g3-domain">Domain</label>
                  <select id="g3-domain" className="g3-select" defaultValue="truck">
                    <option value="truck">Truck</option>
                    <option value="aircraft">Aircraft</option>
                    <option value="generic">Gear configuration</option>
                  </select>
                </div>
                <div className="g3-field">
                  <label htmlFor="g3-category" id="g3-category-label">Class</label>
                  <select id="g3-category" className="g3-select" />
                </div>
                <div className="g3-field">
                  <label htmlFor="g3-unit">Model</label>
                  <select id="g3-unit" className="g3-select" />
                </div>
                <div id="g3-unit-meta" className="g3-meta" />
                <div id="g3-modified-badge" className="g3-badge-modified" hidden>
                  <Icon name="pen" />
                  <span />
                  <button type="button" id="g3-revert-inline" className="g3-linkbtn">Revert to reference</button>
                </div>
                <div id="g3-assumption-notice" className="g3-badge-assumed" hidden />
              </div>
            </details>

            {/* Gear nomenclature. Aircraft only; hidden entirely for trucks,
                which have their own classification. */}
            <details id="g3-gearcode-panel" open hidden>
              <summary><Icon name="font" /> Gear designation</summary>
              <div className="g3-group">
                <div className="g3-gearname" id="g3-gearname">
                  <span className="g3-gearname-code" id="g3-gearname-code">—</span>
                  <span className="g3-gearname-wheels" id="g3-gearname-wheels" />
                </div>
                <p className="g3-gearname-prose" id="g3-gearname-prose" />

                {/* Decomposition: the name, taken apart into the variables
                    section 6 defines. */}
                <div className="g3-gearparts" id="g3-gearparts" />

                <div className="g3-field">
                  <label htmlFor="g3-gearcode-input">Read a name</label>
                  <input
                    type="text" id="g3-gearcode-input" className="g3-text g3-mono"
                    placeholder="2D/2D2(X)" spellCheck={false} autoComplete="off"
                    aria-describedby="g3-gearcode-result"
                  />
                </div>
                <div id="g3-gearcode-result" className="g3-report" role="status" aria-live="polite" />

                <div id="g3-gearcode-aircraft" className="g3-meta" />

                <hr className="g3-rule" />
                <div className="g3-mini-row">
                  <button type="button" id="g3-gearcode-browse" className="g3-btn"><Icon name="th" /> Catalogue</button>
                  <button type="button" id="g3-gearcode-load" className="g3-btn" disabled><Icon name="download" /> Load this</button>
                </div>
                <p className="g3-note">
                  Names follow <strong>FAA Order 5300.7</strong> (6 October 2005):
                  {' '}<span className="g3-mono">#X#/#X#(P)</span> — tandem count, gear type
                  {' '}<span className="g3-mono">S D T Q</span>, gears in line per side, then the
                  body gear and an optional ICAO tire-pressure code. Anything the grammar
                  admits is a legal name, whether or not an aircraft has been built with it.
                </p>
              </div>
            </details>

            <details open>
              <summary><Icon name="crosshairs" /> Isolation</summary>
              <div className="g3-group">
                <div className="g3-field">
                  <label htmlFor="g3-isolation">Show</label>
                  <select id="g3-isolation" className="g3-select" />
                </div>
                <div className="g3-field">
                  <label className="g3-check" htmlFor="g3-ghost">
                    <input type="checkbox" id="g3-ghost" /> Ghost hidden parts
                  </label>
                </div>
                <div id="g3-chassis-notice" className="g3-badge-assumed" hidden />
                <p className="g3-note">Click an axle in the viewport to isolate it. <kbd>Esc</kbd> steps back one level.</p>
              </div>
            </details>

            <details>
              <summary><Icon name="sliders-h" /> Configuration</summary>
              <div className="g3-group" id="g3-config-group">
                <div className="g3-field">
                  <label htmlFor="g3-wbt">Wide-base</label>
                  <select id="g3-wbt" className="g3-select" defaultValue="">
                    <option value="">Swap selected axle to…</option>
                    <option value="445/50R22.5">445/50R22.5</option>
                    <option value="455/55R22.5">455/55R22.5</option>
                    <option value="425/65R22.5">425/65R22.5</option>
                  </select>
                </div>
                <div id="g3-wbt-report" className="g3-report" hidden />
                <p className="g3-note">Select a dual-tire axle in the tree, then swap it. The outer tire edge is held so the vehicle's overall width does not change.</p>
              </div>
            </details>

            <details open>
              <summary><Icon name="ruler-combined" /> Dimensions</summary>
              <div className="g3-group">
                <div className="g3-field"><label className="g3-check"><input type="checkbox" className="g3-dimset" data-set="longitudinal" defaultChecked /> Longitudinal</label></div>
                <div className="g3-field"><label className="g3-check"><input type="checkbox" className="g3-dimset" data-set="transverse" /> Transverse</label></div>
                <div className="g3-field"><label className="g3-check"><input type="checkbox" className="g3-dimset" data-set="vertical" /> Vertical</label></div>
                <div className="g3-field"><label className="g3-check"><input type="checkbox" className="g3-dimset" data-set="aircraft" /> Aircraft gear</label></div>
                <div className="g3-field"><label className="g3-check"><input type="checkbox" className="g3-dimset" data-set="custom" defaultChecked /> Custom</label></div>
                <hr className="g3-rule" />

                <div className="g3-mini-row">
                  <button type="button" id="g3-measure" className="g3-btn" title="Measure between two features (M)">
                    <Icon name="ruler" /> Measure
                  </button>
                  <button type="button" id="g3-clear-custom" className="g3-btn" title="Delete all custom dimensions">
                    <Icon name="trash" /> Clear
                  </button>
                </div>
                <div id="g3-custom-list" className="g3-dimlist" />
                <p className="g3-note" id="g3-measure-hint" hidden>
                  Click two features to measure. Endpoints snap to tire centres and edges,
                  contact patches and axle centrelines. <kbd>Esc</kbd> cancels.
                </p>
                <hr className="g3-rule" />
                <div className="g3-field">
                  <label htmlFor="g3-precision">Decimals</label>
                  <select id="g3-precision" className="g3-select" defaultValue="0">
                    <option value="0">0</option>
                    <option value="1">1</option>
                    <option value="2">2</option>
                  </select>
                </div>
                <div className="g3-field"><label className="g3-check" htmlFor="g3-dual-units"><input type="checkbox" id="g3-dual-units" /> Show both units</label></div>
                <div className="g3-field"><label className="g3-check" htmlFor="g3-callouts"><input type="checkbox" id="g3-callouts" /> Axle callouts</label></div>
                <div className="g3-field"><label className="g3-check" htmlFor="g3-scalebar"><input type="checkbox" id="g3-scalebar" defaultChecked /> Scale bar</label></div>
              </div>
            </details>

            <details>
              <summary><Icon name="shoe-prints" /> Contact patches</summary>
              <div className="g3-group">
                <div className="g3-field">
                  <label className="g3-check" htmlFor="g3-show-patches"><input type="checkbox" id="g3-show-patches" /> Draw footprints</label>
                </div>
                <div className="g3-field">
                  <label htmlFor="g3-patch-model">Model</label>
                  <select id="g3-patch-model" className="g3-select" defaultValue="rectangular">
                    <option value="rectangular">A — rectangular</option>
                    <option value="huang">B — Huang (semicircular ends)</option>
                    <option value="elliptical">C — elliptical</option>
                  </select>
                </div>
                <div className="g3-field">
                  <label htmlFor="g3-inflation">Inflation</label>
                  <input type="number" id="g3-inflation" className="g3-num" min="200" max="2500" step="5" defaultValue="827" />
                  <span className="g3-unit">kPa</span>
                </div>
                <div id="g3-patch-summary" className="g3-report" />

                <hr className="g3-rule" />
                <div className="g3-field">
                  <label htmlFor="g3-ov-scope">Override</label>
                  <select id="g3-ov-scope" className="g3-select" defaultValue="all">
                    <option value="all">All tires</option>
                    <option value="axle">Selected axle</option>
                    <option value="position">Selected wheel position</option>
                  </select>
                </div>
                <div className="g3-field">
                  <label htmlFor="g3-ov-len">Length</label>
                  <input type="number" id="g3-ov-len" className="g3-num" min="1" step="1" />
                  <span className="g3-unit" id="g3-ov-unit-l">mm</span>
                </div>
                <div className="g3-field">
                  <label htmlFor="g3-ov-wid">Width</label>
                  <input type="number" id="g3-ov-wid" className="g3-num" min="1" step="1" />
                  <span className="g3-unit" id="g3-ov-unit-w">mm</span>
                </div>
                <div className="g3-mini-row">
                  <button type="button" id="g3-ov-apply" className="g3-btn"><Icon name="check" /> Apply measured</button>
                  <button type="button" id="g3-ov-clear" className="g3-btn"><Icon name="rotate-left" /> Clear</button>
                </div>
                <div id="g3-ov-status" className="g3-badge-assumed" hidden />
                <p className="g3-note">Use this when you have <em>measured</em> footprint dimensions. An overridden patch keeps its load and reports the contact pressure that implies, so it no longer equals inflation pressure — and every export says which patches were overridden.</p>

                <hr className="g3-rule" />
                <div className="g3-mini-row">
                  <button type="button" id="g3-exp-csv" className="g3-btn"><Icon name="file-csv" /> footprint.csv</button>
                  <button type="button" id="g3-exp-fem" className="g3-btn"><Icon name="cubes" /> FEM export</button>
                </div>
                <p className="g3-note">Contact pressure is taken equal to inflation pressure and uniform over the patch. Both are idealisations — the export header states them in full.</p>
              </div>
            </details>

            <details>
              <summary><Icon name="video" /> Camera</summary>
              <div className="g3-group">
                <div className="g3-field">
                  <label htmlFor="g3-proj">Projection</label>
                  <select id="g3-proj" className="g3-select" defaultValue="ortho">
                    <option value="ortho">Orthographic</option>
                    <option value="persp">Perspective</option>
                  </select>
                </div>
                <div className="g3-field g3-field--num">
                  <label htmlFor="g3-cam-az">Azimuth</label>
                  <input type="range" id="g3-cam-az" className="g3-range" min="-180" max="180" step="1" defaultValue="-30" />
                  <input type="number" id="g3-cam-az-n" className="g3-num g3-num--tiny" min="-180" max="180" step="1" defaultValue="-30" />
                </div>
                <div className="g3-field g3-field--num">
                  <label htmlFor="g3-cam-el">Elevation</label>
                  <input type="range" id="g3-cam-el" className="g3-range" min="-89" max="89" step="0.5" defaultValue="20" />
                  <input type="number" id="g3-cam-el-n" className="g3-num g3-num--tiny" min="-89" max="89" step="0.5" defaultValue="20" />
                </div>
                <div className="g3-mini-row" id="g3-presets" />
              </div>
            </details>

            <details>
              <summary><Icon name="desktop" /> Rendering</summary>
              <div className="g3-group">
                <div className="g3-field">
                  <label htmlFor="g3-render-tier">Quality</label>
                  <select id="g3-render-tier" className="g3-select" />
                </div>
                <div className="g3-resbar" id="g3-resbar">
                  <span className="g3-resbar-k">Drawing buffer</span>
                  <span className="g3-resbar-v g3-mono" id="g3-res-value">—</span>
                  <span className="g3-resbar-n" id="g3-res-note" />
                </div>
                <div className="g3-field">
                  <label htmlFor="g3-geometry">Tyre detail</label>
                  <select id="g3-geometry" className="g3-select" defaultValue="auto">
                    <option value="auto">Auto — by tyre count</option>
                    <option value="draft">Draft — 112 segments</option>
                    <option value="standard">Standard — 240</option>
                    <option value="high">High — 352</option>
                  </select>
                </div>
                <p className="g3-note">
                  The viewport renders into a buffer larger than itself and the browser
                  downsamples it, which is the same supersampling the figure export has
                  always used. <strong>Orbiting drops to a lighter ratio and the full
                  frame is drawn once the view settles</strong>, so the cost lands on the
                  still image rather than on the drag.
                </p>
              </div>
            </details>

            <details>
              <summary><Icon name="lightbulb" /> Lighting</summary>
              <div className="g3-group">
                <div className="g3-field">
                  <label htmlFor="g3-light-preset">Preset</label>
                  <select id="g3-light-preset" className="g3-select" defaultValue="studio">
                    <option value="studio">Studio</option>
                    <option value="daylight">Daylight</option>
                    <option value="softbox">Softbox</option>
                    <option value="threepoint">Three-point</option>
                  </select>
                </div>
                <div className="g3-field g3-field--num">
                  <label htmlFor="g3-light-key">Key</label>
                  <input type="range" id="g3-light-key" className="g3-range" min="0" max="6" step="0.1" />
                  <input type="number" id="g3-light-key-n" className="g3-num g3-num--tiny" min="0" max="6" step="0.1" />
                </div>
                <div className="g3-field g3-field--num">
                  <label htmlFor="g3-light-amb">Ambient</label>
                  <input type="range" id="g3-light-amb" className="g3-range" min="0" max="3" step="0.05" />
                  <input type="number" id="g3-light-amb-n" className="g3-num g3-num--tiny" min="0" max="3" step="0.05" />
                </div>
                <div className="g3-field g3-field--num">
                  <label htmlFor="g3-light-az">Light az.</label>
                  <input type="range" id="g3-light-az" className="g3-range" min="-180" max="180" step="1" />
                  <input type="number" id="g3-light-az-n" className="g3-num g3-num--tiny" min="-180" max="180" step="1" />
                </div>
                <div className="g3-field g3-field--num">
                  <label htmlFor="g3-light-el">Light el.</label>
                  <input type="range" id="g3-light-el" className="g3-range" min="5" max="88" step="1" />
                  <input type="number" id="g3-light-el-n" className="g3-num g3-num--tiny" min="5" max="88" step="1" />
                </div>
                <div className="g3-field g3-field--num">
                  <label htmlFor="g3-shadow-op">Shadow</label>
                  <input type="range" id="g3-shadow-op" className="g3-range" min="0" max="1" step="0.02" />
                  <input type="number" id="g3-shadow-op-n" className="g3-num g3-num--tiny" min="0" max="1" step="0.02" />
                </div>
                <div className="g3-field g3-field--num">
                  <label htmlFor="g3-shadow-soft">Softness</label>
                  <input type="range" id="g3-shadow-soft" className="g3-range" min="0" max="12" step="0.5" />
                  <input type="number" id="g3-shadow-soft-n" className="g3-num g3-num--tiny" min="0" max="12" step="0.5" />
                </div>
              </div>
            </details>

            <details>
              <summary><Icon name="swatchbook" /> Materials</summary>
              <div className="g3-group">
                <div className="g3-field">
                  <label htmlFor="g3-mat-target">Surface</label>
                  <select id="g3-mat-target" className="g3-select" />
                </div>
                <div className="g3-field">
                  <label htmlFor="g3-mat-tint">Tint</label>
                  <input type="color" id="g3-mat-tint" className="g3-color" defaultValue="#ffffff" />
                  <button type="button" className="g3-icon-btn" id="g3-mat-tint-clear" title="Clear tint"><Icon name="eraser" /></button>
                </div>
                <div className="g3-field g3-field--num">
                  <label htmlFor="g3-mat-bright">Brightness</label>
                  <input type="range" id="g3-mat-bright" className="g3-range" min="0.5" max="1.5" step="0.01" defaultValue="1" />
                  <input type="number" id="g3-mat-bright-n" className="g3-num g3-num--tiny" min="0.5" max="1.5" step="0.01" defaultValue="1" />
                </div>
                <div className="g3-field g3-field--num">
                  <label htmlFor="g3-mat-rough">Roughness</label>
                  <input type="range" id="g3-mat-rough" className="g3-range" min="0.05" max="1" step="0.01" />
                  <input type="number" id="g3-mat-rough-n" className="g3-num g3-num--tiny" min="0.05" max="1" step="0.01" />
                </div>
                <div className="g3-field g3-field--num">
                  <label htmlFor="g3-mat-relief">Relief</label>
                  <input type="range" id="g3-mat-relief" className="g3-range" min="0" max="2.5" step="0.05" />
                  <input type="number" id="g3-mat-relief-n" className="g3-num g3-num--tiny" min="0" max="2.5" step="0.05" />
                </div>
                <div id="g3-mat-desc" className="g3-meta" />
                <div className="g3-mini-row">
                  <button type="button" id="g3-mat-reset" className="g3-btn"><Icon name="rotate-left" /> Reset surface</button>
                  <button type="button" id="g3-mat-reset-all" className="g3-btn"><Icon name="broom" /> Reset all</button>
                </div>
                <p className="g3-note">Appearance only — materials never affect a dimension, a contact patch or an export. Settings are saved in the project file.</p>
              </div>
            </details>

            <details>
              <summary><Icon name="fill-drip" /> Background</summary>
              <div className="g3-group">
                <div className="g3-field">
                  <label htmlFor="g3-bg-mode">Mode</label>
                  <select id="g3-bg-mode" className="g3-select" defaultValue="white">
                    <option value="white">Publication white</option>
                    <option value="color">Custom colour</option>
                    <option value="transparent">Transparent</option>
                  </select>
                </div>
                <div className="g3-field" id="g3-bg-color-field">
                  <label htmlFor="g3-bg-color">Colour</label>
                  <input type="color" id="g3-bg-color" className="g3-color" defaultValue="#eef1f4" />
                </div>
              </div>
            </details>

            <details>
              <summary><Icon name="file-export" /> Export</summary>
              <div className="g3-group">
                <div className="g3-field">
                  <label htmlFor="g3-exp-format">Format</label>
                  <select id="g3-exp-format" className="g3-select" defaultValue="png">
                    <option value="png">PNG</option>
                    <option value="png-alpha">PNG (transparent)</option>
                    <option value="jpeg">JPEG</option>
                    <option value="svg">SVG (vector annotations)</option>
                    <option value="pdf">PDF (vector annotations)</option>
                  </select>
                </div>
                <div className="g3-field">
                  <label htmlFor="g3-exp-size">Resolution</label>
                  <select id="g3-exp-size" className="g3-select" />
                </div>
                <div className="g3-field" id="g3-exp-custom" hidden>
                  <label>W × H</label>
                  <input type="number" id="g3-exp-w" className="g3-num g3-num--tiny" min="256" max="16384" defaultValue="2400" />
                  <input type="number" id="g3-exp-h" className="g3-num g3-num--tiny" min="256" max="16384" defaultValue="1800" />
                </div>
                <div className="g3-mini-row">
                  <button type="button" id="g3-exp-unit" className="g3-btn"><Icon name="file-code" /> unit.json</button>
                  <button type="button" id="g3-exp-matrix" className="g3-btn"><Icon name="th-large" /> Gear matrix</button>
                </div>
                <div className="g3-mini-row">
                  <button type="button" id="g3-exp-glb" className="g3-btn" title="Binary glTF geometry, engineering frame, millimetres"><Icon name="cube" /> Geometry .glb</button>
                  <button type="button" id="g3-exp-obj" className="g3-btn" title="Wavefront OBJ geometry, engineering frame, millimetres"><Icon name="cube" /> .obj</button>
                </div>
                <p className="g3-note">Geometry exports carry the visible model in the <strong>engineering frame, in millimetres</strong> — the same coordinate system and scale as footprint.csv, so the two line up. Isolation applies.</p>
                <p className="g3-note">Exports re-render at full resolution. Above the GPU's limit the render is tiled and composited. SVG and PDF keep dimensions and labels vector.</p>
              </div>
            </details>

            <details>
              <summary><Icon name="file-signature" /> Project info</summary>
              <div className="g3-group">
                <div className="g3-field">
                  <label htmlFor="g3-meta-title" className="g3-label--wide">Title</label>
                  <input type="text" id="g3-meta-title" className="g3-text" placeholder="FHWA class 9 drive tandem" />
                </div>
                <div className="g3-field">
                  <label htmlFor="g3-meta-author" className="g3-label--wide">Author</label>
                  <input type="text" id="g3-meta-author" className="g3-text" placeholder="Author" />
                </div>
                <div className="g3-field">
                  <label htmlFor="g3-seed" className="g3-label--wide">Seed</label>
                  <input type="text" id="g3-seed" className="g3-text" defaultValue="gear3d-01" />
                </div>
                <textarea id="g3-meta-notes" className="g3-textarea" placeholder="Notes stored in the project file…" />
                <p className="g3-note">The seed fixes every procedural detail. The same seed and settings always render the identical figure.</p>
              </div>
            </details>
          </aside>

          {/* Viewport */}
          <div className="g3-viewport" id="g3-viewport">
            <canvas id="g3-canvas" aria-label="3D gear viewport" />
            <svg id="g3-overlay" className="g3-overlay" aria-hidden="true" />
            <div className="g3-axisbadge" id="g3-axisbadge" />
            <div className="g3-hud" id="g3-hud">—</div>
            <div className="g3-hud-right" id="g3-hud-right">orbit: drag · zoom: wheel · pan: right-drag · click an axle to isolate</div>
            <div className="g3-progress" id="g3-progress" hidden>
              <div className="g3-progress-bar"><span /></div>
              <span className="g3-progress-label" />
            </div>
          </div>

          {/* Right rail */}
          <aside className="g3-panel g3-right" aria-label="Structure and properties">
            <div className="g3-tree-head">
              <h3><Icon name="sitemap" /> Structure</h3>
              <span className="g3-tree-total" id="g3-tree-total" />
            </div>
            <div className="g3-tree" id="g3-tree" role="tree" aria-label="Unit structure" />
            <div className="g3-props" id="g3-props">
              <p className="g3-note">Select an axle to edit its geometry. Every value is a real engineering dimension; editing one marks the unit as modified.</p>
            </div>
          </aside>

          {/* Status strip */}
          <div className="g3-status" id="g3-status">
            <span className="g3-status-item" id="g3-status-iso">—</span>
            <span className="g3-status-sep" />
            <span className="g3-status-item" id="g3-status-sel">No selection</span>
            <span className="g3-spacer" />
            <span className="g3-status-item g3-mono" id="g3-status-coords" />
            <span className="g3-status-sep" />
            <span className="g3-status-item g3-mono" id="g3-status-view">—</span>
            <span className="g3-status-sep" />
            <span className="g3-status-item g3-mono" id="g3-status-res" title="Drawing buffer — the resolution the viewport is rasterised at" />
          </div>

        </div>

        {/* Gear configuration catalogue.
            Figure 2 and Table 3 of FAA Order 5300.7, as a browsable sheet. The
            thumbnails are drawn from the same wheel-plan function the app uses
            elsewhere, so a diagram here cannot disagree with the model it loads. */}
        <div className="g3-modal" id="g3-catalogue-modal" hidden>
          <div className="g3-modal-scrim" data-close />
          <div className="g3-modal-panel" role="dialog" aria-modal="true" aria-labelledby="g3-cat-title">
            <header className="g3-modal-head">
              <div>
                <h2 id="g3-cat-title">Gear configuration catalogue</h2>
                <p>
                  FAA Order 5300.7 — <span id="g3-cat-count">—</span> entries.
                  {' '}<span className="g3-cat-legend">
                    <span className="g3-cat-dot g3-cat-dot--real" /> measured aircraft
                    <span className="g3-cat-dot g3-cat-dot--schem" /> schematic
                  </span>
                </p>
              </div>
              <div className="g3-modal-tools">
                <input
                  type="search" id="g3-cat-search" className="g3-text"
                  placeholder="Filter by code or aircraft…"
                  spellCheck={false} autoComplete="off" aria-label="Filter configurations"
                />
                <button type="button" className="g3-icon-btn" data-close aria-label="Close catalogue"><Icon name="times" /></button>
              </div>
            </header>
            <div className="g3-cat-body">
              <section className="g3-cat-section">
                <h3>Figure 2 — generic configurations</h3>
                <p className="g3-cat-blurb">
                  Every gear type in one, two and three tandem axle lines.
                  The figure's own caption says the grid does not stop there: <em>increase numeric
                  value for additional tandem axles</em>.
                </p>
                <div className="g3-cat-grid" id="g3-cat-generic" />
              </section>
              <section className="g3-cat-section">
                <h3>Table 3 — known configurations</h3>
                <p className="g3-cat-blurb">
                  The configurations the Order tabulates against real aircraft,
                  with the historic FAA, U.S. Air Force and U.S. Navy names each one replaced.
                </p>
                <div className="g3-cat-grid" id="g3-cat-known" />
              </section>
            </div>
          </div>
        </div>

        <div className="g3-toast-wrap" id="g3-toast-wrap" role="status" aria-live="polite" />
      </div>

      <p className="cee-note">
        Dimensions are the cited reference values for each vehicle, resolved through one
        <code>resolveLayout()</code> that the renderer, the dimension engine and the footprint
        export all read — so a spacing you measure on screen is the spacing that lands in the CSV.
        Every axle carries its source and every load its basis; see <code>SOURCES.md</code> in the
        data library. Contact patches are idealisations, not measurements, unless you enter
        measured dimensions yourself. Truck classes follow FHWA; gear designations follow FAA
        Order 5300.7 (6 October 2005). Ported from the Gear3D E-Lab.
      </p>
    </div>
  );
}
