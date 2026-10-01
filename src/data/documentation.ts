export const faarfieldDownload = 'https://www.airporttech.tc.faa.gov/Products/Airport-Safety-Papers-Publications/Airport-Safety-Detail/ArtMID/3682/ArticleID/2841/FAARFIELD-20';

export function documentationModules(base: string) {
  return [
    { id: 'index', label: 'Documentation', icon: 'M4 4h6l2 2 2-2h6v15h-6l-2 2-2-2H4V4Zm8 2v15', href: `${base}documentation/` },
    { id: 'faarfield', label: 'FAARFIELD', icon: `image:${base}documentation/branding/faarfield-icon.png`, href: `${base}documentation/faarfield/` },
    { id: 'winjulea', label: 'WinJULEA', icon: `image:${base}documentation/branding/winjulea-icon.png`, href: `${base}documentation/winjulea/` },
    { id: 'drip', label: 'DRIP', icon: `image:${base}documentation/branding/drip-icon.png`, href: `${base}documentation/drip/` },
    { id: 'pavement-me', label: 'Pavement ME Design', icon: `image:${base}documentation/branding/pavement-me-icon.png`, href: `${base}documentation/pavement-me/` },
  ];
}
