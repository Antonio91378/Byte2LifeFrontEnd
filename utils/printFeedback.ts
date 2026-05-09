export interface PrintFeedbackRating {
  stars: number;
  reason?: string | null;
}

export interface PrintFeedback {
  fileQuality: PrintFeedbackRating;
  printQuality: PrintFeedbackRating;
  generalNotes?: string | null;
  recordedAt?: string | null;
  updatedAt?: string | null;
}

export interface PrintFeedbackHistoryEntry {
  sourceSaleId?: string | null;
  sourceSaleDescription?: string | null;
  clonedAt?: string | null;
  feedback?: PrintFeedback | null;
}

export interface PrintFeedbackCarrier {
  printFeedback?: PrintFeedback | null;
  printFeedbackHistory?: PrintFeedbackHistoryEntry[] | null;
}

export function normalizeRating(
  rating?: Partial<PrintFeedbackRating> | null,
): PrintFeedbackRating {
  const rawStars = Number(rating?.stars ?? 0);
  const stars = Number.isFinite(rawStars)
    ? Math.min(5, Math.max(0, Math.round(rawStars)))
    : 0;

  return {
    stars,
    reason: typeof rating?.reason === "string" ? rating.reason : "",
  };
}

export function createEmptyPrintFeedback(): PrintFeedback {
  return {
    fileQuality: { stars: 0, reason: "" },
    printQuality: { stars: 0, reason: "" },
    generalNotes: "",
  };
}

export function normalizePrintFeedback(
  feedback?: Partial<PrintFeedback> | null,
): PrintFeedback {
  return {
    fileQuality: normalizeRating(feedback?.fileQuality),
    printQuality: normalizeRating(feedback?.printQuality),
    generalNotes:
      typeof feedback?.generalNotes === "string" ? feedback.generalNotes : "",
    recordedAt: feedback?.recordedAt ?? null,
    updatedAt: feedback?.updatedAt ?? null,
  };
}

export function hasRatingContent(rating?: PrintFeedbackRating | null): boolean {
  return Boolean(
    rating &&
      (Number(rating.stars) > 0 ||
        (typeof rating.reason === "string" && rating.reason.trim() !== "")),
  );
}

export function hasPrintFeedback(feedback?: PrintFeedback | null): boolean {
  const normalized = feedback ? normalizePrintFeedback(feedback) : null;
  return Boolean(
    normalized &&
      (hasRatingContent(normalized.fileQuality) ||
        hasRatingContent(normalized.printQuality) ||
        normalized.generalNotes?.trim()),
  );
}

export function hasFeedbackHistory(
  history?: PrintFeedbackHistoryEntry[] | null,
): boolean {
  return Boolean(
    history?.some((entry) => hasPrintFeedback(entry.feedback ?? null)),
  );
}

export function hasAnyPrintFeedback(carrier?: PrintFeedbackCarrier | null) {
  return Boolean(
    carrier &&
      (hasPrintFeedback(carrier.printFeedback ?? null) ||
        hasFeedbackHistory(carrier.printFeedbackHistory ?? null)),
  );
}

export function getPrintFeedbackAverage(
  feedback?: PrintFeedback | null,
): number | null {
  if (!feedback) {
    return null;
  }

  const normalized = normalizePrintFeedback(feedback);
  const values = [
    normalized.fileQuality.stars,
    normalized.printQuality.stars,
  ].filter((value) => value > 0);

  if (values.length === 0) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function toStoredPrintFeedback(
  feedback?: PrintFeedback | null,
): PrintFeedback | null {
  if (!hasPrintFeedback(feedback ?? null)) {
    return null;
  }

  const now = new Date().toISOString();
  const normalized = normalizePrintFeedback(feedback);

  return {
    ...normalized,
    recordedAt: normalized.recordedAt || now,
    updatedAt: now,
  };
}

export function formatFeedbackDate(value?: string | null): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}
