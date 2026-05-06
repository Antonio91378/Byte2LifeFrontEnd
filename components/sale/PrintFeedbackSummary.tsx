"use client";

import {
  formatFeedbackDate,
  getPrintFeedbackAverage,
  hasFeedbackHistory,
  hasPrintFeedback,
  PrintFeedback,
  PrintFeedbackHistoryEntry,
} from "@/utils/printFeedback";
import { Star } from "lucide-react";

interface PrintFeedbackSummaryProps {
  feedback?: PrintFeedback | null;
  history?: PrintFeedbackHistoryEntry[] | null;
  title?: string;
  emptyText?: string;
  compact?: boolean;
  showHistory?: boolean;
}

interface RatingLineProps {
  label: string;
  stars: number;
  reason?: string | null;
}

function Stars({ value }: Readonly<{ value: number }>) {
  return (
    <span className="inline-flex items-center gap-0.5 text-brand-orange">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className="h-4 w-4"
          fill={value >= star ? "currentColor" : "none"}
        />
      ))}
    </span>
  );
}

function RatingLine({ label, stars, reason }: RatingLineProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-semibold text-gray-900">{label}</p>
        <div className="flex items-center gap-2">
          <Stars value={stars} />
          <span className="text-xs font-bold text-gray-600">{stars}/5</span>
        </div>
      </div>
      {reason ? <p className="mt-2 text-sm text-gray-600">{reason}</p> : null}
    </div>
  );
}

export function PrintFeedbackBadge({
  feedback,
  history,
}: Readonly<{
  feedback?: PrintFeedback | null;
  history?: PrintFeedbackHistoryEntry[] | null;
}>) {
  const average = getPrintFeedbackAverage(feedback ?? null);
  const hasCurrentFeedback = hasPrintFeedback(feedback ?? null);
  const hasHistory = hasFeedbackHistory(history ?? null);

  if (!hasCurrentFeedback && !hasHistory) {
    return null;
  }

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold ${
        hasCurrentFeedback
          ? "border-brand-orange/30 bg-orange-50 text-orange-700"
          : "border-slate-200 bg-slate-100 text-slate-600"
      }`}
      title="Feedback da impressão"
    >
      <Star className="h-3.5 w-3.5" fill="currentColor" />
      {hasCurrentFeedback && average !== null
        ? average.toLocaleString("pt-BR", { maximumFractionDigits: 1 })
        : "hist."}
    </span>
  );
}

export default function PrintFeedbackSummary({
  feedback,
  history,
  title = "Feedback da impressão",
  emptyText = "Nenhum feedback registrado.",
  compact = false,
  showHistory = true,
}: PrintFeedbackSummaryProps) {
  const hasCurrentFeedback = hasPrintFeedback(feedback ?? null);
  const historyEntries = (history ?? []).filter((entry) =>
    hasPrintFeedback(entry.feedback ?? null),
  );

  if (!hasCurrentFeedback && historyEntries.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-4 text-sm text-gray-500">
        {emptyText}
      </div>
    );
  }

  return (
    <section
      className={
        compact
          ? "space-y-3"
          : "rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"
      }
    >
      {!compact ? (
        <div>
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          <p className="mt-1 text-sm text-gray-500">
            Avaliação registrada na finalização ou edição da venda.
          </p>
        </div>
      ) : null}

      {hasCurrentFeedback && feedback ? (
        <div className={compact ? "space-y-2" : "mt-4 space-y-3"}>
          <RatingLine
            label="Qualidade do arquivo"
            stars={feedback.fileQuality?.stars ?? 0}
            reason={feedback.fileQuality?.reason}
          />
          <RatingLine
            label="Qualidade da impressão"
            stars={feedback.printQuality?.stars ?? 0}
            reason={feedback.printQuality?.reason}
          />
          {feedback.generalNotes ? (
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
              <p className="text-sm font-semibold text-gray-900">
                Observações gerais
              </p>
              <p className="mt-2 text-sm text-gray-600">
                {feedback.generalNotes}
              </p>
            </div>
          ) : null}
          {formatFeedbackDate(feedback.updatedAt || feedback.recordedAt) ? (
            <p className="text-xs text-gray-500">
              Atualizado em{" "}
              {formatFeedbackDate(feedback.updatedAt || feedback.recordedAt)}
            </p>
          ) : null}
        </div>
      ) : null}

      {showHistory && historyEntries.length > 0 ? (
        <div className={compact ? "space-y-2" : "mt-5 space-y-3"}>
          <p className="text-sm font-bold text-brand-purple">
            Histórico herdado de clones
          </p>
          {historyEntries.map((entry, index) => (
            <div
              key={`${entry.sourceSaleId ?? "sale"}-${index}`}
              className="rounded-xl border border-purple-100 bg-purple-50/70 p-3"
            >
              <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-semibold text-purple-900">
                  {entry.sourceSaleDescription || "Venda anterior"}
                </p>
                {formatFeedbackDate(entry.clonedAt) ? (
                  <span className="text-xs text-purple-700">
                    Clonado em {formatFeedbackDate(entry.clonedAt)}
                  </span>
                ) : null}
              </div>
              {entry.feedback ? (
                <div className="space-y-2">
                  <RatingLine
                    label="Qualidade do arquivo anterior"
                    stars={entry.feedback.fileQuality?.stars ?? 0}
                    reason={entry.feedback.fileQuality?.reason}
                  />
                  <RatingLine
                    label="Qualidade da impressão anterior"
                    stars={entry.feedback.printQuality?.stars ?? 0}
                    reason={entry.feedback.printQuality?.reason}
                  />
                  {entry.feedback.generalNotes ? (
                    <p className="rounded-lg bg-white/80 px-3 py-2 text-sm text-purple-900">
                      {entry.feedback.generalNotes}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
