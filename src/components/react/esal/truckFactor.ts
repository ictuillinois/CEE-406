// Truck factor from a W-4 loadometer table — Huang (2004) §6.4.
//
// A W-4 table reports how many axles of each load group were *weighed*, but
// the station counts far more axles than it weighs. The weighed distribution
// is therefore scaled up to the counted total before the equivalency factors
// are applied, and the result is divided by the number of vehicles counted:
//
//   TF = Σ (scaled axles in group × EALF of that group) / vehicles counted
//
// Supports HW5 (Huang Problems 6-7 and 6-9).

export type AxleType = 'single' | 'tandem' | 'tridem';

export interface LoadGroup {
  /** Representative axle load for the group, kip — usually the midpoint. */
  load: number;
  type: AxleType;
  /** Number of axles of this group actually weighed. */
  weighed: number;
}

export interface W4Totals {
  /** Axles counted at the station, by type. */
  counted: Partial<Record<AxleType, number>>;
  /** Axles weighed, by type. Defaults to the sum of the groups. */
  weighed?: Partial<Record<AxleType, number>>;
  /** Vehicles counted — the denominator of the truck factor. */
  vehicles: number;
}

export interface GroupResult extends LoadGroup {
  scale: number;
  scaled: number;
  ealf: number;
  esal: number;
}

/**
 * Scale factor for one axle type: how many axles were counted for each one
 * weighed. A type with no counted total is left unscaled (factor 1).
 */
export function scaleFactors(groups: LoadGroup[], totals: W4Totals): Record<AxleType, number> {
  const out = { single: 1, tandem: 1, tridem: 1 } as Record<AxleType, number>;
  for (const t of ['single', 'tandem', 'tridem'] as AxleType[]) {
    const weighed = totals.weighed?.[t] ??
      groups.filter(g => g.type === t).reduce((s, g) => s + g.weighed, 0);
    const counted = totals.counted[t];
    if (counted && weighed > 0) out[t] = counted / weighed;
  }
  return out;
}

/**
 * Reduce a W-4 table to a truck factor.
 *
 * @param groups  the load groups with the number of axles weighed in each
 * @param totals  counted axles by type and the number of vehicles counted
 * @param ealfOf  equivalency factor for a load and axle type — pass the
 *                flexible or rigid EALF depending on the pavement
 */
export function truckFactor(
  groups: LoadGroup[],
  totals: W4Totals,
  ealfOf: (load: number, type: AxleType) => number
): { rows: GroupResult[]; totalEsal: number; factor: number; scales: Record<AxleType, number> } {
  const scales = scaleFactors(groups, totals);
  const rows: GroupResult[] = groups.map(g => {
    const scale = scales[g.type];
    const scaled = g.weighed * scale;
    const ealf = ealfOf(g.load, g.type);
    return { ...g, scale, scaled, ealf, esal: scaled * ealf };
  });
  const totalEsal = rows.reduce((s, r) => s + r.esal, 0);
  return {
    rows,
    totalEsal,
    factor: totals.vehicles > 0 ? totalEsal / totals.vehicles : NaN,
    scales,
  };
}

/**
 * Design-lane ESALs in the first year from a truck factor.
 *
 * @param trucks  trucks per day, both directions, all lanes
 * @param D       directional distribution factor
 * @param L       lane distribution factor
 */
export const firstYearEsal = (trucks: number, tf: number, D: number, L: number) =>
  trucks * tf * D * L * 365;
