"use client";

import {
  createEmptyPrintFeedback,
  PrintFeedback,
  normalizePrintFeedback,
} from "@/utils/printFeedback";
import { Star } from "lucide-react";

interface PrintFeedbackFormProps {
  value?: PrintFeedback | null;
  onChange: (nextFeedback: PrintFeedback) => void;
  title?: string;
  description?: string;
}

interface RatingFieldProps {
  label: string;
  helper: string;
  value: number;
  reason: string;
  reasonPlaceholder: string;
  onStarsChange: (stars: number) => void;
  onReasonChange: (reason: string) => void;
}

function RatingField({
  label,
  helper,
  value,
  reason,
  reasonPlaceholder,
  onStarsChange,
  onReasonChange,
}: RatingFieldProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-bold text-gray-900">{label}</p>
          <p className="mt-1 text-xs text-gray-500">{helper}</p>
        </div>

        <div className="flex items-center gap-1" aria-label={label}>
          {[0, 1, 2, 3, 4, 5].map((rating) => (
            <button
              key={rating}
              type="button"
              onClick={() => onStarsChange(rating)}
              className={`flex h-8 w-8 items-center justify-center rounded-lg border text-xs font-bold transition-colors ${
                value === rating
                  ? "border-brand-orange bg-brand-orange text-white"
                  : "border-gray-200 bg-white text-gray-500 hover:border-brand-orange/60 hover:text-brand-orange"
              }`}
              title={rating === 0 ? "Sem nota" : `${rating} estrela${rating > 1 ? "s" : ""}`}
            >
              {rating === 0 ? (
                "0"
              ) : (
                <Star
                  className="h-4 w-4"
                  fill={value >= rating ? "currentColor" : "none"}
                />
              )}
            </button>
          ))}
        </div>
      </div>

      <textarea
        value={reason}
        onChange={(event) => onReasonChange(event.target.value)}
        rows={3}
        className="mt-3 w-full rounded-xl border border-gray-300 p-3 text-sm text-gray-900 focus:border-transparent focus:ring-2 focus:ring-brand-purple"
        placeholder={reasonPlaceholder}
      />
    </div>
  );
}

export default function PrintFeedbackForm({
  value,
  onChange,
  title = "Feedback da impressão",
  description = "Registre a qualidade do arquivo, a qualidade real da impressão e observações para futuras reimpressões.",
}: PrintFeedbackFormProps) {
  const feedback = normalizePrintFeedback(value ?? createEmptyPrintFeedback());

  const updateFeedback = (patch: Partial<PrintFeedback>) => {
    onChange(
      normalizePrintFeedback({
        ...feedback,
        ...patch,
      }),
    );
  };

  return (
    <section className="rounded-2xl border border-brand-purple/10 bg-white p-4 shadow-sm md:p-5">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-brand-purple">{title}</h2>
        <p className="mt-1 text-sm text-gray-500">{description}</p>
      </div>

      <div className="space-y-4">
        <RatingField
          label="Qualidade do arquivo"
          helper="0 para sem avaliação, 5 para arquivo excelente."
          value={feedback.fileQuality.stars}
          reason={feedback.fileQuality.reason ?? ""}
          reasonPlaceholder="Explique a nota do arquivo, suporte, encaixes, acabamento previsto ou ajustes necessários."
          onStarsChange={(stars) =>
            updateFeedback({
              fileQuality: { ...feedback.fileQuality, stars },
            })
          }
          onReasonChange={(reason) =>
            updateFeedback({
              fileQuality: { ...feedback.fileQuality, reason },
            })
          }
        />

        <RatingField
          label="Qualidade da impressão"
          helper="0 para qualidade ruim, 5 para impressão excelente."
          value={feedback.printQuality.stars}
          reason={feedback.printQuality.reason ?? ""}
          reasonPlaceholder="Explique acabamento, aderência, falhas, suportes, tempo, pós-processo ou riscos observados."
          onStarsChange={(stars) =>
            updateFeedback({
              printQuality: { ...feedback.printQuality, stars },
            })
          }
          onReasonChange={(reason) =>
            updateFeedback({
              printQuality: { ...feedback.printQuality, reason },
            })
          }
        />

        <div>
          <label className="block text-sm font-bold text-gray-900">
            Observações gerais do produto impresso
          </label>
          <textarea
            value={feedback.generalNotes ?? ""}
            onChange={(event) =>
              updateFeedback({ generalNotes: event.target.value })
            }
            rows={4}
            className="mt-2 w-full rounded-xl border border-gray-300 p-3 text-sm text-gray-900 focus:border-transparent focus:ring-2 focus:ring-brand-purple"
            placeholder="Anote acabamento final, ajustes para o próximo clone, percepção do cliente ou qualquer detalhe do produto impresso."
          />
        </div>
      </div>
    </section>
  );
}
