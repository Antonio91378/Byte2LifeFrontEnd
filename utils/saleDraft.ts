import { parseDurationToHours } from "./time";
import { getLocalDateOnlyValue } from "./dateOnly";
import {
  hasPrintFeedback,
  PrintFeedback,
  PrintFeedbackHistoryEntry,
} from "./printFeedback";

type NumericLike = number | string | null | undefined;

type FilamentUsageLike =
  | {
      filamentId?: string | null;
      massGrams?: NumericLike;
    }
  | null
  | undefined;

export interface SaleDraftIssue {
  id:
    | "description"
    | "saleDate"
    | "deliveryDate"
    | "saleValue"
    | "filaments"
    | "printTime"
    | "designResponsible"
    | "designTime"
    | "paintResponsible"
    | "paintTime";
  label: string;
}

export interface SaleDraftInput {
  description?: string | null;
  saleDate?: string | null;
  deliveryDate?: string | null;
  saleValue?: NumericLike;
  designPrintTime?: string | null;
  printTimeHours?: NumericLike;
  filaments?: FilamentUsageLike[] | null;
  filamentId?: string | null;
  massGrams?: NumericLike;
  hasCustomArt?: boolean | null;
  designTimeHours?: NumericLike;
  designResponsible?: string | null;
  hasPainting?: boolean | null;
  paintTimeHours?: NumericLike;
  paintResponsible?: string | null;
  printStatus?: string | null;
  isPrintConcluded?: boolean | null;
}

export interface CloneableSale extends SaleDraftInput {
  id?: string | null;
  attachments?: unknown[] | null;
  incidents?: unknown[] | null;
  errorReason?: unknown;
  wastedFilamentGrams?: NumericLike;
  isDelivered?: boolean | null;
  isPaid?: boolean | null;
  printStartedAt?: string | null;
  printStartScheduledAt?: string | null;
  printStartConfirmedAt?: string | null;
  designStartConfirmedAt?: string | null;
  paintStartConfirmedAt?: string | null;
  stockItemId?: string | null;
  priority?: NumericLike;
  isActive?: boolean | null;
  printFeedback?: PrintFeedback | null;
  printFeedbackHistory?: PrintFeedbackHistoryEntry[] | null;
  [key: string]: unknown;
}

export type CloneMode = "copy" | "reset";

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function toNumber(value: NumericLike): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (value == null) {
    return 0;
  }

  const text = String(value).trim();
  if (text === "") {
    return 0;
  }

  const normalized = text.includes(",")
    ? text.replace(/\./g, "").replace(",", ".")
    : text;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function hasPositiveFilamentUsage(input: SaleDraftInput): boolean {
  const usages = Array.isArray(input.filaments) ? input.filaments : [];
  const hasUsageInList = usages.some((usage) => {
    if (!usage) {
      return false;
    }

    return (
      normalizeText(usage.filamentId) !== "" && toNumber(usage.massGrams) > 0
    );
  });

  if (hasUsageInList) {
    return true;
  }

  return (
    normalizeText(input.filamentId) !== "" && toNumber(input.massGrams) > 0
  );
}

function getPrintTimeHours(input: SaleDraftInput): number {
  const explicitHours = toNumber(input.printTimeHours);
  if (explicitHours > 0) {
    return explicitHours;
  }

  return parseDurationToHours(normalizeText(input.designPrintTime));
}

export function getSaleDraftIssues(input: SaleDraftInput): SaleDraftIssue[] {
  const issues: SaleDraftIssue[] = [];

  if (normalizeText(input.description) === "") {
    issues.push({ id: "description", label: "Descrição" });
  }

  if (normalizeText(input.saleDate) === "") {
    issues.push({ id: "saleDate", label: "Data da venda" });
  }

  if (normalizeText(input.deliveryDate) === "") {
    issues.push({ id: "deliveryDate", label: "Data de entrega" });
  }

  if (toNumber(input.saleValue) <= 0) {
    issues.push({ id: "saleValue", label: "Valor da venda" });
  }

  if (!hasPositiveFilamentUsage(input)) {
    issues.push({ id: "filaments", label: "Filamentos e massa" });
  }

  if (getPrintTimeHours(input) <= 0) {
    issues.push({ id: "printTime", label: "Tempo de impressão" });
  }

  if (input.hasCustomArt) {
    if (normalizeText(input.designResponsible) === "") {
      issues.push({
        id: "designResponsible",
        label: "Responsável pelo design",
      });
    }

    if (toNumber(input.designTimeHours) <= 0) {
      issues.push({ id: "designTime", label: "Duração do design" });
    }
  }

  if (input.hasPainting) {
    if (normalizeText(input.paintResponsible) === "") {
      issues.push({
        id: "paintResponsible",
        label: "Responsável pela pintura",
      });
    }

    if (toNumber(input.paintTimeHours) <= 0) {
      issues.push({ id: "paintTime", label: "Duração da pintura" });
    }
  }

  return issues;
}

export function formatSaleDraftIssuesSummary(
  issues: SaleDraftIssue[],
  maxItems = 3,
): string {
  if (issues.length === 0) {
    return "";
  }

  const labels = issues
    .slice(0, maxItems)
    .map((issue) => issue.label.toLowerCase());

  if (issues.length <= maxItems) {
    return labels.join(", ");
  }

  return `${labels.join(", ")} e mais ${issues.length - maxItems}`;
}

export function applyDraftFlags(payload: CloneableSale): CloneableSale {
  const issues = getSaleDraftIssues(payload);
  if (issues.length === 0) {
    return payload;
  }

  return {
    ...payload,
    printStatus: "Pending",
    isPrintConcluded: false,
  };
}

function buildCloneFeedbackHistory(
  sale: CloneableSale,
): PrintFeedbackHistoryEntry[] {
  const history = Array.isArray(sale.printFeedbackHistory)
    ? [...sale.printFeedbackHistory]
    : [];

  if (!hasPrintFeedback(sale.printFeedback ?? null)) {
    return history;
  }

  return [
    ...history,
    {
      sourceSaleId: sale.id ?? null,
      sourceSaleDescription: sale.description ?? null,
      clonedAt: new Date().toISOString(),
      feedback: sale.printFeedback ?? null,
    },
  ];
}

export function buildClonedSalePayload<T extends CloneableSale>(
  sale: CloneableSale,
  mode: CloneMode,
): CloneableSale {
  const { id: _id, ...saleWithoutId } = sale;
  const printFeedbackHistory = buildCloneFeedbackHistory(sale);

  if (mode === "copy") {
    return applyDraftFlags({
      ...saleWithoutId,
      attachments: [],
      printFeedback: null,
      printFeedbackHistory,
    });
  }

  return applyDraftFlags({
    ...saleWithoutId,
    attachments: [],
    printFeedback: null,
    printFeedbackHistory,
    incidents: [],
    errorReason: null,
    wastedFilamentGrams: null,
    saleDate: getLocalDateOnlyValue(),
    deliveryDate: null,
    printStatus: "Pending",
    isPrintConcluded: false,
    isDelivered: false,
    isPaid: false,
    printStartedAt: null,
    printStartScheduledAt: null,
    printStartConfirmedAt: null,
    designStartConfirmedAt: null,
    paintStartConfirmedAt: null,
    stockItemId: null,
    priority: 0,
    isActive: true,
  });
}
