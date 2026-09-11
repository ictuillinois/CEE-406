// Determinate progress for a computation that takes real time.
//
// docs/loaders.md §7.6 is the specification and this is the first thing in
// the repo to need it: a determinate bar in the brand hue on the ghost
// track, a stage label that is not optional, a counter wherever the work is
// enumerable, elapsed time past ten seconds and a cancel past fifteen.
//
// The three rules that are load-bearing rather than decorative:
//
//   · Nothing appears under the entry delay. A bar that flashes on a chart
//     that took 200 ms reads as a glitch, so the caller passes `elapsed` and
//     this renders nothing until it clears ENTRY_DELAY.
//   · The bar is determinate or it is not shown. §7.6: never fake a bar you
//     cannot honor. The caller counts in a unit the work actually arrives
//     in — here, curves of the figure — so the fraction is real.
//   · One announcement per activity. The stage line is visible copy, so the
//     bar carries the ARIA and the text is left alone rather than both of
//     them talking.
import { useId } from 'react';

/** docs/loaders.md §2.4 — under this, show nothing at all. */
const ENTRY_DELAY = 300;
/** Past this the wait is long enough that a clock is reassurance, not noise. */
const SHOW_ELAPSED = 10_000;
/** And past this the reader should be able to stop it. */
const SHOW_CANCEL = 15_000;

export interface ProgressStripProps {
  /** Fraction complete, 0 to 1. */
  value: number;
  /** What is being computed. Mandatory — a bare bar cannot say it has stalled. */
  stage: string;
  /** The enumerable unit, when there is one: "8 of 16 curves". */
  count?: { done: number; total: number; unit: string };
  /** Milliseconds since the work started. Drives the entry delay and the clock. */
  elapsed: number;
  /** Offered once the wait passes fifteen seconds. */
  onCancel?: () => void;
}

const clock = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

export default function ProgressStrip({
  value, stage, count, elapsed, onCancel,
}: ProgressStripProps) {
  const labelId = useId();
  if (elapsed < ENTRY_DELAY) return null;

  const pct = Math.max(0, Math.min(1, value));
  const detail = [
    count ? `${count.done} of ${count.total} ${count.unit}` : null,
    elapsed >= SHOW_ELAPSED ? clock(elapsed) : null,
  ].filter(Boolean).join(' · ');

  return (
    <div className="cee-progress cee-animate-in">
      <div className="cee-progress__line">
        <span className="cee-progress__stage" id={labelId}>{stage}</span>
        {detail && <span className="cee-progress__detail">{detail}</span>}
        {onCancel && elapsed >= SHOW_CANCEL && (
          <button type="button" className="cee-btn cee-btn--ghost cee-btn--sm"
            onClick={onCancel}>
            Stop
          </button>
        )}
      </div>
      <div
        className="cee-progress__track"
        role="progressbar"
        aria-labelledby={labelId}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct * 100)}
      >
        <div className="cee-progress__fill" style={{ inlineSize: `${(pct * 100).toFixed(1)}%` }} />
      </div>
    </div>
  );
}
