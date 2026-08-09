// Card — docs/chart-standards.md §A6.1.
// radius 16 · surface · 1px hairline · 20-24px padding
// header: title (17/600) [+ subtitle (13, secondary)] ...... affordance
import type { ReactNode } from 'react';

interface CardProps {
  title?: string;
  /** Sub-caption under the title. Per §A2.3 this carries the encoding
   *  explanation that the stripped chart chrome no longer provides — for a
   *  chart card, write it. */
  subtitle?: ReactNode;
  /** Right-side affordance: a stat chip, select pill, or text link. */
  affordance?: ReactNode;
  /** Hairline under the header — use when the body is a metric strip. */
  divided?: boolean;
  /** Sunken nested-card variant (§A6.2 alternative). */
  sunken?: boolean;
  className?: string;
  children: ReactNode;
}

export default function Card({
  title,
  subtitle,
  affordance,
  divided = false,
  sunken = false,
  className = '',
  children,
}: CardProps) {
  const cls = [
    'cee-card',
    sunken ? 'cee-card--sunken' : '',
    divided ? 'cee-card--divided' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <section className={cls}>
      {(title || affordance) && (
        <header className="cee-card__head">
          <div className="cee-card__heading">
            {title && <h3 className="cee-card__title">{title}</h3>}
            {subtitle && <p className="cee-card__subtitle">{subtitle}</p>}
          </div>
          {affordance && <div className="cee-card__affordance">{affordance}</div>}
        </header>
      )}
      <div className="cee-card__body">{children}</div>
    </section>
  );
}
