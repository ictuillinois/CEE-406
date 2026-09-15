export interface EditRow {
  id: number;
  values: string[];
  included: boolean;
}
export const numberOrNaN = (s: string) => (s.trim() === "" ? NaN : Number(s));
export const makeRows = (data: readonly (readonly number[])[]): EditRow[] =>
  data.map((r, i) => ({ id: i + 1, values: r.map(String), included: true }));
export const fmt = (v: number | null | undefined, digits = 4) =>
  v == null || !Number.isFinite(v)
    ? "—"
    : Number(v.toPrecision(digits)).toLocaleString("en-US", {
        maximumSignificantDigits: digits,
      });
export function parseRows(text: string, columns: number): EditRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) throw new Error("Paste at least one row of numeric data.");
  return lines.map((line, i) => {
    const values = /[\t,;]/.test(line)
      ? line.split(/[\t,;]/).map((v) => v.trim())
      : line.trim().split(/\s+/);
    if (
      values.length !== columns ||
      values.some((v) => !Number.isFinite(numberOrNaN(v)))
    )
      throw new Error(
        `Line ${i + 1}: enter exactly ${columns} numeric columns, without a header.`,
      );
    return { id: i + 1, values, included: true };
  });
}
