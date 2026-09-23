import type { ReactNode } from 'react';
import { chartHref } from '../navigation';

export default function ChartLink({ figure, children }: { figure: string; children?: ReactNode }) {
  return <a href={chartHref(figure)} target="_blank" rel="noopener noreferrer"
    title="Open in Solutions by Chart (new tab)">
    {children ?? `Figure ${figure.replace('fig-', '').replaceAll('-', '.')}`} ↗
  </a>;
}
