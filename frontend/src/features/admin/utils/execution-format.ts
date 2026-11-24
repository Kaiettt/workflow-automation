import { formatDateTime } from "./format";

export function executionTime(value: string | null) {
  return value === null ? "—" : formatDateTime(value);
}
export function executionDuration(value: number | null) {
  return value === null ? "—" : `${value.toLocaleString("en-US")} ms`;
}
