export interface FilamentUsageSelection {
  key: string;
  filamentId: string;
  massGrams: number;
}

export interface FilamentUsagePayloadItem {
  filamentId: string;
  massGrams: number;
}

type ApiFilamentUsageLike = {
  filamentId?: string | null;
  massGrams?: number | null;
};

type ApiSaleLike = {
  filamentId?: string | null;
  massGrams?: number | null;
  filaments?: ApiFilamentUsageLike[] | null;
};

export const MIN_FILAMENT_USAGE_COUNT = 1;
export const MAX_FILAMENT_USAGE_COUNT = 6;

function createUsageKey() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `filament-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeMass(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.max(parsed, 0) : 0;
}

function appendUsage(
  target: FilamentUsagePayloadItem[],
  filamentId: string | null | undefined,
  massGrams: number | string | null | undefined,
) {
  const normalizedFilamentId = (filamentId ?? "").trim();
  const normalizedMass = normalizeMass(massGrams);

  if (!normalizedFilamentId || normalizedMass <= 0) {
    return;
  }

  const existingUsage = target.find(
    (usage) => usage.filamentId === normalizedFilamentId,
  );
  if (existingUsage) {
    existingUsage.massGrams += normalizedMass;
    return;
  }

  target.push({
    filamentId: normalizedFilamentId,
    massGrams: normalizedMass,
  });
}

export function createEmptyFilamentUsage(): FilamentUsageSelection {
  return {
    key: createUsageKey(),
    filamentId: "",
    massGrams: 0,
  };
}

export function ensureFilamentUsageCount(
  usages: FilamentUsageSelection[],
  nextCount: number,
) {
  const clampedCount = Math.min(
    MAX_FILAMENT_USAGE_COUNT,
    Math.max(
      MIN_FILAMENT_USAGE_COUNT,
      Math.trunc(nextCount || MIN_FILAMENT_USAGE_COUNT),
    ),
  );

  if (usages.length === clampedCount) {
    return usages;
  }

  if (usages.length > clampedCount) {
    return usages.slice(0, clampedCount);
  }

  return [
    ...usages,
    ...Array.from({ length: clampedCount - usages.length }, () =>
      createEmptyFilamentUsage(),
    ),
  ];
}

export function getTotalFilamentUsageMass(usages: FilamentUsageSelection[]) {
  return usages.reduce(
    (total, usage) => total + normalizeMass(usage.massGrams),
    0,
  );
}

export function toFilamentUsagePayload(usages: FilamentUsageSelection[]) {
  const normalized: FilamentUsagePayloadItem[] = [];

  usages.forEach((usage) => {
    appendUsage(normalized, usage.filamentId, usage.massGrams);
  });

  return normalized;
}

export function hasCompleteFilamentUsages(usages: FilamentUsageSelection[]) {
  return usages.every(
    (usage) =>
      usage.filamentId.trim() !== "" && normalizeMass(usage.massGrams) > 0,
  );
}

export function getPrimaryFilamentId(usages: FilamentUsageSelection[]) {
  return toFilamentUsagePayload(usages)[0]?.filamentId || "";
}

export function mapSaleFilamentUsages(source: ApiSaleLike | null | undefined) {
  const normalized: FilamentUsagePayloadItem[] = [];

  if (Array.isArray(source?.filaments)) {
    source.filaments.forEach((usage) => {
      appendUsage(normalized, usage.filamentId, usage.massGrams);
    });
  }

  if (normalized.length === 0) {
    appendUsage(normalized, source?.filamentId, source?.massGrams);
  }

  return ensureFilamentUsageCount(
    normalized.map((usage) => ({
      key: createUsageKey(),
      filamentId: usage.filamentId,
      massGrams: usage.massGrams,
    })),
    normalized.length > 0 ? normalized.length : MIN_FILAMENT_USAGE_COUNT,
  );
}

export function mapSaleFilamentPayload(source: ApiSaleLike | null | undefined) {
  const normalized: FilamentUsagePayloadItem[] = [];

  if (Array.isArray(source?.filaments)) {
    source.filaments.forEach((usage) => {
      appendUsage(normalized, usage.filamentId, usage.massGrams);
    });
  }

  if (normalized.length === 0) {
    appendUsage(normalized, source?.filamentId, source?.massGrams);
  }

  return normalized;
}

export function getSaleFilamentUsageMass(
  source: ApiSaleLike | null | undefined,
  filamentId: string,
) {
  const normalizedFilamentId = filamentId.trim();

  if (!normalizedFilamentId) {
    return 0;
  }

  return (
    mapSaleFilamentPayload(source).find(
      (usage) => usage.filamentId === normalizedFilamentId,
    )?.massGrams || 0
  );
}

export function formatFilamentDisplayName(filament: {
  description: string;
  color: string;
}) {
  return `${filament.description} (${filament.color})`;
}
