/* Icon set for Cross-Section Studio.
 *
 * The upstream studio (johanncardenas.com/e-labs/cross-section-studio) draws its
 * chrome with Font Awesome. This site does not load Font Awesome — it draws its
 * own strokes in Icon.astro — so every glyph is redrawn here on the same 24-unit
 * grid at the same 1.75 weight with round caps and joins, and the studio reads
 * as part of the course site rather than as a transplant.
 *
 * Two consumers, one source of truth: `XsIcon` for the JSX chrome, and
 * `iconHtml()` for the layer rows, which studio.ts builds as HTML strings.
 */

export const XS_PATHS = {
  // ── Toolbar ──────────────────────────────────────────────────────────────
  undo: '<path d="M4 9h11a5 5 0 0 1 0 10H9"/><path d="M8 5 4 9l4 4"/>',
  redo: '<path d="M20 9H9a5 5 0 0 0 0 10h6"/><path d="m16 5 4 4-4 4"/>',
  folder:
    '<path d="M3 9V6.5A1.5 1.5 0 0 1 4.5 5h4l2 2.5h6A1.5 1.5 0 0 1 18 9v1"/>' +
    '<path d="M3.4 10h17.2l-2.1 8.4a1.5 1.5 0 0 1-1.45 1.1H5.35a1.5 1.5 0 0 1-1.45-1.1z"/>',
  save:
    '<path d="M5.5 3.5h10L20 8v12a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 20V5a1.5 1.5 0 0 1 1.5-1.5z"/>' +
    '<path d="M8 3.5V9h7"/><rect x="8" y="14" width="8" height="7.5" rx="1"/>',
  reset: '<path d="M3.5 12a8.5 8.5 0 1 0 2.7-6.2L3 8.7"/><path d="M3 3.6v5.4h5.4"/>',
  camera:
    '<path d="M3 9A1.5 1.5 0 0 1 4.5 7.5h2.6l1.4-2.3h7l1.4 2.3h2.6A1.5 1.5 0 0 1 21 9v8.8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.8z"/>' +
    '<circle cx="12" cy="13.2" r="3.5"/>',
  copy:
    '<rect x="9" y="9" width="11.5" height="11.5" rx="2"/>' +
    '<path d="M5.2 15h-.7A1.5 1.5 0 0 1 3 13.5V5a1.5 1.5 0 0 1 1.5-1.5H13A1.5 1.5 0 0 1 14.5 5v.7"/>',
  // Copy on a transparent ground: the same sheet, quartered like a checkerboard.
  'copy-alpha':
    '<rect x="9" y="9" width="11.5" height="11.5" rx="2"/>' +
    '<path d="M5.2 15h-.7A1.5 1.5 0 0 1 3 13.5V5a1.5 1.5 0 0 1 1.5-1.5H13A1.5 1.5 0 0 1 14.5 5v.7"/>' +
    '<path d="M14.75 9v11.5M9 14.75h11.5" opacity=".45"/>',

  // ── Panel headings ───────────────────────────────────────────────────────
  geometry:
    '<path d="M7 4H5.5A1.5 1.5 0 0 0 4 5.5V7M17 4h1.5A1.5 1.5 0 0 1 20 5.5V7M7 20H5.5A1.5 1.5 0 0 1 4 18.5V17M17 20h1.5a1.5 1.5 0 0 0 1.5-1.5V17"/>' +
    '<path d="M4 12h16M12 4v16" opacity=".4"/>',
  video: '<rect x="3" y="6" width="12" height="12" rx="2"/><path d="M15 10.4 21 7v10l-6-3.4z"/>',
  bulb:
    '<path d="M9.5 18.5h5M10.5 21.5h3"/>' +
    '<path d="M12 2.5a6 6 0 0 0-3.6 10.8c.7.5 1.1 1.3 1.1 2.1v.6h5v-.6c0-.8.4-1.6 1.1-2.1A6 6 0 0 0 12 2.5z"/>',
  droplet: '<path d="M12 3.2c0 0 6.2 6.6 6.2 10.4a6.2 6.2 0 0 1-12.4 0C5.8 9.8 12 3.2 12 3.2z"/>',
  fileExport:
    '<path d="M13.5 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5z"/><path d="M13.5 3v5.5H19"/>' +
    '<path d="M12 11.5v6M9.5 15l2.5 2.5 2.5-2.5"/>',
  fileText:
    '<path d="M13.5 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5z"/><path d="M13.5 3v5.5H19"/>' +
    '<path d="M8.5 12.5h4M8.5 16h7"/>',
  swatch:
    '<rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1.5"/><rect x="13" y="3.5" width="7.5" height="7.5" rx="1.5"/>' +
    '<rect x="3.5" y="13" width="7.5" height="7.5" rx="1.5"/><rect x="13" y="13" width="7.5" height="7.5" rx="1.5"/>',
  sliders:
    '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2.2"/><circle cx="10" cy="17" r="2.2"/>',
  layers: '<path d="M3 7h18M3 12h18M3 17h18"/><path d="M3 7v10M21 7v10"/>',

  // ── Camera presets ───────────────────────────────────────────────────────
  cube: '<path d="M12 2.8 20.6 7.6v8.8L12 21.2 3.4 16.4V7.6z"/><path d="M12 21.2v-9M12 12.2 3.5 7.5M12 12.2l8.5-4.7" opacity=".5"/>',
  square: '<rect x="4.5" y="4.5" width="15" height="15" rx="1.5"/>',
  expand: '<path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5"/>',

  // ── Layer rows ───────────────────────────────────────────────────────────
  plus: '<path d="M12 5v14M5 12h14"/>',
  eraser:
    '<path d="M8.8 19.5 4.2 14.9a1.5 1.5 0 0 1 0-2.1l8-8a1.5 1.5 0 0 1 2.1 0l4.6 4.6a1.5 1.5 0 0 1 0 2.1l-5.4 5.4z"/>' +
    '<path d="M20 20H9.5"/><path d="m8.6 8.6 6.8 6.8" opacity=".45"/>',
  chevronUp: '<path d="m6.5 14.5 5.5-5.5 5.5 5.5"/>',
  chevronDown: '<path d="m6.5 9.5 5.5 5.5 5.5-5.5"/>',
  eye: '<path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3.2"/>',
  eyeOff:
    '<path d="M10.7 6.1A9.9 9.9 0 0 1 12 6c6 0 9.5 6 9.5 6a17.6 17.6 0 0 1-3.1 3.7"/>' +
    '<path d="M6.4 8.4A17.4 17.4 0 0 0 2.5 12s3.5 6 9.5 6a9.6 9.6 0 0 0 4-.9"/>' +
    '<path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/><path d="M3.5 3.5 20.5 20.5"/>',
  lock: '<rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V7.6a4 4 0 0 1 8 0v2.9"/>',
  unlock: '<rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V7.6a4 4 0 0 1 7.7-1.6"/>',
  trash:
    '<path d="M4 6.5h16"/><path d="M9.5 6.5V4.9a1.4 1.4 0 0 1 1.4-1.4h2.2a1.4 1.4 0 0 1 1.4 1.4v1.6"/>' +
    '<path d="m6.6 6.5.9 13.1a1.5 1.5 0 0 0 1.5 1.4h6a1.5 1.5 0 0 0 1.5-1.4l.9-13.1"/>' +
    '<path d="M10.5 10.5v6M13.5 10.5v6" opacity=".45"/>',
  infinity:
    '<path d="M8.6 9a3 3 0 1 0 0 6c2.3 0 3.1-6 5.4-6a3 3 0 1 1 0 6c-2.3 0-3.1-6-5.4-6z"/>',
} as const;

export type XsIconName = keyof typeof XS_PATHS;

const SVG_OPEN =
  '<svg class="xs-i" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
  'stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';

/** Icon as an HTML string, for the layer rows studio.ts builds with innerHTML. */
export function iconHtml(name: XsIconName): string {
  return SVG_OPEN + XS_PATHS[name] + '</svg>';
}
