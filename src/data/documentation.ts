export const faarfieldDownload = 'https://www.airporttech.tc.faa.gov/Products/Airport-Safety-Papers-Publications/Airport-Safety-Detail/ArtMID/3682/ArticleID/2841/FAARFIELD-20';

export function documentationModules(base: string) {
  return [
    { id: 'index', label: 'Documentation', icon: 'text:D', href: `${base}documentation/` },
    { id: 'faarfield', label: 'FAARFIELD', icon: 'text:F', href: `${base}documentation/faarfield/` },
    { id: 'winjulea', label: 'WinJULEA', icon: 'text:W', href: `${base}documentation/winjulea/` },
    { id: 'drip', label: 'DRIP', icon: 'text:D', href: `${base}documentation/drip/` },
    { id: 'pavement-me', label: 'Pavement ME Design', icon: 'text:ME', href: `${base}documentation/pavement-me/` },
  ];
}
