type NumericLike = number | string | null | undefined;

type SaleFinancialInput = {
  saleValue?: NumericLike;
  cost?: NumericLike;
  shippingCost?: NumericLike;
  productionCost?: NumericLike;
  baseCost?: NumericLike;
};

export function toSaleNumber(value: NumericLike): number {
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

export function getSaleBaseCost(input: SaleFinancialInput): number {
  const explicitBaseCost = toSaleNumber(input.baseCost);
  if (explicitBaseCost > 0) {
    return explicitBaseCost;
  }

  const productionCost = toSaleNumber(input.productionCost);
  if (productionCost > 0) {
    return productionCost;
  }

  const totalCost = toSaleNumber(input.cost);
  if (totalCost <= 0) {
    return 0;
  }

  const shippingCost = Math.max(toSaleNumber(input.shippingCost), 0);
  const derivedBaseCost = totalCost - shippingCost;
  return derivedBaseCost > 0 ? derivedBaseCost : totalCost;
}

export function getSaleTotalCost(input: SaleFinancialInput): number {
  const totalCost = toSaleNumber(input.cost);
  if (totalCost > 0) {
    return totalCost;
  }

  return getSaleBaseCost(input) + Math.max(toSaleNumber(input.shippingCost), 0);
}

export function getSaleProfitValue(input: SaleFinancialInput): number {
  return toSaleNumber(input.saleValue) - getSaleTotalCost(input);
}

export function getSaleProfitPercentageValue(input: SaleFinancialInput): number {
  const baseCost = getSaleBaseCost(input);
  if (baseCost <= 0) {
    return 0;
  }

  return (getSaleProfitValue(input) / baseCost) * 100;
}

export function formatSaleProfitPercentage(input: SaleFinancialInput): string {
  return `${getSaleProfitPercentageValue(input).toFixed(2)}%`;
}