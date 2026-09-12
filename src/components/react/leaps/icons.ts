/* Icon set for LEAPS.
 *
 * The upstream E-Lab (johanncardenas.com/e-labs/leaps) draws its chrome with
 * Font Awesome. This site does not load Font Awesome — it draws its own strokes
 * in Icon.astro — so every glyph upstream uses is redrawn here on the same
 * 24-unit grid at the same 1.75 weight with round caps and joins, and LEAPS
 * reads as part of the course site rather than as a transplant.
 *
 * The KEYS ARE THE UPSTREAM CLASS NAMES, deliberately. `port-main.mjs` and
 * `port-markup.mjs` rewrite `<i class="fas fa-x"></i>` into `iconHtml('fa-x')`
 * without touching the name, so a glyph upstream adds shows up here as a
 * missing key and a thrown error at build time, never as an empty square on
 * the page.
 */

export const LP_PATHS: Record<string, string> = {
  // ── Toolbar ──────────────────────────────────────────────────────────────
  'fa-undo': '<path d="M4 9h11a5 5 0 0 1 0 10H9"/><path d="M8 5 4 9l4 4"/>',
  'fa-redo': '<path d="M20 9H9a5 5 0 0 0 0 10h6"/><path d="m16 5 4 4-4 4"/>',
  'fa-folder-open':
    '<path d="M3 9V6.5A1.5 1.5 0 0 1 4.5 5h4l2 2.5h6A1.5 1.5 0 0 1 18 9v1"/>' +
    '<path d="M3.4 10h17.2l-2.1 8.4a1.5 1.5 0 0 1-1.45 1.1H5.35a1.5 1.5 0 0 1-1.45-1.1z"/>',
  'fa-save':
    '<path d="M5.5 3.5h10L20 8v12a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 20V5a1.5 1.5 0 0 1 1.5-1.5z"/>' +
    '<path d="M8 3.5V9h7"/><rect x="8" y="14" width="8" height="7.5" rx="1"/>',
  'fa-play': '<path d="M7 4.7 19.5 12 7 19.3z"/>',
  'fa-ruler-combined':
    '<path d="M3.5 3.5h6v17h-6z"/><path d="M9.5 14.5h11v6h-11z"/>' +
    '<path d="M3.5 7.5h3M3.5 11.5h3M3.5 15.5h3M13.5 20.5v-3M17 20.5v-3" opacity=".55"/>',

  // ── Panel headings ───────────────────────────────────────────────────────
  'fa-layer-group':
    '<path d="M12 3 21 7.5 12 12 3 7.5z"/><path d="m3 12 9 4.5 9-4.5" opacity=".6"/>' +
    '<path d="m3 16.5 9 4.5 9-4.5" opacity=".35"/>',
  'fa-grip-lines': '<path d="M4 9.5h16M4 14.5h16"/>',
  'fa-grip-vertical':
    '<circle cx="9.5" cy="6" r="1.3"/><circle cx="9.5" cy="12" r="1.3"/><circle cx="9.5" cy="18" r="1.3"/>' +
    '<circle cx="14.5" cy="6" r="1.3"/><circle cx="14.5" cy="12" r="1.3"/><circle cx="14.5" cy="18" r="1.3"/>',
  'fa-truck':
    '<path d="M2.5 6.5h10.5v9H2.5z"/><path d="M13 9.5h4l3.5 3.5v2.5H13z"/>' +
    '<circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
  'fa-shapes':
    '<circle cx="7" cy="7" r="3.4"/><rect x="13" y="3.6" width="7" height="7" rx="1.2"/>' +
    '<path d="M12 13.4 17 21H7z"/>',
  'fa-bolt': '<path d="M13.5 2.5 5.5 13h5l-1 8.5 8.5-11h-5.2z"/>',
  'fa-crosshairs':
    '<circle cx="12" cy="12" r="6.5"/><path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4"/>',
  'fa-sliders-h':
    '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2.2"/><circle cx="10" cy="17" r="2.2"/>',
  'fa-bullseye':
    '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.8" opacity=".6"/><circle cx="12" cy="12" r="1.4"/>',
  'fa-download': '<path d="M12 3.5v11"/><path d="m7.5 10.5 4.5 4.5 4.5-4.5"/><path d="M4 19.5h16"/>',

  // ── The three load idealizations ─────────────────────────────────────────
  // A circular imprint, a concentrated force, a loaded segment. These three
  // are the tool's own vocabulary, so they are drawn to read against each
  // other at 16px rather than borrowed from anywhere.
  'fa-circle-dot': '<circle cx="12" cy="12" r="8.2"/><circle cx="12" cy="12" r="2.6"/>',
  'fa-location-dot':
    '<path d="M12 21.5s7-6.6 7-11.2A7 7 0 0 0 5 10.3c0 4.6 7 11.2 7 11.2z"/><circle cx="12" cy="10.2" r="2.6"/>',

  // ── Structure and layer rows ─────────────────────────────────────────────
  'fa-plus': '<path d="M12 5v14M5 12h14"/>',
  'fa-times': '<path d="M6 6l12 12M18 6 6 18"/>',
  'fa-ellipsis-h': '<circle cx="6" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="18" cy="12" r="1.4"/>',
  'fa-arrow-up': '<path d="M12 20V4"/><path d="m6 10 6-6 6 6"/>',
  'fa-arrow-down': '<path d="M12 4v16"/><path d="m6 14 6 6 6-6"/>',
  'fa-arrow-left': '<path d="M20 12H4"/><path d="m10 6-6 6 6 6"/>',
  'fa-arrow-rotate-right':
    '<path d="M20.5 12a8.5 8.5 0 1 1-2.7-6.2L21 8.7"/><path d="M21 3.6V9h-5.4"/>',
  'fa-clone':
    '<rect x="9" y="9" width="11.5" height="11.5" rx="2"/>' +
    '<path d="M5.2 15h-.7A1.5 1.5 0 0 1 3 13.5V5a1.5 1.5 0 0 1 1.5-1.5H13A1.5 1.5 0 0 1 14.5 5v.7"/>',
  'fa-trash':
    '<path d="M4 6.5h16"/><path d="M9.5 6.5V4.9a1.4 1.4 0 0 1 1.4-1.4h2.2a1.4 1.4 0 0 1 1.4 1.4v1.6"/>' +
    '<path d="m6.6 6.5.9 13.1a1.5 1.5 0 0 0 1.5 1.4h6a1.5 1.5 0 0 0 1.5-1.4l.9-13.1"/>' +
    '<path d="M10.5 10.5v6M13.5 10.5v6" opacity=".45"/>',
  'fa-anchor':
    '<circle cx="12" cy="5" r="2.2"/><path d="M12 7.2V21"/><path d="M8 10.5h8"/>' +
    '<path d="M4 14.5a8 8 0 0 0 16 0"/><path d="M2.8 14.5h2.4M18.8 14.5h2.4"/>',
  'fa-infinity': '<path d="M8.6 9a3 3 0 1 0 0 6c2.3 0 3.1-6 5.4-6a3 3 0 1 1 0 6c-2.3 0-3.1-6-5.4-6z"/>',

  // ── Viewport ─────────────────────────────────────────────────────────────
  'fa-expand': '<path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5"/>',
  'fa-search-plus':
    '<circle cx="10.8" cy="10.8" r="6.6"/><path d="m15.6 15.6 4.6 4.6"/><path d="M8 10.8h5.6M10.8 8v5.6"/>',
  'fa-search-minus':
    '<circle cx="10.8" cy="10.8" r="6.6"/><path d="m15.6 15.6 4.6 4.6"/><path d="M8 10.8h5.6"/>',
  'fa-water':
    '<path d="M2.5 8.5c2-1.6 3.5-1.6 5.5 0s3.5 1.6 5.5 0 3.5-1.6 5.5 0"/>' +
    '<path d="M2.5 13.5c2-1.6 3.5-1.6 5.5 0s3.5 1.6 5.5 0 3.5-1.6 5.5 0"/>' +
    '<path d="M2.5 18.5c2-1.6 3.5-1.6 5.5 0s3.5 1.6 5.5 0 3.5-1.6 5.5 0"/>',
  'fa-braille':
    '<circle cx="7" cy="6.5" r="1.3"/><circle cx="7" cy="12" r="1.3"/><circle cx="7" cy="17.5" r="1.3"/>' +
    '<circle cx="14" cy="6.5" r="1.3"/><circle cx="17.5" cy="12" r="1.3"/><circle cx="14" cy="17.5" r="1.3"/>',
  'fa-map':
    '<path d="M3 6.5 9 4l6 2.5L21 4v13.5L15 20l-6-2.5L3 20z"/>' +
    '<path d="M9 4v13.5M15 6.5V20" opacity=".55"/>',
  'fa-chevron-down': '<path d="m6.5 9.5 5.5 5.5 5.5-5.5"/>',
  'fa-chevron-right': '<path d="m9.5 6.5 5.5 5.5-5.5 5.5"/>',

  // ── Results dock ─────────────────────────────────────────────────────────
  'fa-table-columns':
    '<rect x="3.5" y="4.5" width="17" height="15" rx="1.8"/><path d="M12 4.5v15"/>' +
    '<path d="M3.5 8.5h17" opacity=".55"/>',
  'fa-table-cells':
    '<rect x="3.5" y="4.5" width="17" height="15" rx="1.8"/>' +
    '<path d="M3.5 9.5h17M3.5 14.5h17M9.5 4.5v15M15 4.5v15" opacity=".7"/>',
  'fa-chart-line': '<path d="M4 4v16h16"/><path d="m7 15 3.5-4.5 3 2.5L20 6"/>',
  'fa-gauge-high':
    '<path d="M3.6 17.5a9.5 9.5 0 1 1 16.8 0"/><path d="m12 13 4.5-4.5"/><circle cx="12" cy="14.5" r="1.6"/>',
  'fa-link':
    '<path d="M10 13.5a3.6 3.6 0 0 0 5.3.4l2.7-2.7a3.6 3.6 0 0 0-5.1-5.1l-1.5 1.5"/>' +
    '<path d="M14 10.5a3.6 3.6 0 0 0-5.3-.4L6 12.8a3.6 3.6 0 0 0 5.1 5.1l1.5-1.5"/>',
  'fa-thumbtack':
    '<path d="M9 3.5h6l-1 5.5 3.5 3v1.5h-11V12l3.5-3z"/><path d="M12 13.5v7"/>',

  // ── Results groups ───────────────────────────────────────────────────────
  'fa-location-crosshairs':
    '<circle cx="12" cy="12" r="3.4"/><circle cx="12" cy="12" r="7.4" opacity=".5"/>' +
    '<path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3"/>',
  'fa-weight-hanging':
    '<path d="M5.5 8.5h13L20.5 20.5H3.5z"/><path d="M9.4 8.5a2.6 2.6 0 1 1 5.2 0"/>',
  'fa-arrows-left-right-to-line':
    '<path d="M4 4v16M20 4v16"/><path d="M7.5 12h9"/><path d="m10 9-3 3 3 3M14 9l3 3-3 3"/>',
  'fa-arrows-down-to-line':
    '<path d="M4 20.5h16"/><path d="M7 4v9M17 4v9"/><path d="m4 10 3 3 3-3M14 10l3 3 3-3"/>',
  'fa-vector-square':
    '<rect x="6.5" y="6.5" width="11" height="11"/>' +
    '<rect x="3.5" y="3.5" width="4" height="4"/><rect x="16.5" y="3.5" width="4" height="4"/>' +
    '<rect x="3.5" y="16.5" width="4" height="4"/><rect x="16.5" y="16.5" width="4" height="4"/>',

  // ── Performance ──────────────────────────────────────────────────────────
  'fa-network-wired':
    '<rect x="8.5" y="3" width="7" height="5" rx="1"/>' +
    '<rect x="2.5" y="16" width="6" height="5" rx="1"/><rect x="15.5" y="16" width="6" height="5" rx="1"/>' +
    '<path d="M12 8v4M5.5 16v-4h13v4"/>',
  'fa-flag-checkered':
    '<path d="M5 21V4"/><path d="M5 5h14v9H5z"/><path d="M12 5v9M5 9.5h14" opacity=".6"/>',

  // ── Export ───────────────────────────────────────────────────────────────
  'fa-file-csv':
    '<path d="M13.5 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5z"/><path d="M13.5 3v5.5H19"/>' +
    '<path d="M8.5 13h7M8.5 16.5h7" opacity=".6"/>',
  'fa-code': '<path d="m9 8-5 4 5 4M15 8l5 4-5 4"/>',
  'fa-border-all':
    '<rect x="3.5" y="3.5" width="17" height="17" rx="1.5"/><path d="M12 3.5v17M3.5 12h17"/>',
  'fa-image':
    '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="8.8" cy="9.8" r="1.7"/>' +
    '<path d="m4.5 17.5 5-5 4 4 2.5-2.5 4 3.5"/>',

  // ── Status ───────────────────────────────────────────────────────────────
  'fa-check-circle': '<circle cx="12" cy="12" r="8.5"/><path d="m8 12.3 2.7 2.7L16 9.6"/>',
  'fa-exclamation-triangle':
    '<path d="M12 3.8 21.3 20H2.7z"/><path d="M12 9.8v4.4"/><circle cx="12" cy="17.2" r="1"/>',
  'fa-triangle-exclamation':
    '<path d="M12 3.8 21.3 20H2.7z"/><path d="M12 9.8v4.4"/><circle cx="12" cy="17.2" r="1"/>',
  'fa-circle-notch': '<path d="M12 3.5a8.5 8.5 0 1 0 8.5 8.5"/>',
};

export type LpIconName = keyof typeof LP_PATHS;

const SVG_OPEN =
  '<svg class="lp-i" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
  'stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';

/**
 * A glyph as an HTML string, for the panels `leaps.js` builds with innerHTML.
 *
 * An unknown name throws rather than rendering an empty box: upstream's icon
 * names are the port's own contract, and a silent blank square in a toolbar is
 * the kind of thing that ships.
 */
export function iconHtml(name: string, title?: string, extraClass?: string): string {
  const d = LP_PATHS[name];
  if (!d) throw new Error(`LEAPS: no glyph for "${name}" — add it to leaps/icons.ts`);
  const cls = extraClass ? ` lp-i--${extraClass}` : '';
  const t = title ? `<title>${title}</title>` : '';
  return SVG_OPEN.replace('class="lp-i"', `class="lp-i${cls}"`) + '>' + t + d + '</svg>';
}
