// ════════════════════════════════════════════════════════════════════════════
// THE RELEASE GATE — one file, edited once a week.
// ════════════════════════════════════════════════════════════════════════════
//
// The repository is PUBLIC. Everything this file does not release is invisible
// on the website: no card, no link, and no route. Unlocking is a one-line edit
// here, plus (for tools only) one file rename — see TOOLS below.
//
// Three separate concerns, deliberately not merged:
//
//   1. HOMEWORKS   — sequencing. Released week by week as the class reaches
//                    them. Locked homeworks render as a grayed card and their
//                    page is not generated at all.
//
//   2. TOOLS       — sequencing. Same idea, but a tool's page is a real file
//                    under src/pages/tools/, so hiding the card is not enough
//                    to remove the URL. See the rename rule below.
//
//   3. TEXTBOOK    — NOT sequencing. COPYRIGHT. Huang's "Pavement Analysis and
//                    Design" is not ours to distribute, and this is a public
//                    repo. The chapter PDFs have been removed from the site and
//                    from git entirely; the chapter pages now cite the book and
//                    send students to the University Library. This is not a
//                    switch to be flipped later — see TEXTBOOK_PDFS below.
//
// The instructor's originals are untouched: Chapters/ and "Homeworks Fall
// 2024/" at the repo root are gitignored Box archives and still hold every
// file. Nothing here deletes anything the course owns.

/* ── 1. Homeworks ─────────────────────────────────────────────────────────
   Add an id to release it. `week` is optional: give it a number and the
   locked card reads "Releases week 4"; leave it out and it reads
   "Coming soon". The Fall-2024 `due` dates in homeworks.ts are a stale
   reference schedule, so no week is assumed here — fill them in as the
   real semester calendar is set.                                          */

export const RELEASED_HOMEWORKS: Record<string, true> = {
  // none yet — unlock week by week, e.g.  hw1: true,
};

/** Planned release week per homework, for the locked label. Optional. */
export const HOMEWORK_WEEK: Record<string, number> = {
  // e.g.  hw1: 2,
};

/* ── 2. Tools ─────────────────────────────────────────────────────────────
   Releasing a tool takes TWO steps, because a tool page is a file:

     a) add its slug here, and
     b) rename  src/pages/tools/<slug>/_index.astro
            ->  src/pages/tools/<slug>/index.astro

   Astro does not route files whose name starts with `_`, so the underscore
   is what actually removes the URL. Step (a) alone would leave the page
   reachable by anyone who guesses it; step (b) alone would leave a live page
   nothing links to. `release.test.mjs` asserts the two agree, so a half-done
   unlock fails the build rather than shipping.                             */

export const RELEASED_TOOLS: Record<string, true> = {
  gear3d: true,
  'cross-section-studio': true,
  'contact-stress': true,
};

/** Planned release week per tool, for the locked label. Optional. */
export const TOOL_WEEK: Record<string, number> = {
  // e.g.  'stress-explorer': 5,
};

/* ── 3. Textbook ──────────────────────────────────────────────────────────
   Read this before changing it.

   Huang, Y. H. (2004). Pavement Analysis and Design (2nd ed.) is a
   copyrighted commercial textbook. Hosting its chapters on a public site —
   or in a public repository — distributes it without authorization,
   regardless of whether anything links to the files.

   The 20 chapter and appendix PDFs have been removed from public/ and purged
   from git history. The chapter pages remain, because a reading list is
   useful and a table of contents is not the book: each one now carries the
   citation, the course's own summary of what that chapter covers, and a link
   to the University Library record where a student can borrow it.

   Setting this to true does nothing on its own — the files are gone. It
   exists so that the intent is recorded in code rather than in someone's
   memory: if a future maintainer obtains permission from the publisher, this
   is where that decision gets written down, next to the reason it was made. */

export const TEXTBOOK_PDFS_PUBLISHED = false as const;

/** Where students actually get the book: the UIUC Library catalog record. */
export const TEXTBOOK_LIBRARY_URL =
  'https://i-share-uiu.primo.exlibrisgroup.com/nde/fulldisplay?query=Pavement%20Analysis%20and%20Design&tab=Everything&search_scope=MyInst_and_CI&vid=01CARLI_UIU:CARLI_UIU_NDE&lang=en&docid=alma99598836912205899&adaptor=Local%20Search%20Engine&context=L&isFrbr=false&isHighlightedRecord=false&state=';

export const TEXTBOOK_CITATION =
  'Huang, Y. H. (2004). Pavement Analysis and Design (2nd ed.). Pearson/Prentice Hall.';

/* ── Helpers ──────────────────────────────────────────────────────────────
   Every surface goes through these rather than reading the maps directly, so
   there is one definition of "released" to audit.                          */

export interface LockState {
  released: boolean;
  /** Label for a locked item: "Releases week 4", or "Coming soon". */
  label: string;
}

const lockLabel = (week?: number) =>
  typeof week === 'number' ? `Releases week ${week}` : 'Coming soon';

export function homeworkLock(id: string): LockState {
  const released = RELEASED_HOMEWORKS[id] === true;
  return { released, label: released ? '' : lockLabel(HOMEWORK_WEEK[id]) };
}

export function toolLock(slug: string): LockState {
  const released = RELEASED_TOOLS[slug] === true;
  return { released, label: released ? '' : lockLabel(TOOL_WEEK[slug]) };
}

export const isHomeworkReleased = (id: string) => RELEASED_HOMEWORKS[id] === true;
export const isToolReleased = (slug: string) => RELEASED_TOOLS[slug] === true;

/** Counts for the copy on the landing page, so it can never overstate. */
export const releasedToolCount = () => Object.keys(RELEASED_TOOLS).length;
export const releasedHomeworkCount = () => Object.keys(RELEASED_HOMEWORKS).length;
