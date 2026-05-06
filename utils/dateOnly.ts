const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})/;

export function toDateOnlyValue(value?: string | null): string {
  if (!value) {
    return "";
  }

  const match = DATE_ONLY_PATTERN.exec(value);
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}`;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatDateOnly(
  value?: string | null,
  fallback = "-",
): string {
  const dateOnly = toDateOnlyValue(value);
  if (!dateOnly) {
    return fallback;
  }

  const [year, month, day] = dateOnly.split("-");
  return `${day}/${month}/${year}`;
}

export function getDateOnlySortValue(value?: string | null): number | null {
  const dateOnly = toDateOnlyValue(value);
  if (!dateOnly) {
    return null;
  }

  const [year, month, day] = dateOnly.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

export function getLocalDateOnlyValue(date = new Date()): string {
  const timezoneOffset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 10);
}
