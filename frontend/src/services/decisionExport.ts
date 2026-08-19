/**
 * Export this session's decisions as CSV.
 *
 * This is not an audit trail. Decisions live in the page and are gone on
 * refresh, so the file is a snapshot of one session's work, taken at the moment
 * the agent asks for it. A production system would record decisions server-side
 * with the extraction that produced them; see the README's limitations.
 */

import { FIELD_LABELS, type ApplicationSummary, type Decision } from "../types";

const HEADERS = [
  "application_id",
  "applicant",
  "submitted_date",
  "brand_name_on_form",
  "decision",
  "decided_at",
  "fields_not_matching",
  "reason",
  "note",
  "exported_at",
] as const;

/**
 * Quote a value for CSV.
 *
 * Everything is quoted rather than only values containing separators: applicant
 * names and label text carry commas and apostrophes, and a leading =, +, - or @
 * is treated as a formula by spreadsheet software, so those are prefixed with a
 * single quote to keep them inert.
 */
export function escapeCell(value: string): string {
  const risky = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${risky.replace(/"/g, '""')}"`;
}

export function toCsv(
  applications: ApplicationSummary[],
  decisions: ReadonlyMap<string, Decision>,
  exportedAt: string,
): string {
  const rows = applications
    .filter((application) => decisions.has(application.application_id))
    .map((application) => {
      const decision = decisions.get(application.application_id);
      if (decision === undefined) return null;
      return [
        application.application_id,
        application.applicant,
        application.submitted_date,
        application.submitted.brand_name,
        decision.status === "approved" ? "Approved" : "Rejected",
        decision.decidedAt,
        decision.flaggedFields
          .map((field) => FIELD_LABELS[field] ?? field)
          .join("; "),
        decision.reason ?? "",
        decision.note,
        exportedAt,
      ].map(escapeCell);
    })
    .filter((row): row is string[] => row !== null);

  return [HEADERS.map(escapeCell), ...rows].map((row) => row.join(",")).join("\r\n");
}

/** Filename carrying the date, so successive exports do not overwrite. */
export function csvFilename(exportedAt: string): string {
  return `ttb-decisions-${exportedAt.slice(0, 10)}.csv`;
}

/** Hand the CSV to the browser as a download. */
export function downloadCsv(contents: string, filename: string): void {
  // A byte order mark so Excel reads the file as UTF-8 rather than the local
  // codepage, which would mangle any non-ASCII applicant name.
  const BOM = "\uFEFF";
  const blob = new Blob([BOM + contents], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
