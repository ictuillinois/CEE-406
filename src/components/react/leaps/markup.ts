/* ────────────────────────────────────────────────────────────────────────
   GENERATED FILE — DO NOT EDIT.

   Lifted from e-labs/leaps/index.html by scripts/port-leaps/port-markup.mjs,
   between the LEAPS:APP markers, with Font Awesome swapped for this site's
   own strokes. The standalone page and this island therefore mount exactly
   the same DOM, which is what lets one app.js drive both.
   ──────────────────────────────────────────────────────────────────────── */
import { iconHtml } from './icons';

export const LEAPS_MARKUP = `
                <div class="lp-app" id="lp-root">

                    <!-- First-run unit gate. Every number in the app is in the
                         system chosen here, so it is asked before anything is
                         typed rather than discovered three inputs later. -->
                    <div class="lp-unitgate" id="lp-unitgate" hidden>
                        <div class="lp-unitgate-card">
                            <div class="lp-unitgate-icon">${iconHtml('fa-ruler-combined')}</div>
                            <h3>Which units will you work in?</h3>
                            <p>Every input and every result is reported in the system you pick. You can change it later from the toolbar.</p>
                            <div class="lp-unitgate-choices">
                                <button class="lp-unitgate-btn" data-units="SI">
                                    <strong>SI</strong>
                                    <span>mm · N · MPa</span>
                                </button>
                                <button class="lp-unitgate-btn" data-units="US">
                                    <strong>English</strong>
                                    <span>in · lb · psi</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Top toolbar -->
                    <div class="lp-topbar">
                        <div class="lp-topbar-group">
                            <input id="lp-project-name" class="lp-project-name" type="text" value="Untitled analysis" spellcheck="false" aria-label="Project name" />
                        </div>
                        <div class="lp-topbar-group">
                            <button id="lp-undo" class="lp-tool" title="Undo (Ctrl+Z)" disabled>${iconHtml('fa-undo')}</button>
                            <button id="lp-redo" class="lp-tool" title="Redo (Ctrl+Y)" disabled>${iconHtml('fa-redo')}</button>
                            <span class="lp-sep"></span>
                            <select id="lp-template" class="lp-select" title="Load a template structure">
                                <option value="" disabled selected>Templates</option>
                            </select>
                            <span class="lp-sep"></span>
                            <button id="lp-open" class="lp-tool" title="Open project (.leaps.json)">${iconHtml('fa-folder-open')}</button>
                            <button id="lp-save" class="lp-tool" title="Save project">${iconHtml('fa-save')}</button>
                            <input type="file" id="lp-file" accept=".json,application/json" hidden />
                        </div>
                        <span class="lp-sep"></span>
                        <div class="lp-topbar-group lp-topbar-kind">
                            <span class="lp-topbar-label">Load</span>
                            <div id="lp-kind"></div>
                        </div>
                        <div class="lp-topbar-spacer"></div>
                        <div class="lp-topbar-group">
                            <div class="lp-progress" id="lp-progress" hidden><div class="lp-progress-fill" id="lp-progress-fill"></div></div>
                            <select id="lp-units" class="lp-select" title="Unit system. Every input and result follows it.">
                                <option value="SI" selected>SI (mm, N, MPa)</option>
                                <option value="US">English (in, lb, psi)</option>
                            </select>
                            <label class="lp-check" title="Recompute automatically after every edit">
                                <input type="checkbox" id="lp-autorun" checked /> Auto
                            </label>
                            <!-- Preflight. Run asks before it solves, and a failing
                                 check opens this list rather than reporting an
                                 error after the contour is already on screen. -->
                            <div class="lp-checks">
                                <button id="lp-checks-btn" class="lp-checks-btn is-ok" type="button"></button>
                                <div class="lp-checks-pop" id="lp-checks-pop" hidden>
                                    <div class="lp-checks-head">Before you run</div>
                                    <div id="lp-checks-list"></div>
                                </div>
                            </div>
                            <button id="lp-run" class="lp-run">${iconHtml('fa-play')} Run</button>
                        </div>
                    </div>

                    <div class="lp-body">

                        <!-- Left panel: model -->
                        <aside class="lp-left">
                            <details class="lp-section" open>
                                <summary>${iconHtml('fa-layer-group')} Structure <span class="lp-count" id="lp-layer-count"></span></summary>
                                <div class="lp-section-body">
                                    <div id="lp-layers"></div>
                                    <button id="lp-add-layer" class="lp-btn lp-btn-block">${iconHtml('fa-plus')} Add layer</button>
                                </div>
                            </details>
                            <details class="lp-section" open>
                                <summary>${iconHtml('fa-grip-lines')} Interfaces</summary>
                                <div class="lp-section-body" id="lp-interfaces"></div>
                            </details>
                            <details class="lp-section" open>
                                <summary>${iconHtml('fa-truck')} Loads <span class="lp-count" id="lp-load-count"></span></summary>
                                <div class="lp-section-body">
                                    <p class="lp-kind-blurb" id="lp-kind-note"></p>
                                    <div class="lp-subhead">${iconHtml('fa-bolt')} Gear generator</div>
                                    <div class="lp-gear-row">
                                        <select id="lp-gear" class="lp-select lp-grow">
                                            <option value="single">Single</option>
                                            <option value="dual" selected>Dual</option>
                                            <option value="dual-tandem">Dual tandem</option>
                                            <option value="tridem">Tridem axle</option>
                                            <option value="dual-tridem">Dual tridem</option>
                                        </select>
                                        <button id="lp-gear-apply" class="lp-btn" title="Replace every load with this layout">${iconHtml('fa-arrow-rotate-right')} Build</button>
                                    </div>
                                    <div class="lp-gear-params" id="lp-gear-params"></div>
                                    <div class="lp-subhead lp-subhead-row"><span>${iconHtml('fa-circle-dot')} Loads</span><button id="lp-add-load" class="lp-linkbtn" title="Add a load">${iconHtml('fa-plus')} Add</button></div>
                                    <div id="lp-loads" class="lp-loads-editor"></div>
                                </div>
                            </details>
                            <details class="lp-section">
                                <summary>${iconHtml('fa-crosshairs')} Evaluation points <span class="lp-count" id="lp-point-count"></span></summary>
                                <div class="lp-section-body">
                                    <div id="lp-points"></div>
                                    <div class="lp-row">
                                        <button id="lp-pts-add" class="lp-btn" title="Add a point at the first load">${iconHtml('fa-plus')} Add</button>
                                        <button id="lp-pts-critical" class="lp-btn lp-grow" title="Surface plus every interface, under the first load">Critical set</button>
                                        <button id="lp-pts-clear" class="lp-btn" title="Remove every point">Clear</button>
                                    </div>
                                </div>
                            </details>
                            <details class="lp-section">
                                <summary>${iconHtml('fa-sliders-h')} Solver</summary>
                                <div class="lp-section-body">
                                    <label class="lp-field"><span>Tolerance</span>
                                        <select id="lp-tol" class="lp-select">
                                            <option value="1e-5">1e-5 fast</option>
                                            <option value="1e-6" selected>1e-6 standard</option>
                                            <option value="1e-7">1e-7 high</option>
                                        </select>
                                    </label>
                                    <label class="lp-field"><span>Contour grid</span>
                                        <select id="lp-res" class="lp-select">
                                            <option value="41x31">Draft 41×31</option>
                                            <option value="61x43" selected>Standard 61×43</option>
                                            <option value="91x61">Fine 91×61</option>
                                        </select>
                                    </label>
                                    <label class="lp-check lp-check-row" title="Print strains dimensionless, in E-notation, the way a layered-elastic program does">
                                        <input type="checkbox" id="lp-strain-abs" /> Strains dimensionless
                                    </label>
                                </div>
                            </details>
                        </aside>

                        <!-- Center viewport -->
                        <div class="lp-viewport" id="lp-viewport">
                            <canvas id="lp-cv"></canvas>
                            <div class="lp-vp-toolbar">
                                <button id="lp-fit" class="lp-tool" title="Fit view (F)">${iconHtml('fa-expand')}</button>
                                <button id="lp-zin" class="lp-tool" title="Zoom in">${iconHtml('fa-search-plus')}</button>
                                <button id="lp-zout" class="lp-tool" title="Zoom out">${iconHtml('fa-search-minus')}</button>
                                <span class="lp-sep"></span>
                                <div class="lp-seg lp-seg-sm" id="lp-viewmode">
                                    <button class="lp-seg-btn is-active" data-view="2d" title="The cut itself: the x-z plane at the section line">Section</button>
                                    <button class="lp-seg-btn" data-view="3d" title="The same structure in the box it sits in, cut open at the section line. Drag to orbit.">3D</button>
                                </div>
                                <span class="lp-sep"></span>
                                <label class="lp-check lp-check-tool" title="Overlay the deflected surface, exaggerated">
                                    <input type="checkbox" id="lp-show-basin" checked /> ${iconHtml('fa-water')}
                                </label>
                                <label class="lp-check lp-check-tool" title="Show the contour overlay">
                                    <input type="checkbox" id="lp-show-contour" checked /> ${iconHtml('fa-braille')}
                                </label>
                            </div>
                            <div class="lp-vp-field">
                                <div class="lp-fieldpick" id="lp-field"></div>
                                <input id="lp-alpha" type="range" min="0.15" max="1" step="0.05" value="0.85" title="Contour opacity" />
                            </div>
                            <canvas id="lp-colorbar" width="82" height="280"></canvas>
                            <div class="lp-plan-panel" id="lp-plan-panel">
                                <div class="lp-plan-head">
                                    <span>${iconHtml('fa-map')} Plan view</span>
                                    <button id="lp-plan-toggle" class="lp-plan-btn" title="Collapse or expand">${iconHtml('fa-chevron-down')}</button>
                                </div>
                                <canvas id="lp-plan" title="Drag the dashed line to move the analysis section"></canvas>
                            </div>
                            <div class="lp-hover" id="lp-hover" hidden></div>
                        </div>

                        <!-- Right panel: key responses + export -->
                        <aside class="lp-right">
                            <div class="lp-right-scroll">
                                <div class="lp-right-block">
                                    <h4 class="lp-h4">${iconHtml('fa-bullseye')} Key responses</h4>
                                    <div id="lp-cards"></div>
                                </div>
                                <div class="lp-right-block">
                                    <h4 class="lp-h4">${iconHtml('fa-download')} Export</h4>
                                    <button class="lp-btn lp-btn-block lp-btn-primary" id="lp-exp-analysis" title="One file: the structure, the interfaces, every load, the solver settings and every response at every evaluation point, in the units on screen.">${iconHtml('fa-file-csv')} Export full analysis</button>
                                    <div class="lp-export-grid">
                                        <button class="lp-btn" id="lp-exp-json" title="Reloadable project file">${iconHtml('fa-code')} Project</button>
                                        <button class="lp-btn" id="lp-exp-grid" title="The contoured field on its grid">${iconHtml('fa-border-all')} Field grid</button>
                                        <button class="lp-btn" id="lp-exp-png" title="The section as drawn">${iconHtml('fa-image')} Section PNG</button>
                                    </div>
                                </div>
                            </div>
                        </aside>
                    </div>

                    <!-- Bottom results dock -->
                    <div class="lp-dock" id="lp-dock">
                        <div class="lp-dock-tabs" role="tablist">
                            <button class="lp-dtab is-active" data-dtab="points" role="tab">${iconHtml('fa-table-columns')} Results table</button>
                            <button class="lp-dtab" data-dtab="profiles" role="tab">${iconHtml('fa-chart-line')} Profiles</button>
                            <button class="lp-dtab" data-dtab="layers" role="tab">${iconHtml('fa-table-cells')} Layer responses</button>
                            <button class="lp-dtab" data-dtab="performance" role="tab">${iconHtml('fa-gauge-high')} Performance</button>
                            <div class="lp-dock-spacer"></div>
                            <button class="lp-dock-collapse" id="lp-dock-collapse" title="Collapse or expand the dock">${iconHtml('fa-chevron-down')}</button>
                        </div>
                        <div class="lp-dock-body" id="lp-dock-body">

                            <div class="lp-dpane is-active" data-dpane="points">
                                <p class="lp-hint" id="lp-table-hint"></p>
                                <div id="lp-pts-table"></div>
                            </div>

                            <div class="lp-dpane" data-dpane="profiles">
                                <div class="lp-prof-controls">
                                    <label class="lp-field lp-field-inline lp-field-linked"><span>${iconHtml('fa-link')} Field</span>
                                        <div class="lp-fieldpick" id="lp-prof-field"></div>
                                    </label>
                                </div>
                                <div class="lp-prof-grid">
                                    <div class="lp-chart-card is-linked">
                                        <div class="lp-chart-head">
                                            <div class="lp-chart-title" id="lp-title-profile">Depth profile</div>
                                            <span class="lp-chart-flag is-linked" title="Re-plots when you change the Field selector">${iconHtml('fa-link')} Field</span>
                                        </div>
                                        <div id="lp-chart-profile" class="lp-chart"></div>
                                    </div>
                                    <div class="lp-chart-card is-linked">
                                        <div class="lp-chart-head">
                                            <div class="lp-chart-title" id="lp-title-surface">Surface response</div>
                                            <span class="lp-chart-flag is-linked" title="Re-plots when you change the Field selector">${iconHtml('fa-link')} Field</span>
                                        </div>
                                        <div id="lp-chart-surface" class="lp-chart"></div>
                                    </div>
                                    <div class="lp-chart-card">
                                        <div class="lp-chart-head">
                                            <div class="lp-chart-title">Surface deflection basin</div>
                                            <span class="lp-chart-flag" title="Always vertical surface deflection, independent of the Field selector">${iconHtml('fa-thumbtack')} Fixed</span>
                                        </div>
                                        <div id="lp-chart-basin" class="lp-chart"></div>
                                    </div>
                                </div>
                                <div class="lp-chart-card lp-chart-card-wide">
                                    <div class="lp-chart-head">
                                        <div class="lp-chart-title">Depth profiles by field</div>
                                        <span class="lp-chart-flag" title="A constant six-field reference grid, independent of the Field selector">${iconHtml('fa-thumbtack')} Fixed</span>
                                    </div>
                                    <div id="lp-smallmults" class="lp-smallmults"></div>
                                </div>
                            </div>

                            <div class="lp-dpane" data-dpane="layers">
                                <p class="lp-hint">Maxima across every evaluated load station. Tension positive.</p>
                                <div id="lp-layer-table"></div>
                            </div>

                            <div class="lp-dpane" data-dpane="performance">
                                <div id="lp-perf"></div>
                            </div>

                        </div>
                    </div>

                    <!-- Status bar -->
                    <div class="lp-statusbar">
                        <span id="lp-engine" class="lp-status-badge" title="The engine self-checks against Boussinesq closed forms at startup">
                            ${iconHtml('fa-circle-notch', undefined, 'spin')} LEAF-JS starting
                        </span>
                        <span id="lp-stats" class="lp-status-item"></span>
                        <span class="lp-status-spacer"></span>
                        <span class="lp-status-item lp-conv" title="Stresses are tension positive, z is measured downward from the surface, deflection is positive downward, and shear strains are engineering strains.">tension + · z down</span>
                        <span id="lp-coords" class="lp-status-item lp-mono"></span>
                    </div>
                </div>
`;
