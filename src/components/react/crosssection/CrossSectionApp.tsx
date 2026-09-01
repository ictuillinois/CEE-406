// Cross-Section Studio — the island shell.
//
// This component owns the markup and nothing else: every control below is
// driven imperatively by `initStudio`, which is a Three.js app and not a React
// one. Keeping the two apart is deliberate — the engine stays portable and
// testable, and React is not asked to re-render a WebGL scene sixty times a
// second.
//
// Control help is carried on `title` rather than the site's <Tip> component.
// Tip renders an absolutely positioned popover, and both side rails are
// `overflow: auto` scroll containers 268px and 292px wide: a 15rem popover
// anchored inside one is clipped on two edges. Native titles are not clipped,
// and the how-to panel above the studio carries the longer explanations.
import { useEffect, useRef, useState } from 'react';
import { XS_PATHS, type XsIconName } from './icons';
import { initStudio } from './studio';
import '../tools.css';
import './crosssection.css';

function Icon({ name }: { name: XsIconName }) {
  return (
    <svg
      className="xs-i"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: XS_PATHS[name] }}
    />
  );
}

export default function CrossSectionApp() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let dispose: (() => void) | undefined;
    try {
      dispose = initStudio(root);
    } catch (err) {
      // The one failure worth naming: no WebGL context. Everything else in
      // the boot path is DOM work that cannot fail on a browser that got here.
      setFailure(
        err instanceof Error && /webgl/i.test(err.message)
          ? 'This browser could not open a WebGL context, so the 3-D viewport cannot start. Hardware acceleration is usually the cause — check it is enabled in your browser settings.'
          : 'The studio failed to start in this browser.'
      );
    }
    return () => { if (dispose) dispose(); };
  }, []);

  return (
    <div className="cee-tool xs-tool">

      <details className="cee-howto">
        <summary>How to use this tool</summary>
        <div className="cee-howto__body">
          <ol>
            <li><strong>Start from a template.</strong> Thirteen sections ship with the tool — FAA flexible and rigid, conventional and deep-strength highway, JPCP, CRCP, composite, permeable, FDR. Pick the nearest one and edit it rather than building from scratch.</li>
            <li><strong>Set the layer structure.</strong> Every thickness in the bottom strip is the real engineering thickness in millimeters, drawn to scale. The subgrade is the exception: it is infinite in the analysis, so it carries a display thickness set under Section Geometry and is marked with an asterisk.</li>
            <li><strong>Pick materials.</strong> Click a layer to select it, then a tile in the Material Library. The eighteen textures are procedural and seeded, so the same settings always produce the same figure — a section rendered today matches the one in a report from last term.</li>
            <li><strong>Frame it.</strong> Drag to orbit, wheel to zoom, right-drag to pan, or use the Isometric / Front / Fit buttons. Orthographic projection is the honest one for a dimensioned figure; perspective reads better in a presentation.</li>
            <li><strong>Take the image.</strong> <strong>Copy</strong> puts the PNG straight on your clipboard — paste it into Word, PowerPoint, LaTeX-adjacent editors, or a lab notebook without ever touching a file. <strong>Copy transparent</strong> does the same with no background, so the section sits on whatever the slide is already using. <strong>Export</strong> downloads the file instead.</li>
          </ol>
          <p>
            Copy and Export both render at the resolution chosen under Export, not at the size of the
            viewport on screen — 2400&nbsp;×&nbsp;1800 is 300&nbsp;dpi at 8&nbsp;×&nbsp;6&nbsp;in and is
            the right default for a report figure. The selection outline never appears in the output.
            <strong> Ctrl</strong>+<strong>Alt</strong>+<strong>C</strong> copies without leaving the
            keyboard.
          </p>
          <p>
            A transparent PNG keeps its alpha channel through the clipboard on Windows and macOS.
            A few consumers flatten it — some chat clients, and older builds of Office — and there
            the section will land on a white or black card instead. If that happens, use
            <strong> Copy</strong> with <em>Publication white</em> selected under Background and you
            get the same figure on a known ground.
          </p>
          <p>
            Save and Open store the whole section — geometry, layers, materials, camera, lighting —
            as a <code>.pavement.json</code> file, so a figure can be reopened and re-rendered at a
            different size or angle later instead of being redrawn.
          </p>
        </div>
      </details>

      {failure && (
        <p className="cee-warn">
          <span className="cee-warn__icon">⚠️</span>
          <span>{failure}</span>
        </p>
      )}

      <div className="xs-app" ref={rootRef}>
        <div className="xs-studio">

          {/* ── Toolbar ─────────────────────────────────────────────── */}
          <div className="xs-toolbar">
            <select id="xs-template" className="xs-select" title="Section templates" aria-label="Section templates" defaultValue="">
              <option value="" disabled>Templates…</option>
            </select>
            <span className="xs-tool-sep" />
            <button type="button" id="xs-undo" className="xs-btn xs-btn--icon" title="Undo (Ctrl+Z)" aria-label="Undo"><Icon name="undo" /></button>
            <button type="button" id="xs-redo" className="xs-btn xs-btn--icon" title="Redo (Ctrl+Y)" aria-label="Redo"><Icon name="redo" /></button>
            <span className="xs-tool-sep" />
            <button type="button" id="xs-open" className="xs-btn" title="Open project (.pavement.json)"><Icon name="folder" /> Open</button>
            <button type="button" id="xs-save" className="xs-btn" title="Save project (.pavement.json)"><Icon name="save" /> Save</button>
            <input type="file" id="xs-file-input" accept=".json,application/json" hidden />
            <span className="xs-spacer" />
            <button type="button" id="xs-reset" className="xs-btn xs-btn--danger" title="Reset to default section"><Icon name="reset" /> Reset</button>
            <button type="button" id="xs-copy" className="xs-btn xs-btn--primary" title="Copy the figure to the clipboard as a PNG (Ctrl+Alt+C). Choose PNG (transparent) under Export to copy without a background."><Icon name="copy" /> Copy</button>
            <button type="button" id="xs-export" className="xs-btn" title="Download the figure as an image file"><Icon name="camera" /> Export</button>
          </div>

          {/* ── Left rail: project controls ─────────────────────────── */}
          <aside className="xs-panel xs-left">
            <details open>
              <summary><Icon name="geometry" /> Section Geometry</summary>
              <div className="xs-group">
                <div className="xs-field">
                  <label htmlFor="xs-sec-width" title="Out-of-plane dimension of the block, across the section.">Width</label>
                  <input type="number" id="xs-sec-width" className="xs-num" min="500" max="20000" step="50" />
                  <span className="xs-unit">mm</span>
                </div>
                <div className="xs-field">
                  <label htmlFor="xs-sec-length" title="In-plane dimension of the block, along the direction of travel.">Length</label>
                  <input type="number" id="xs-sec-length" className="xs-num" min="500" max="20000" step="50" />
                  <span className="xs-unit">mm</span>
                </div>
                <div className="xs-field">
                  <label htmlFor="xs-sec-recess-x" title="How far each layer is stepped back from the one below it along the length — the staircase that lets every layer be seen at once. Zero gives a flush block.">Step (length)</label>
                  <input type="number" id="xs-sec-recess-x" className="xs-num" min="0" max="2000" step="25" />
                  <span className="xs-unit">mm</span>
                </div>
                <div className="xs-field">
                  <label htmlFor="xs-sec-recess-z" title="The same step, taken across the width instead. Use one or the other, rarely both.">Step (width)</label>
                  <input type="number" id="xs-sec-recess-z" className="xs-num" min="0" max="2000" step="25" />
                  <span className="xs-unit">mm</span>
                </div>
                <div className="xs-field">
                  <label htmlFor="xs-sec-subgrade" title="Drawn depth of the subgrade. The subgrade is a half-space in analysis; this figure is a visualization choice and is excluded from the Σ above subgrade.">Subgrade display</label>
                  <input type="number" id="xs-sec-subgrade" className="xs-num" min="50" max="2000" step="25" />
                  <span className="xs-unit">mm</span>
                </div>
                <p className="xs-field-note">Layer heights are exact engineering thicknesses. The infinite subgrade uses a fixed visualization thickness only.</p>
              </div>
            </details>

            <details open>
              <summary><Icon name="video" /> Camera</summary>
              <div className="xs-group">
                <div className="xs-field">
                  <label htmlFor="xs-cam-proj" title="Orthographic keeps parallel edges parallel and thicknesses comparable anywhere in the frame — the right choice for a dimensioned figure. Perspective reads better on a slide.">Projection</label>
                  <select id="xs-cam-proj" className="xs-select" defaultValue="persp">
                    <option value="ortho">Orthographic</option>
                    <option value="persp">Perspective</option>
                  </select>
                </div>
                <div className="xs-field">
                  <label htmlFor="xs-cam-az" title="Rotation of the camera about the vertical axis.">Azimuth</label>
                  <input type="range" id="xs-cam-az" className="xs-range" min="-180" max="180" step="1" />
                </div>
                <div className="xs-field">
                  <label htmlFor="xs-cam-el" title="Height of the camera above the horizon. 35.264° with 45° azimuth is the true engineering isometric.">Elevation</label>
                  <input type="range" id="xs-cam-el" className="xs-range" min="2" max="88" step="0.5" />
                </div>
                <div className="xs-field">
                  <label htmlFor="xs-cam-fov" title="Perspective only. A narrow field of view flattens the block and keeps thicknesses honest; a wide one exaggerates depth.">Field of view</label>
                  <input type="range" id="xs-cam-fov" className="xs-range" min="15" max="70" step="1" />
                </div>
                <div className="xs-mini-btn-row">
                  <button type="button" id="xs-cam-iso" className="xs-btn" title="Engineering isometric view"><Icon name="cube" /> Isometric</button>
                  <button type="button" id="xs-cam-front" className="xs-btn" title="Front section view"><Icon name="square" /> Front</button>
                  <button type="button" id="xs-cam-fit" className="xs-btn" title="Fit section in view"><Icon name="expand" /> Fit</button>
                </div>
              </div>
            </details>

            <details>
              <summary><Icon name="bulb" /> Lighting</summary>
              <div className="xs-group">
                <div className="xs-field">
                  <label htmlFor="xs-light-preset" title="Four rigs. Studio is the neutral default; Daylight is harder and more contrasty; Softbox flattens the shadows for a clean figure; Three-point adds a rim light that separates the block from the background.">Preset</label>
                  <select id="xs-light-preset" className="xs-select" defaultValue="studio">
                    <option value="studio">Studio</option>
                    <option value="daylight">Daylight</option>
                    <option value="softbox">Softbox</option>
                    <option value="threepoint">Three-point</option>
                  </select>
                </div>
                <div className="xs-field">
                  <label htmlFor="xs-light-key" title="Strength of the main directional light. This is what carves the aggregate relief.">Key intensity</label>
                  <input type="range" id="xs-light-key" className="xs-range" min="0" max="5" step="0.1" />
                </div>
                <div className="xs-field">
                  <label htmlFor="xs-light-amb" title="Sky and bounce light. Raising it opens the shadows; too much and the texture goes flat.">Ambient</label>
                  <input type="range" id="xs-light-amb" className="xs-range" min="0" max="3" step="0.1" />
                </div>
                <div className="xs-field">
                  <label htmlFor="xs-light-az" title="Direction the key light comes from, about the vertical axis.">Light azimuth</label>
                  <input type="range" id="xs-light-az" className="xs-range" min="-180" max="180" step="1" />
                </div>
                <div className="xs-field">
                  <label htmlFor="xs-light-el" title="Height of the key light. Low light rakes across the surface and exaggerates texture; high light is flatter and cleaner.">Light elevation</label>
                  <input type="range" id="xs-light-el" className="xs-range" min="10" max="85" step="1" />
                </div>
                <div className="xs-field">
                  <label htmlFor="xs-shadow-op" title="Darkness of the shadow cast onto the ground plane. Set to zero for a figure that has to sit on a colored slide.">Shadow opacity</label>
                  <input type="range" id="xs-shadow-op" className="xs-range" min="0" max="1" step="0.05" />
                </div>
                <div className="xs-field">
                  <label htmlFor="xs-shadow-soft" title="How far the shadow edge is blurred.">Shadow softness</label>
                  <input type="range" id="xs-shadow-soft" className="xs-range" min="0" max="12" step="0.5" />
                </div>
                <div className="xs-field">
                  <label className="xs-check" htmlFor="xs-ground-shadow" title="Turn the shadow-catching ground plane on or off. Off is usually what you want for a transparent copy.">
                    <input type="checkbox" id="xs-ground-shadow" /> Ground shadow
                  </label>
                </div>
              </div>
            </details>

            <details>
              <summary><Icon name="droplet" /> Background</summary>
              <div className="xs-group">
                <div className="xs-field">
                  <label htmlFor="xs-bg-mode" title="Publication white is the safe default for a printed report. Transparent leaves the ground empty, which is what Copy transparent and PNG (transparent) carry through.">Mode</label>
                  <select id="xs-bg-mode" className="xs-select" defaultValue="white">
                    <option value="white">Publication white</option>
                    <option value="color">Custom color</option>
                    <option value="transparent">Transparent</option>
                  </select>
                </div>
                <div className="xs-field" id="xs-bg-color-field">
                  <label htmlFor="xs-bg-color" title="Background color when Mode is Custom color.">Color</label>
                  <input type="color" id="xs-bg-color" className="xs-color" defaultValue="#f1f5f9" />
                </div>
              </div>
            </details>

            <details>
              <summary><Icon name="fileExport" /> Export &amp; Copy</summary>
              <div className="xs-group">
                <div className="xs-field">
                  <label htmlFor="xs-exp-format" title="Format used by the Export button and by the Copy button in the toolbar. Clipboard images are always PNG.">Format</label>
                  <select id="xs-exp-format" className="xs-select" defaultValue="png">
                    <option value="png">PNG</option>
                    <option value="png-alpha">PNG (transparent)</option>
                    <option value="jpeg">JPEG</option>
                  </select>
                </div>
                <div className="xs-field">
                  <label htmlFor="xs-exp-size" title="Output resolution. This is what both Export and Copy render at — the viewport size on screen has no effect on it.">Resolution</label>
                  <select id="xs-exp-size" className="xs-select" defaultValue="2400x1800">
                    <option value="1600x1200">1600 × 1200</option>
                    <option value="2400x1800">2400 × 1800 (300 dpi @ 8×6 in)</option>
                    <option value="3600x2700">3600 × 2700 (600 dpi @ 6×4.5 in)</option>
                    <option value="1920x1080">1920 × 1080</option>
                    <option value="3840x2160">3840 × 2160</option>
                    <option value="custom">Custom…</option>
                  </select>
                </div>
                <div className="xs-field" id="xs-exp-custom" hidden>
                  <label htmlFor="xs-exp-w" title="Custom output size in pixels, width then height. Clamped to 256–8192 on each side.">W × H</label>
                  <input type="number" id="xs-exp-w" className="xs-num" min="256" max="8192" defaultValue={2400} aria-label="Custom export width" style={{ width: '64px' }} />
                  <input type="number" id="xs-exp-h" className="xs-num" min="256" max="8192" defaultValue={1800} aria-label="Custom export height" style={{ width: '64px' }} />
                </div>

                {/* Copy-to-clipboard: the two cases spelled out, next to the
                    resolution they will be rendered at. */}
                <p className="xs-subhead">To the clipboard</p>
                <div className="xs-mini-btn-row">
                  <button type="button" id="xs-copy-bg" className="xs-btn" title="Copy a PNG at the resolution above, over the current background (Ctrl+Alt+C)">
                    <Icon name="copy" /> Copy PNG
                  </button>
                  <button type="button" id="xs-copy-alpha" className="xs-btn" title="Copy a PNG with a transparent background, whatever the Background panel says">
                    <Icon name="copy-alpha" /> Copy transparent
                  </button>
                </div>
                <p className="xs-field-note">
                  Paste straight into a report or a slide — no file, no download folder. Alpha survives
                  the clipboard in Word, PowerPoint and Google Slides; a few apps flatten it to white.
                </p>

                <p className="xs-subhead">To a file</p>
                <p className="xs-field-note">
                  <strong>Export</strong> in the toolbar downloads the figure instead, in the format
                  above. Exports re-render the current view at full resolution; transparent PNG
                  ignores the background.
                </p>
              </div>
            </details>

            <details>
              <summary><Icon name="fileText" /> Project Info</summary>
              <div className="xs-group">
                <div className="xs-field">
                  <label htmlFor="xs-meta-name" style={{ flex: '0 0 46px' }} title="Names the exported image and the saved project file.">Title</label>
                  <input type="text" id="xs-meta-name" className="xs-text" placeholder="FAA Flexible Section A" />
                </div>
                <div className="xs-field">
                  <label htmlFor="xs-meta-author" style={{ flex: '0 0 46px' }} title="Stored in the project file. It is not drawn on the figure.">Author</label>
                  <input type="text" id="xs-meta-author" className="xs-text" placeholder="Author" />
                </div>
                <textarea id="xs-meta-notes" className="xs-textarea" aria-label="Project notes" placeholder="Notes stored in the project file…" />
              </div>
            </details>
          </aside>

          {/* ── Viewport ────────────────────────────────────────────── */}
          <div className="xs-viewport" id="xs-viewport">
            <canvas id="xs-canvas" aria-label="3D pavement cross-section viewport" />

            {/* Copy sits on the image itself: the figure is what is being
                taken, so the control belongs where the figure is. */}
            <div className="xs-vp-tools">
              <button type="button" id="xs-vp-copy" className="xs-vp-btn" title="Copy the figure to the clipboard as a PNG (Ctrl+Alt+C)">
                <Icon name="copy" /><span>Copy</span>
              </button>
              <button type="button" id="xs-vp-copy-alpha" className="xs-vp-btn xs-vp-btn--icon" title="Copy as a PNG with a transparent background" aria-label="Copy as a PNG with a transparent background">
                <Icon name="copy-alpha" />
              </button>
            </div>

            <div className="xs-hud" id="xs-hud">—</div>
            <div className="xs-hud-right" id="xs-hud-right">orbit: drag · zoom: wheel · pan: right-drag · select: click layer</div>
          </div>

          {/* ── Right rail: material editor ─────────────────────────── */}
          <aside className="xs-panel xs-right">
            <span className="xs-selected-layer-tag" id="xs-sel-tag">No layer selected</span>
            <details open>
              <summary><Icon name="swatch" /> Material Library</summary>
              <div className="xs-group">
                <div className="xs-mat-grid" id="xs-mat-grid" />
              </div>
            </details>
            <details open>
              <summary><Icon name="sliders" /> Material Properties</summary>
              <div className="xs-group">
                <div className="xs-field">
                  <label htmlFor="xs-mat-tint" title="Multiplies the texture color. Use it sparingly — a tinted P-401 stops looking like P-401.">Tint</label>
                  <input type="color" id="xs-mat-tint" className="xs-color" defaultValue="#ffffff" />
                  <button type="button" className="xs-icon-btn" id="xs-mat-tint-reset" title="Reset tint" aria-label="Reset tint"><Icon name="eraser" /></button>
                </div>
                <div className="xs-field">
                  <label htmlFor="xs-mat-bright" title="Scales the whole layer lighter or darker without changing its hue. The usual fix when one course disappears into the one below it.">Brightness</label>
                  <input type="range" id="xs-mat-bright" className="xs-range" min="0.5" max="1.5" step="0.01" />
                </div>
                <div className="xs-field">
                  <label htmlFor="xs-mat-rough" title="Surface roughness. Low values are wet or polished; high values are matte and dusty. Each material starts at its own preset value.">Roughness</label>
                  <input type="range" id="xs-mat-rough" className="xs-range" min="0.05" max="1" step="0.01" />
                </div>
                <div className="xs-field">
                  <label htmlFor="xs-mat-scale" title="Size of the texture tile relative to true scale. 1.0 is true scale — the aggregate is the size the mix design says it is. Change it only for effect.">Texture scale</label>
                  <input type="range" id="xs-mat-scale" className="xs-range" min="0.25" max="4" step="0.05" />
                </div>
                <div className="xs-field">
                  <label htmlFor="xs-mat-normal" title="Depth of the surface relief. Raising it makes individual stones stand out; at zero the face is smooth.">Relief strength</label>
                  <input type="range" id="xs-mat-normal" className="xs-range" min="0" max="2.5" step="0.05" />
                </div>
                <div className="xs-mini-btn-row">
                  <button type="button" id="xs-mat-reset" className="xs-btn"><Icon name="reset" /> Reset material</button>
                </div>
                <p className="xs-field-note">Textures are procedural and seeded — the same settings always reproduce the exact same figure.</p>
              </div>
            </details>
          </aside>

          {/* ── Layer manager ───────────────────────────────────────── */}
          <div className="xs-layers">
            <div className="xs-layers-head">
              <h3><Icon name="layers" /> Layer Structure</h3>
              <span className="xs-layers-total" id="xs-layers-total" />
              <span className="xs-spacer" />
              <button type="button" id="xs-add-layer" className="xs-btn"><Icon name="plus" /> Add layer</button>
            </div>
            <div className="xs-layer-rows" id="xs-layer-rows" />
          </div>

        </div>

        <div className="xs-toast-wrap" id="xs-toast-wrap" aria-live="polite" />
      </div>

      <p className="cee-note">
        Thicknesses are drawn true to scale; the subgrade is a half-space and its drawn depth is a
        visualization choice, not a design value. Materials are procedural textures keyed to FAA
        item numbers (P-401, P-209, P-154, P-501, P-304, P-306) and to the common highway courses —
        they are a legible stand-in for the material, not a photograph of a particular mix. Ported
        from the Cross-Section Studio E-Lab.
      </p>
    </div>
  );
}
