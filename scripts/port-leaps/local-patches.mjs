// Local LEAPS fixes applied after the upstream port transforms.
// Each replacement is asserted by the caller so upstream changes require review.

export function patchSceneBounds(sub) {
    sub('patchSceneBounds 1',
`            h: Math.sqrt(Math.max(R * R - flat * flat, 1)) };
    }

    function mulberry32(seed) {
        var t0 = seed >>> 0;
        return function () {
`,
`            h: Math.sqrt(Math.max(R * R - flat * flat, 1)) };
    }

    /* Display bounds must contain the complete gear, independently on each
     * axis. In particular, tandem spacing has no upper bound tied to the
     * dual spacing. Keep clearance beyond both the contact and drawn tire. */
    function gearSceneBounds(box, loads, a, tire, lineX, lineY, ySec) {
        var x0 = 0, x1 = 0, y0 = 0, y1 = 0;
        if (loads.length) {
            x0 = x1 = loads[0].x;
            y0 = y1 = loads[0].y;
            loads.forEach(function (w) {
                x0 = Math.min(x0, w.x); x1 = Math.max(x1, w.x);
                y0 = Math.min(y0, w.y); y1 = Math.max(y1, w.y);
            });
        }
        var padX = Math.max(3 * a, (tire ? tire.w : 0) + a, lineX + a);
        var padY = Math.max(4 * a, (tire ? tire.R : 0) + a, lineY + a);
        var xL = Math.min(box.xL, x0 - padX), xR = Math.max(box.xR, x1 + padX);
        var yc = y0 / 2 + y1 / 2;
        var yHalf = Math.max((y1 - y0) / 2 + padY, 0.2 * (xR - xL));
        return {
            xL: xL, xR: xR, zMax: box.zMax, df: box.df,
            zTop: tire ? -(tire.h + tire.R) : 0,
            y0: Math.min(yc - yHalf, ySec - 60),
            y1: Math.max(yc + yHalf, ySec + 60)
        };
    }

    function mulberry32(seed) {
        var t0 = seed >>> 0;
        return function () {
`);
    sub('patchSceneBounds 2',
`            for (var i = 0; i < ws.length; i++) a = Math.max(a, loadA(ws[i]));
            return tireFit(ws, Math.max(a, 20));
        }
        function tireTop() {
            var g = tireGeom();
            return g ? -(g.h + g.R) : 0;
        }

        function sceneBox() {
            var box = worldBox();
            var yc = 0, n = state.loads.length;
            if (n) {
                var sy = 0;
                state.loads.forEach(function (w) { sy += w.y; });
                yc = sy / n;
            }
            var span = box.xR - box.xL;
            var yExt = 0;
            state.loads.forEach(function (w) { yExt = Math.max(yExt, Math.abs(w.y - yc)); });
            if (state.loadKind === 'line') {
                yExt += 0.5 * gearParams.L * Math.abs(Math.sin(gearParams.theta * Math.PI / 180));
            }
            var yHalf = clamp(yExt + 4 * maxA(), 0.2 * span, 0.5 * span);
            return {
                xL: box.xL, xR: box.xR, zMax: box.zMax, df: box.df,
                zTop: tireTop(),
                y0: Math.min(yc - yHalf, state.ySec - 60),
                y1: Math.max(yc + yHalf, state.ySec + 60)
            };
        }
        /* The projection is affine, which is the whole reason the contour
         * image can be poured onto the cut face with one ctx.transform
`,
`            for (var i = 0; i < ws.length; i++) a = Math.max(a, loadA(ws[i]));
            return tireFit(ws, Math.max(a, 20));
        }
        function sceneBox() {
            var lineX = 0, lineY = 0;
            if (state.loadKind === 'line') {
                var th = gearParams.theta * Math.PI / 180;
                lineX = 0.5 * gearParams.L * Math.abs(Math.cos(th));
                lineY = 0.5 * gearParams.L * Math.abs(Math.sin(th));
            }
            return gearSceneBounds(worldBox(), state.loads, maxA(), tireGeom(), lineX, lineY, state.ySec);
        }
        /* The projection is affine, which is the whole reason the contour
         * image can be poured onto the cut face with one ctx.transform
`);
    sub('patchSceneBounds 3',
`            view3.ox = vpW / 2 - sc * (x0 + x1) / 2;
            view3.oy = (vpH - X_RULER_H) / 2 + 6 - sc * (y0 + y1) / 2;
            view3.fitted = true;
        }
        function poly3(B, pts, fill, stroke, lw) {
            ctx.beginPath();
`,
`            view3.ox = vpW / 2 - sc * (x0 + x1) / 2;
            view3.oy = (vpH - X_RULER_H) / 2 + 6 - sc * (y0 + y1) / 2;
            view3.fitted = true;
            view3.bounds = sb;
        }
        function poly3(B, pts, fill, stroke, lw) {
            ctx.beginPath();
`);
    sub('patchSceneBounds 4',
`
        function drawScene3D(quality) {
            var sb = sceneBox();
            if (!view3.fitted) fit3();
            var B = basis3();
            var L3 = light3(view3.az, view3.el);
            var W3 = viewDir3(view3.az, view3.el);
`,
`
        function drawScene3D(quality) {
            var sb = sceneBox();
            if (!view3.fitted || ['xL', 'xR', 'y0', 'y1', 'zTop', 'zMax'].some(function (key) {
                return !view3.bounds || sb[key] !== view3.bounds[key];
            })) fit3();
            var B = basis3();
            var L3 = light3(view3.az, view3.el);
            var W3 = viewDir3(view3.az, view3.el);
`);
    sub('patchSceneBounds 5',
`
            /* ---- the ground grid: this is where x and y get their scale ---- */
            var gstep = niceStep((sb.xR - sb.xL) / 8);
            ctx.save();
            ctx.globalAlpha = 0.3;
            var gx, gy;
            for (gx = Math.ceil(sb.xL / gstep) * gstep; gx <= sb.xR; gx += gstep) {
                line3(B, [gx, solidA, 0], [gx, solidB, 0], Math.abs(gx) < 1e-6 ? ink3 : lineC, 1);
            }
            for (gy = Math.ceil(solidA / gstep) * gstep; gy <= solidB; gy += gstep) {
                line3(B, [sb.xL, gy, 0], [sb.xR, gy, 0], Math.abs(gy) < 1e-6 ? ink3 : lineC, 1);
            }
            ctx.restore();
`,
`
            /* ---- the ground grid: this is where x and y get their scale ---- */
            var gstep = niceStep((sb.xR - sb.xL) / 8);
            var yGstep = niceStep((sb.y1 - sb.y0) / 8);
            ctx.save();
            ctx.globalAlpha = 0.3;
            var gx, gy;
            for (gx = Math.ceil(sb.xL / gstep) * gstep; gx <= sb.xR; gx += gstep) {
                line3(B, [gx, solidA, 0], [gx, solidB, 0], Math.abs(gx) < 1e-6 ? ink3 : lineC, 1);
            }
            for (gy = Math.ceil(solidA / yGstep) * yGstep; gy <= solidB; gy += yGstep) {
                line3(B, [sb.xL, gy, 0], [sb.xR, gy, 0], Math.abs(gy) < 1e-6 ? ink3 : lineC, 1);
            }
            ctx.restore();
`);
    sub('patchSceneBounds 6',
`        mirrorXPoint: mirrorXPoint,
        viewDir3: viewDir3,
        lambert3: lambert3,
        tireFit: tireFit
    };
})();

`,
`        mirrorXPoint: mirrorXPoint,
        viewDir3: viewDir3,
        lambert3: lambert3,
        tireFit: tireFit,
        gearSceneBounds: gearSceneBounds
    };
})();

`);
    sub('patchSceneBounds 7',
`export const viewDir3 = LEAPS_APP.viewDir3;
export const lambert3 = LEAPS_APP.lambert3;
export const tireFit = LEAPS_APP.tireFit;
export default LEAPS_APP;
`,
`export const viewDir3 = LEAPS_APP.viewDir3;
export const lambert3 = LEAPS_APP.lambert3;
export const tireFit = LEAPS_APP.tireFit;
export const gearSceneBounds = LEAPS_APP.gearSceneBounds;
export default LEAPS_APP;
`);
}

