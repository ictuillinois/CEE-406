/** Explicit links take precedence over the student's remembered module. */
export function requestedModule(search: string): string | null {
  return new URLSearchParams(search).get('module');
}

export function chartHref(figure: string): string {
  return `?module=charts&figure=${encodeURIComponent(figure)}`;
}
