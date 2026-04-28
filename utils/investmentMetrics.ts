import { isSaleActive } from "./saleActivity";
import { toSaleNumber } from "./saleFinancials";

type SaleLike = {
  isActive?: boolean | null;
  IsActive?: boolean | null;
  saleDate?: string | null;
  SaleDate?: string | null;
  date?: string | null;
  Date?: string | null;
  createdAt?: string | null;
  created_at?: string | null;
  profit?: number | string | null;
  Profit?: number | string | null;
  saleValue?: number | string | null;
  SaleValue?: number | string | null;
};

type ServiceTaskLike = {
  value?: number | string | null;
  Value?: number | string | null;
};

type InvestmentLike = {
  amount?: number | string | null;
};

export type ChartEntry = {
  label: string;
  value: number;
  description: string;
};

function getMonthLabel(dateStr: string) {
  const date = new Date(dateStr);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getDayLabel(dateStr: string) {
  const date = new Date(dateStr);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getSaleDateStr(sale: SaleLike) {
  return (
    sale.saleDate ||
    sale.SaleDate ||
    sale.date ||
    sale.Date ||
    sale.createdAt ||
    sale.created_at ||
    null
  );
}

function getSaleProfit(sale: SaleLike) {
  return toSaleNumber(sale.profit ?? sale.Profit ?? 0);
}

function getSaleRevenue(sale: SaleLike) {
  return toSaleNumber(sale.saleValue ?? sale.SaleValue ?? 0);
}

function getServiceValue(task: ServiceTaskLike) {
  return toSaleNumber(task.value ?? task.Value ?? 0);
}

export function filterActiveSales<T extends SaleLike>(sales: T[]): T[] {
  return sales.filter((sale) => isSaleActive(sale));
}

export function aggregateActiveSalesByMonth(sales: SaleLike[]): ChartEntry[] {
  const map = new Map<string, { value: number; description: string }>();

  filterActiveSales(sales).forEach((sale) => {
    const dateStr = getSaleDateStr(sale);
    if (!dateStr) return;

    const label = getMonthLabel(dateStr);
    const previous = map.get(label) || { value: 0, description: "" };

    map.set(label, {
      value: previous.value + getSaleProfit(sale),
      description: `Lucro de ${label}`,
    });
  });

  return Array.from(map.entries()).map(([label, { value, description }]) => ({
    label,
    value,
    description,
  }));
}

export function aggregateActiveSalesByDay(
  sales: SaleLike[],
  month: string,
): ChartEntry[] {
  const map = new Map<string, { value: number; description: string }>();

  filterActiveSales(sales).forEach((sale) => {
    const dateStr = getSaleDateStr(sale);
    if (!dateStr || getMonthLabel(dateStr) !== month) return;

    const label = getDayLabel(dateStr);
    const previous = map.get(label) || { value: 0, description: "" };

    map.set(label, {
      value: previous.value + getSaleProfit(sale),
      description: `Lucro em ${label}`,
    });
  });

  return Array.from(map.entries()).map(([label, { value, description }]) => ({
    label,
    value,
    description,
  }));
}

export function buildInvestmentSummary({
  sales,
  designTasks,
  paintingTasks,
  investments,
}: {
  sales: SaleLike[];
  designTasks: ServiceTaskLike[];
  paintingTasks: ServiceTaskLike[];
  investments: InvestmentLike[];
}) {
  const activeSales = filterActiveSales(sales);
  const servicesProfit = [...designTasks, ...paintingTasks].reduce(
    (accumulator, task) => accumulator + getServiceValue(task),
    0,
  );
  const totalProfit =
    activeSales.reduce(
      (accumulator, sale) => accumulator + getSaleProfit(sale),
      0,
    ) + servicesProfit;
  const totalRevenue =
    activeSales.reduce(
      (accumulator, sale) => accumulator + getSaleRevenue(sale),
      0,
    ) + servicesProfit;
  const totalInvestment = investments.reduce(
    (accumulator, investment) => accumulator + toSaleNumber(investment.amount),
    0,
  );
  const balance = totalProfit - totalInvestment;
  const progress =
    totalInvestment > 0 ? (totalProfit / totalInvestment) * 100 : 0;

  return {
    activeSales,
    totalProfit,
    totalRevenue,
    totalInvestment,
    balance,
    progress,
  };
}