export function patchPanelWidths(sub) {
    sub('patchPanelWidths 1',
`
.lp-body {
    display: grid;
    grid-template-columns: 300px minmax(420px, 1fr) 320px;
    min-height: 640px;
}

`,
`
.lp-body {
    display: grid;
    grid-template-columns: 420px minmax(420px, 1fr) 288px;
    min-height: 640px;
}

`);
    sub('patchPanelWidths 2',
`
/* ---------- Side panels ---------- */
.lp-left, .lp-right {
    background: var(--lp-bg1);
    overflow-y: auto; max-height: 78vh;
}
`,
`
/* ---------- Side panels ---------- */
.lp-left, .lp-right {
    min-width: 0;
    background: var(--lp-bg1);
    overflow-y: auto; max-height: 78vh;
}
`);
    sub('patchPanelWidths 3',
`.lp-gear-params .lp-field { margin: 0; }

/* ---------- Wheels table ---------- */
.lp-loads-editor { margin-top: 0.1em; }
.lp-app table.lp-wtable { width: 100%; border-collapse: collapse; }
.lp-app .lp-wtable th {
    font-size: 0.62em; letter-spacing: 0.04em; text-transform: uppercase;
`,
`.lp-gear-params .lp-field { margin: 0; }

/* ---------- Wheels table ---------- */
.lp-loads-editor { margin-top: 0.1em; overflow-x: auto; }
.lp-app table.lp-wtable { width: 100%; border-collapse: collapse; }
.lp-app .lp-wtable th {
    font-size: 0.62em; letter-spacing: 0.04em; text-transform: uppercase;
`);
    sub('patchPanelWidths 4',
`    color: var(--lp-accent); white-space: nowrap;
}
.lp-app .lp-wtable td input[type="number"] {
    padding: 0.28em 0.2em; text-align: right; font-size: 0.74em; border-radius: 5px;
}
.lp-wdel { min-width: 1.5em; height: 1.6em; font-size: 0.72em; padding: 0; }
.lp-wfoot {
    font-family: var(--lp-mono); font-size: 0.62em; color: var(--lp-ink3);
`,
`    color: var(--lp-accent); white-space: nowrap;
}
.lp-app .lp-wtable td input[type="number"] {
    min-width: 9ch;
    appearance: textfield;
    padding: 0.28em 0.2em; text-align: right; font-size: 0.74em; border-radius: 5px;
}
.lp-app .lp-wtable input::-webkit-inner-spin-button,
.lp-app .lp-wtable input::-webkit-outer-spin-button { appearance: none; margin: 0; }
.lp-wdel { min-width: 1.5em; height: 1.6em; font-size: 0.72em; padding: 0; }
.lp-wfoot {
    font-family: var(--lp-mono); font-size: 0.62em; color: var(--lp-ink3);
`);
    sub('patchPanelWidths 5',
` * mobile URL bar hides.
 */
@media (max-width: 1280px) {
    .lp-body { grid-template-columns: 264px minmax(360px, 1fr) 300px; }
    .lp-prof-grid { grid-template-columns: 1fr 1fr; }
}

/* ---------- Tablet: rail + viewport, right rail below ---------- */
@media (max-width: 1080px) and (min-width: 720px) {
    .lp-body {
        grid-template-columns: clamp(240px, 30vw, 300px) minmax(0, 1fr);
        grid-template-areas:
            "left viewport"
            "right right";
`,
` * mobile URL bar hides.
 */
@media (max-width: 1280px) {
    .lp-body { grid-template-columns: 420px minmax(0, 1fr) 270px; }
    .lp-prof-grid { grid-template-columns: 1fr 1fr; }
}

/* ---------- Tablet: rail + viewport, right rail below ---------- */
@media (max-width: 1080px) and (min-width: 720px) {
    .lp-body {
        grid-template-columns: 420px minmax(0, 1fr);
        grid-template-areas:
            "left viewport"
            "right right";
`);
}
