// Equation — typeset math inside a client island.
//
// The site already loads KaTeX on every page (BaseLayout), but its
// auto-renderer runs once at DOMContentLoaded over elements that exist then,
// and a `client:only` island does not exist then. It also scans for `$...$`
// delimiters in text the island owns, which React would happily overwrite on
// the next render.
//
// So this calls `katex.render` directly on a span that React is given no
// children for — React never touches its contents, and the effect re-renders
// it whenever the source changes. That is the standard KaTeX-in-React shape
// and it is idempotent: the same tex written twice produces the same DOM.
//
// The library is a deferred CDN script, so it may not be there on the first
// paint. The component polls briefly and, if it never arrives, leaves the
// plain-text fallback in place rather than an empty box — an equation a
// student cannot read is worse than an ugly one.
import { useEffect, useRef, useState } from 'react';

interface EquationProps {
  /** TeX source, with no delimiters. */
  tex: string;
  /** Plain-text form: the SSR and no-KaTeX fallback, and the accessible name. */
  plain: string;
  /** Centered on its own line rather than inline. */
  display?: boolean;
}

/** Poll rather than assume: the script is `defer`, and this island is not. */
function useKatex(): boolean {
  const [ready, setReady] = useState(
    () => typeof window !== 'undefined' && typeof (window as any).katex?.render === 'function'
  );
  useEffect(() => {
    if (ready) return;
    let tries = 0;
    const id = setInterval(() => {
      if (typeof (window as any).katex?.render === 'function') {
        clearInterval(id);
        setReady(true);
      } else if (++tries > 100) {
        clearInterval(id);     // ~10 s; the fallback stands
      }
    }, 100);
    return () => clearInterval(id);
  }, [ready]);
  return ready;
}

export default function Equation({ tex, plain, display = false }: EquationProps) {
  const host = useRef<HTMLSpanElement>(null);
  const ready = useKatex();
  const [typeset, setTypeset] = useState(false);

  useEffect(() => {
    if (!ready || !host.current) return;
    try {
      (window as any).katex.render(tex, host.current, {
        displayMode: display,
        throwOnError: false,
        output: 'htmlAndMathml',
      });
      // `throwOnError: false` does NOT throw — it renders the source in red
      // and returns normally, so the only way to know the source was bad is
      // to look for what it left behind. Without this check a malformed
      // equation reports success and the fallback never appears.
      setTypeset(!host.current.querySelector('.katex-error'));
    } catch {
      setTypeset(false);       // malformed source — keep the plain form
    }
  }, [ready, tex, display]);

  return (
    <span
      className={`cee-math${display ? ' cee-math--block' : ''}`}
      role="math"
      aria-label={plain}
    >
      {/* No children in JSX: this is the element katex.render owns. */}
      <span ref={host} aria-hidden="true" />
      {!typeset && <code className="cee-math__plain">{plain}</code>}
    </span>
  );
}
