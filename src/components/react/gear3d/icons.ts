/* Icon set for Gear3D.
 *
 * The upstream E-Lab (johanncardenas.com/e-labs/gear3d) draws its chrome with
 * Font Awesome. This site does not load Font Awesome — it draws its own strokes
 * in Icon.astro — so every glyph the app uses is redrawn here on the same
 * 24-unit grid at the same 1.75 weight with round caps and joins, exactly as
 * crosssection/icons.ts does. Where a glyph already exists there it is repeated
 * rather than redrawn, so the two ported studios read as one hand.
 *
 * Two consumers, one source of truth: `Icon` for the JSX chrome, and
 * `iconHtml()` for the panels gear3d.js builds as HTML strings.
 *
 * Keys are the Font Awesome names the upstream markup used. Keeping them
 * means a glyph can be traced straight back to the line it replaced.
 */

export const G3_PATHS = {
  /* ── Toolbar ─────────────────────────────────────────────────────────── */
  'undo': '<path d="M4 9h11a5 5 0 0 1 0 10H9"/><path d="M8 5 4 9l4 4"/>',
  'redo': '<path d="M20 9H9a5 5 0 0 0 0 10h6"/><path d="m16 5 4 4-4 4"/>',
  'rotate-left': '<path d="M3.5 12a8.5 8.5 0 1 0 2.7-6.2L3 8.7"/><path d="M3 3.6v5.4h5.4"/>',
  'folder-open':
    '<path d="M3 9V6.5A1.5 1.5 0 0 1 4.5 5h4l2 2.5h6A1.5 1.5 0 0 1 18 9v1"/>' +
    '<path d="M3.4 10h17.2l-2.1 8.4a1.5 1.5 0 0 1-1.45 1.1H5.35a1.5 1.5 0 0 1-1.45-1.1z"/>',
  'save':
    '<path d="M5.5 3.5h10L20 8v12a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 20V5a1.5 1.5 0 0 1 1.5-1.5z"/>' +
    '<path d="M8 3.5V9h7"/><rect x="8" y="14" width="8" height="7.5" rx="1"/>',
  'camera':
    '<path d="M3 9A1.5 1.5 0 0 1 4.5 7.5h2.6l1.4-2.3h7l1.4 2.3h2.6A1.5 1.5 0 0 1 21 9v8.8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.8z"/>' +
    '<circle cx="12" cy="13.2" r="3.5"/>',
  'expand': '<path d="M9 3.5H3.5V9M15 3.5h5.5V9M9 20.5H3.5V15M15 20.5h5.5V15"/>',
  'arrow-left': '<path d="M20 12H4"/><path d="m10 6-6 6 6 6"/>',

  /* The four-pane composite view, and the catalogue sheet: the same nine-up
     grid at two densities, which is the distinction FA drew with th / th-large. */
  'th':
    '<rect x="3.5" y="3.5" width="5" height="5" rx="1"/><rect x="9.5" y="3.5" width="5" height="5" rx="1"/><rect x="15.5" y="3.5" width="5" height="5" rx="1"/>' +
    '<rect x="3.5" y="9.5" width="5" height="5" rx="1"/><rect x="9.5" y="9.5" width="5" height="5" rx="1"/><rect x="15.5" y="9.5" width="5" height="5" rx="1"/>' +
    '<rect x="3.5" y="15.5" width="5" height="5" rx="1"/><rect x="9.5" y="15.5" width="5" height="5" rx="1"/><rect x="15.5" y="15.5" width="5" height="5" rx="1"/>',
  'th-large':
    '<rect x="3.5" y="3.5" width="7.6" height="7.6" rx="1.4"/><rect x="12.9" y="3.5" width="7.6" height="7.6" rx="1.4"/>' +
    '<rect x="3.5" y="12.9" width="7.6" height="7.6" rx="1.4"/><rect x="12.9" y="12.9" width="7.6" height="7.6" rx="1.4"/>',
  'border-all':
    '<rect x="3.5" y="3.5" width="17" height="17" rx="1.6"/><path d="M12 3.5v17M3.5 12h17" opacity=".55"/>',

  /* ── Panel headings ──────────────────────────────────────────────────── */
  'layer-group':
    '<path d="M12 3.2 21 7.6l-9 4.4-9-4.4z"/>' +
    '<path d="m3 12 9 4.4 9-4.4" opacity=".65"/>' +
    '<path d="m3 16.4 9 4.4 9-4.4" opacity=".4"/>',
  'crosshairs':
    '<circle cx="12" cy="12" r="6.2"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/>' +
    '<path d="M12 2.4v3.2M12 18.4v3.2M2.4 12h3.2M18.4 12h3.2"/>',
  'sliders-h':
    '<path d="M3.5 7.5h11M18 7.5h2.5M3.5 16.5h4M11 16.5h9.5"/>' +
    '<circle cx="16.2" cy="7.5" r="2.3"/><circle cx="9.2" cy="16.5" r="2.3"/>',
  /* Dimension: an extension line closed by a witness tick at each end, which is
     the app's own signature mark — the datum tick the panels and the figure share. */
  'ruler-combined':
    '<path d="M4 20V4M4 20h16"/>' +
    '<path d="M4 8h3M4 12h4.5M4 16h3M8 20v-3M12 20v-4.5M16 20v-3" opacity=".65"/>' +
    '<path d="M20 4 8.5 15.5" opacity=".35"/>',
  'ruler':
    '<rect x="1.9" y="8.4" width="20.2" height="7.2" rx="1.4" transform="rotate(-45 12 12)"/>' +
    '<path d="M8.4 8.1 10 9.7M11.2 5.3l2.4 2.4M14 2.5l1.6 1.6" opacity=".7"/>',
  'shoe-prints':
    '<path d="M4.4 4.2c2 0 3 1.2 3 3.1 0 1.6-.5 2.5-.5 3.9 0 .9.4 1.6.4 2.4 0 1.1-.9 1.7-2.5 1.7s-2.5-.6-2.5-1.7c0-.8.4-1.5.4-2.4 0-1.4-.5-2.3-.5-3.9 0-1.9 1-3.1 2.2-3.1z"/>' +
    '<path d="M18.1 8.7c1.9 0 2.9 1.2 2.9 3.1 0 1.6-.5 2.5-.5 3.9 0 .9.4 1.6.4 2.4 0 1.1-.9 1.7-2.5 1.7s-2.5-.6-2.5-1.7c0-.8.4-1.5.4-2.4 0-1.4-.5-2.3-.5-3.9 0-1.9 1-3.1 2.3-3.1z" opacity=".6"/>',
  'video': '<rect x="3" y="6" width="12" height="12" rx="2"/><path d="M15 10.4 21 7v10l-6-3.4z"/>',
  'desktop':
    '<rect x="2.8" y="4" width="18.4" height="12" rx="1.8"/><path d="M9 20h6M12 16v4"/>',
  'lightbulb':
    '<path d="M9 17.2a6 6 0 1 1 6 0v1.3a1.5 1.5 0 0 1-1.5 1.5h-3A1.5 1.5 0 0 1 9 18.5z"/>' +
    '<path d="M9.6 17.2h4.8" opacity=".6"/>',
  'swatchbook':
    '<rect x="3" y="3" width="5.4" height="18" rx="1.6"/>' +
    '<path d="M10.4 6.6 15 3.6a1.6 1.6 0 0 1 2.2.5l3.2 5" opacity=".75"/>' +
    '<path d="M10.4 12.4 21 12.9V19a1.6 1.6 0 0 1-1.6 1.6h-9" opacity=".5"/>' +
    '<circle cx="5.7" cy="17.4" r="1.1" fill="currentColor" stroke="none"/>',
  'fill-drip':
    '<path d="M12 3.2 5.4 9.8a2.2 2.2 0 0 0 0 3.1l4.3 4.3a2.2 2.2 0 0 0 3.1 0l6.6-6.6z"/>' +
    '<path d="M8.8 6.4 6.2 3.8" opacity=".6"/>' +
    '<path d="M20.5 15.4c1 1.4 1.5 2.4 1.5 3.1a1.5 1.5 0 0 1-3 0c0-.7.5-1.7 1.5-3.1z" fill="currentColor" stroke="none" opacity=".8"/>',
  'file-export':
    '<path d="M13.5 3.2H7A1.8 1.8 0 0 0 5.2 5v14A1.8 1.8 0 0 0 7 20.8h10a1.8 1.8 0 0 0 1.8-1.8v-8.5z"/>' +
    '<path d="M13.5 3.2v6.3h5.3" opacity=".65"/>' +
    '<path d="M9 15h6M13 13l2 2-2 2"/>',
  'file-signature':
    '<path d="M13.5 3.2H7A1.8 1.8 0 0 0 5.2 5v14A1.8 1.8 0 0 0 7 20.8h10a1.8 1.8 0 0 0 1.8-1.8v-8.5z"/>' +
    '<path d="M13.5 3.2v6.3h5.3" opacity=".65"/>' +
    '<path d="M8.4 17.2c1.2 0 1.2-3 2.4-3s1.2 3 2.4 3 1.2-1.6 2.4-1.6"/>',
  'file-code':
    '<path d="M13.5 3.2H7A1.8 1.8 0 0 0 5.2 5v14A1.8 1.8 0 0 0 7 20.8h10a1.8 1.8 0 0 0 1.8-1.8v-8.5z"/>' +
    '<path d="M13.5 3.2v6.3h5.3" opacity=".65"/>' +
    '<path d="m10.4 13.6-1.8 1.9 1.8 1.9M13.6 13.6l1.8 1.9-1.8 1.9"/>',
  'file-csv':
    '<path d="M13.5 3.2H7A1.8 1.8 0 0 0 5.2 5v14A1.8 1.8 0 0 0 7 20.8h10a1.8 1.8 0 0 0 1.8-1.8v-8.5z"/>' +
    '<path d="M13.5 3.2v6.3h5.3" opacity=".65"/>' +
    '<path d="M8.6 13.4v4.2M11.4 13.4v4.2M14.2 13.4v4.2" opacity=".55"/>' +
    '<path d="M7.4 15.5h9.2" opacity=".55"/>',
  'sitemap':
    '<rect x="9.4" y="2.8" width="5.2" height="4" rx="1"/>' +
    '<rect x="2.6" y="17.2" width="5.2" height="4" rx="1"/>' +
    '<rect x="9.4" y="17.2" width="5.2" height="4" rx="1"/>' +
    '<rect x="16.2" y="17.2" width="5.2" height="4" rx="1"/>' +
    '<path d="M12 6.8v3.4M5.2 17.2v-3.5h13.6v3.5M12 13.7v3.5" opacity=".7"/>',
  'font':
    '<path d="M5.4 20 11 4h2l5.6 16"/><path d="M7.9 14.4h8.2" opacity=".7"/>',

  /* ── Inline and button glyphs ───────────────────────────────────────── */
  'check': '<path d="m4.5 12.6 4.8 4.8L19.5 7.2"/>',
  'times': '<path d="M6 6l12 12M18 6 6 18"/>',
  'download': '<path d="M12 3.6v11.2"/><path d="m7.6 10.6 4.4 4.4 4.4-4.4"/><path d="M4.5 19.4h15"/>',
  'trash':
    '<path d="M4.5 6.6h15"/><path d="M9.2 6.6V4.9a1.4 1.4 0 0 1 1.4-1.4h2.8a1.4 1.4 0 0 1 1.4 1.4v1.7"/>' +
    '<path d="M6.4 6.6 7.3 19a1.5 1.5 0 0 0 1.5 1.4h6.4a1.5 1.5 0 0 0 1.5-1.4l.9-12.4"/>' +
    '<path d="M10.5 10.4v6M13.5 10.4v6" opacity=".45"/>',
  'eraser':
    '<path d="M8.6 20.4H20.5"/>' +
    '<path d="m13.4 3.9 6.2 6.2a1.6 1.6 0 0 1 0 2.3l-7 7a1.6 1.6 0 0 1-2.3 0l-6.2-6.2a1.6 1.6 0 0 1 0-2.3l7-7a1.6 1.6 0 0 1 2.3 0z"/>' +
    '<path d="m8.4 8.9 6.7 6.7" opacity=".5"/>',
  'broom':
    '<path d="m20.4 3.6-8.2 8.2"/>' +
    '<path d="M11.6 10.2 5.4 16.4c-1.4 1.4-1.2 2.4-.2 3.4s2 1.2 3.4-.2l6.2-6.2z"/>' +
    '<path d="m7.2 14.6 2.2 2.2M9.6 12.2l2.2 2.2" opacity=".5"/>',
  'pen':
    '<path d="M16.6 3.9a2 2 0 0 1 2.8 0l.7.7a2 2 0 0 1 0 2.8L8.4 19.1l-4.4 1.4 1.4-4.4z"/>' +
    '<path d="m15.2 5.3 3.5 3.5" opacity=".55"/>',
  'cube':
    '<path d="M12 2.9 20.6 7v10L12 21.1 3.4 17V7z"/>' +
    '<path d="M3.4 7 12 11.1 20.6 7M12 11.1v10" opacity=".6"/>',
  'cubes':
    '<path d="M12 2.6 17.6 5.3v5.4L12 13.4 6.4 10.7V5.3z"/>' +
    '<path d="M6.4 5.3 12 8l5.6-2.7M12 8v5.4" opacity=".6"/>' +
    '<path d="M6 12.4 10.6 14.6v4.5L6 21.3l-4.6-2.2v-4.5z" opacity=".45"/>' +
    '<path d="M18 12.4l4.6 2.2v4.5L18 21.3l-4.6-2.2v-4.5z" opacity=".45"/>',
  'plane':
    '<path d="M12 2.8c.9 0 1.6 1.1 1.6 2.6v3.3l7.3 4.3v2.1l-7.3-2.2v3.9l2.4 1.8v1.6L12 19.4l-4 .8v-1.6l2.4-1.8v-3.9L3.1 15.1V13l7.3-4.3V5.4c0-1.5.7-2.6 1.6-2.6z"/>',
  /* The instrument the app is named after in spirit: dividers set to a span. */
  'drafting-compass':
    '<circle cx="12" cy="4.6" r="1.8"/>' +
    '<path d="M10.9 6.4 5.2 19.6M13.1 6.4l5.7 13.2"/>' +
    '<path d="M8.1 13.2a7.6 7.6 0 0 0 7.8 0" opacity=".55"/>' +
    '<path d="m4.4 19.4 1.6 1.6M19.6 19.4 18 21" opacity=".7"/>',
  'exclamation-triangle':
    '<path d="M10.6 3.9a1.6 1.6 0 0 1 2.8 0l7.4 13.3a1.6 1.6 0 0 1-1.4 2.4H4.6a1.6 1.6 0 0 1-1.4-2.4z"/>' +
    '<path d="M12 9v4.2"/><circle cx="12" cy="16.4" r="1" fill="currentColor" stroke="none"/>',
  'info-circle':
    '<circle cx="12" cy="12" r="8.6"/><path d="M12 11.4v5"/>' +
    '<circle cx="12" cy="8" r="1" fill="currentColor" stroke="none"/>',
} as const;

export type G3IconName = keyof typeof G3_PATHS;

const SVG_OPEN =
  '<svg class="g3-i" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
  'stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';

/** Icon as an HTML string, for the panels gear3d.js builds with innerHTML. */
export function iconHtml(name: G3IconName): string {
  return SVG_OPEN + G3_PATHS[name] + '</svg>';
}
