// Small info tooltip used in tool input labels: hover/focus a ⓘ dot to see help.
interface TipProps {
  text: string;
}

export default function Tip({ text }: TipProps) {
  return (
    <span className="cee-tip" tabIndex={0} role="note" aria-label={text}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
      <span className="cee-tip__pop">{text}</span>
    </span>
  );
}
