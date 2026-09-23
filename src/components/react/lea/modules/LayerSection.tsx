import { fmt } from '../../chartTheme';

export default function LayerSection({ moduli, thicknesses, q, a }: {
  moduli: number[]; thicknesses: number[]; q: number; a: number;
}) {
  return <div className="cee-card cee-card__body">
    <h3 className="cee-card__title">Loaded section · inches and psi</h3>
    <svg viewBox="0 0 600 240" role="img" aria-label={`${moduli.length} bonded layers under circular pressure ${q} psi with radius ${a} inches`} style={{ width: '100%', maxHeight: 260 }}>
      <text x="300" y="18" textAnchor="middle" fill="currentColor" fontSize="13">q = {fmt(q, 2)} psi · a = {fmt(a, 2)} in</text>
      {[220, 260, 300, 340, 380].map(x => <path key={x} d={`M${x} 27v27m-4-5 4 5 4-5`} fill="none" stroke="currentColor" />)}
      {moduli.map((E, i) => <g key={i}>
        <rect x="40" y={58 + i * 52} width="520" height="52" fill={['#E87722', '#4f86a6', '#81916b'][i]} fillOpacity="0.15" stroke="currentColor" strokeOpacity="0.35" />
        <text x="56" y={89 + i * 52} fill="currentColor" fontSize="13">Layer {i + 1}: E = {fmt(E, 0)} psi · ν = 0.5</text>
        <text x="544" y={89 + i * 52} textAnchor="end" fill="currentColor" fontSize="13">{i < thicknesses.length ? `h = ${fmt(thicknesses[i], 2)} in` : 'Half-space ↓'}</text>
      </g>)}
      <text x="300" y="234" textAnchor="middle" fill="currentColor" fontSize="12">Schematic, not to scale · fully bonded interfaces</text>
    </svg>
  </div>;
}
