export type Nozzle02Compatibility = "compatible" | "incompatible" | "unknown";

type FilamentNozzleCompatibilityLike = {
  isNozzle02Compatible?: boolean | null;
  IsNozzle02Compatible?: boolean | null;
};

export function getNozzle02CompatibilityValue(
  filament: FilamentNozzleCompatibilityLike | null | undefined,
): Nozzle02Compatibility {
  const value =
    filament?.isNozzle02Compatible ?? filament?.IsNozzle02Compatible;

  if (value === true) {
    return "compatible";
  }

  if (value === false) {
    return "incompatible";
  }

  return "unknown";
}

export function getNozzle02CompatibilityLabel(
  value: Nozzle02Compatibility,
): string {
  switch (value) {
    case "compatible":
      return "Bico 0.2: compativel";
    case "incompatible":
      return "Bico 0.2: nao compativel";
    default:
      return "Bico 0.2: desconhecido";
  }
}

export function getNozzle02CompatibilityBadgeClassName(
  value: Nozzle02Compatibility,
): string {
  switch (value) {
    case "compatible":
      return "border border-emerald-200 bg-emerald-100 text-emerald-700";
    case "incompatible":
      return "border border-rose-200 bg-rose-100 text-rose-700";
    default:
      return "border border-gray-200 bg-gray-100 text-gray-600";
  }
}

export function toNozzle02CompatibilityPayload(
  value: Nozzle02Compatibility,
): boolean | null {
  if (value === "compatible") {
    return true;
  }

  if (value === "incompatible") {
    return false;
  }

  return null;
}
