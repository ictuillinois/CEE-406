import { useRef, useState } from "react";
import { parseRows, type EditRow } from "./shared.ts";
interface Props {
  rows: EditRow[];
  columns: string[];
  onChange: (r: EditRow[]) => void;
  reset: () => void;
  exclude?: boolean;
}
export default function DataEditor({
  rows,
  columns,
  onChange,
  reset,
  exclude = false,
}: Props) {
  const next = useRef(1000);
  const [paste, setPaste] = useState("");
  const [error, setError] = useState("");
  return (
    <>
      <div className="fit-actions">
        <button
          type="button"
          className="cee-chip"
          onClick={() => {
            reset();
            setError("");
          }}
        >
          Load HW2 data
        </button>
        <button
          type="button"
          className="cee-chip"
          onClick={() =>
            onChange([
              ...rows,
              {
                id: next.current++,
                values: columns.map(() => ""),
                included: true,
              },
            ])
          }
        >
          Add point
        </button>
      </div>
      <p className="cee-hint">
        {rows.length} readings. HW2 preset: Fall 2026. Edit any cell.
        {exclude && " Uncheck a reading to exclude it while preserving its ID."}
      </p>
      <div
        className="cee-tablewrap fit-editor"
        tabIndex={0}
        role="region"
        aria-label="Editable test data"
      >
        <table className="cee-table">
          <thead>
            <tr>
              {exclude && <th>Use</th>}
              <th>ID</th>
              {columns.map((c) => (
                <th key={c}>{c}</th>
              ))}
              <th>
                <span className="fit-sr">Remove</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className={!row.included ? "fit-excluded" : ""}>
                {exclude && (
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`Include point ${row.id}`}
                      checked={row.included}
                      onChange={(e) =>
                        onChange(
                          rows.map((r) =>
                            r.id === row.id
                              ? { ...r, included: e.target.checked }
                              : r,
                          ),
                        )
                      }
                    />
                  </td>
                )}
                <th scope="row">{row.id}</th>
                {row.values.map((v, j) => (
                  <td key={j}>
                    <input
                      type="number"
                      step="any"
                      className="cee-input"
                      aria-label={`${columns[j]}, point ${row.id}`}
                      value={v}
                      onChange={(e) =>
                        onChange(
                          rows.map((r) =>
                            r.id === row.id
                              ? {
                                  ...r,
                                  values: r.values.map((x, k) =>
                                    k === j ? e.target.value : x,
                                  ),
                                }
                              : r,
                          ),
                        )
                      }
                    />
                  </td>
                ))}
                <td>
                  <button
                    type="button"
                    className="cee-axle-remove"
                    aria-label={`Remove point ${row.id}`}
                    onClick={() =>
                      onChange(rows.filter((r) => r.id !== row.id))
                    }
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <details className="fit-paste">
        <summary>Paste a different dataset</summary>
        <p className="cee-hint">
          {columns.join(" · ")}. Numeric rows only, separated by tabs, commas,
          or spaces. Replaces this table.
        </p>
        <textarea
          className="cee-textarea"
          aria-label="Paste numeric data"
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
        />
        <button
          type="button"
          className="cee-btn cee-btn--sm"
          onClick={() => {
            try {
              onChange(parseRows(paste, columns.length));
              setError("");
              setPaste("");
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          Load pasted data
        </button>
        {error && (
          <p role="alert" className="fit-error">
            {error}
          </p>
        )}
      </details>
    </>
  );
}
