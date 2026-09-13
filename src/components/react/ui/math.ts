// What an equation IS on this site.
//
// One shape, so that every equation anywhere renders through the same path
// and cannot quietly become a string of Unicode subscripts in one tool while
// it is typeset in the next. `Equation.tsx` renders it; this file only says
// what it is, and imports nothing — so a catalog like `lea/charts.ts`, which
// is exercised by tests that never load React, can carry equations too.
//
// The `plain` twin is not a nicety. KaTeX is a deferred CDN script, so on a
// cold or blocked load it is the only form there is; it is also the
// accessible name, which is what a screen reader says. An equation whose
// plain twin is missing or wrong is an equation that some readers only ever
// meet in its broken state.

export interface EqItem {
  /** Optional label shown beside the math ("On the axis", "Applies as"). */
  name?: string;
  /**
   * TeX source, no delimiters.
   *
   * In a TypeScript string literal EVERY backslash must be doubled, or
   * `\frac` is a form feed and `\sigma` is the letters "sigma". Nothing at
   * runtime catches that — KaTeX with `throwOnError: false` renders the
   * wreckage in red and returns normally — so `math.test.mjs` reads the
   * source and asserts every run of backslashes inside a `tex:` literal is
   * even. Nine equations shipped broken before that test existed.
   */
  tex: string;
  /** The fallback, the SSR form, and the accessible name. No TeX markup. */
  plain: string;
  /** A citation or condition, set beside the math rather than inside it. */
  note?: string;
}

/**
 * Does this string look like TeX that escaped into prose?
 *
 * The failure this catches is specific and has shipped: a variable written
 * `A_c` or `p_a` in a definition list under an equation that WAS typeset, so
 * the reader sees a clean fraction and then, immediately beneath it, an
 * underscore. Either typeset it or spell it; do not leave the source showing.
 */
export function looksLikeRawTex(s: string): boolean {
  return /\\[a-zA-Z]+|[_^]\{|(?:^|[\s(])[A-Za-z][_^][A-Za-z0-9](?:$|[\s,.;:)])/.test(s);
}
