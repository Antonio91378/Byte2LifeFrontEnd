import { mapSaleFilamentPayload } from "@/utils/filamentUsage";

export interface IncidentFilamentWasteLike {
  filamentId?: string | null;
  massGrams?: number | null;
}

export interface PrintIncidentWasteLike {
  wastedFilamentGrams?: number | null;
  wastedFilaments?: IncidentFilamentWasteLike[] | null;
}

type SaleFilamentUsageLike = {
  filamentId?: string | null;
  massGrams?: number | null;
};

export type SaleWasteLike = {
  filamentId?: string | null;
  massGrams?: number | null;
  filaments?: SaleFilamentUsageLike[] | null;
  incidents?: PrintIncidentWasteLike[] | null;
  wastedFilamentGrams?: number | null;
};

export interface NormalizedIncidentFilamentWaste {
  filamentId: string;
  massGrams: number;
}

const normalizeMass = (value: number | null | undefined) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.max(parsed, 0) : 0;
};

const normalizeFilamentId = (value: string | null | undefined) =>
  (value || "").trim();

const getSaleFilamentUsages = (sale: SaleWasteLike | null | undefined) =>
  mapSaleFilamentPayload(sale).filter(
    (usage) =>
      normalizeFilamentId(usage.filamentId) !== "" && usage.massGrams > 0,
  );

export function getIncidentWasteEntries(
  incident: PrintIncidentWasteLike | null | undefined,
) {
  const wasteByFilament = new Map<string, number>();

  for (const wastedFilament of incident?.wastedFilaments || []) {
    const filamentId = normalizeFilamentId(wastedFilament.filamentId);
    const massGrams = normalizeMass(wastedFilament.massGrams);

    if (!filamentId || massGrams <= 0) {
      continue;
    }

    wasteByFilament.set(
      filamentId,
      (wasteByFilament.get(filamentId) || 0) + massGrams,
    );
  }

  return Array.from(wasteByFilament.entries()).map(
    ([filamentId, massGrams]) => ({
      filamentId,
      massGrams,
    }),
  );
}

export function getIncidentWasteTotal(
  incident: PrintIncidentWasteLike | null | undefined,
) {
  const explicitWaste = getIncidentWasteEntries(incident).reduce(
    (total, entry) => total + entry.massGrams,
    0,
  );

  return Math.max(normalizeMass(incident?.wastedFilamentGrams), explicitWaste);
}

function getProportionalWasteForFilament(
  sale: SaleWasteLike | null | undefined,
  filamentId: string,
  wasteGrams: number,
) {
  const saleFilamentUsages = getSaleFilamentUsages(sale);
  const totalMass = saleFilamentUsages.reduce(
    (total, usage) => total + usage.massGrams,
    0,
  );

  if (totalMass <= 0) {
    return 0;
  }

  const trackedUsage =
    saleFilamentUsages.find((usage) => usage.filamentId === filamentId)
      ?.massGrams || 0;

  if (trackedUsage <= 0) {
    return 0;
  }

  return normalizeMass(wasteGrams) * (trackedUsage / totalMass);
}

export function getIncidentWasteForFilament(
  incident: PrintIncidentWasteLike | null | undefined,
  sale: SaleWasteLike | null | undefined,
  filamentId: string,
) {
  const normalizedFilamentId = normalizeFilamentId(filamentId);
  if (!normalizedFilamentId) {
    return 0;
  }

  const explicitEntries = getIncidentWasteEntries(incident);
  const explicitWaste =
    explicitEntries.find((entry) => entry.filamentId === normalizedFilamentId)
      ?.massGrams || 0;
  const remainingWaste =
    getIncidentWasteTotal(incident) -
    explicitEntries.reduce((total, entry) => total + entry.massGrams, 0);

  if (remainingWaste <= 0) {
    return explicitWaste;
  }

  return (
    explicitWaste +
    getProportionalWasteForFilament(sale, normalizedFilamentId, remainingWaste)
  );
}

export function getSaleWasteTotal(sale: SaleWasteLike | null | undefined) {
  const incidentWaste = (sale?.incidents || []).reduce(
    (total, incident) => total + getIncidentWasteTotal(incident),
    0,
  );

  return Math.max(normalizeMass(sale?.wastedFilamentGrams), incidentWaste);
}

export function getSaleWasteByFilament(sale: SaleWasteLike | null | undefined) {
  const saleFilamentUsages = getSaleFilamentUsages(sale);
  const totalMass = saleFilamentUsages.reduce(
    (total, usage) => total + usage.massGrams,
    0,
  );

  if (saleFilamentUsages.length === 0 || totalMass <= 0) {
    return [] as NormalizedIncidentFilamentWaste[];
  }

  const wasteByFilament = new Map<string, number>();

  const addWaste = (filamentId: string, wasteGrams: number) => {
    const normalizedFilamentId = normalizeFilamentId(filamentId);
    const normalizedWaste = normalizeMass(wasteGrams);

    if (!normalizedFilamentId || normalizedWaste <= 0) {
      return;
    }

    wasteByFilament.set(
      normalizedFilamentId,
      (wasteByFilament.get(normalizedFilamentId) || 0) + normalizedWaste,
    );
  };

  const distributeLegacyWaste = (wasteGrams: number) => {
    const normalizedWaste = normalizeMass(wasteGrams);

    if (normalizedWaste <= 0) {
      return;
    }

    for (const usage of saleFilamentUsages) {
      addWaste(
        usage.filamentId,
        normalizedWaste * (usage.massGrams / totalMass),
      );
    }
  };

  let incidentWasteTotal = 0;

  for (const incident of sale?.incidents || []) {
    const explicitEntries = getIncidentWasteEntries(incident);
    const explicitWaste = explicitEntries.reduce(
      (total, entry) => total + entry.massGrams,
      0,
    );

    for (const entry of explicitEntries) {
      addWaste(entry.filamentId, entry.massGrams);
    }

    const incidentTotal = getIncidentWasteTotal(incident);
    incidentWasteTotal += incidentTotal;
    distributeLegacyWaste(incidentTotal - explicitWaste);
  }

  distributeLegacyWaste(getSaleWasteTotal(sale) - incidentWasteTotal);

  return Array.from(wasteByFilament.entries()).map(
    ([filamentId, massGrams]) => ({
      filamentId,
      massGrams,
    }),
  );
}

export function getSaleWasteForFilament(
  sale: SaleWasteLike | null | undefined,
  filamentId: string,
) {
  const normalizedFilamentId = normalizeFilamentId(filamentId);

  if (!normalizedFilamentId) {
    return 0;
  }

  return (
    getSaleWasteByFilament(sale).find(
      (entry) => entry.filamentId === normalizedFilamentId,
    )?.massGrams || 0
  );
}
