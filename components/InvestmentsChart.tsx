"use client";
import {
    CategoryScale,
    Chart as ChartJS,
    Legend,
    LinearScale,
    LineElement,
    PointElement,
    Title,
    Tooltip,
} from "chart.js";
import "chart.js/auto";
import { Line } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
);

interface ChartEntry {
  label: string;
  value: number;
  description: string;
}

interface InvestmentsChartProps {
  sales: ChartEntry[];
  investments: ChartEntry[];
  labels: string[];
  summaryLabel: string;
  title: string;
}

export default function InvestmentsChart({
  sales,
  investments,
  labels,
  summaryLabel,
  title,
}: Readonly<InvestmentsChartProps>) {
  const totalSales = sales.reduce(
    (acc, item) => acc + (Number(item.value) || 0),
    0,
  );
  const totalInvestments = investments.reduce(
    (acc, item) => acc + (Number(item.value) || 0),
    0,
  );

  const data = {
    labels,
    datasets: [
      {
        label: "Lucro (Vendas)",
        data: labels.map((l) => sales.find((s) => s.label === l)?.value || 0),
        borderColor: "rgb(34,197,94)",
        backgroundColor: "rgba(34,197,94,0.2)",
        tension: 0.3,
        pointRadius: 5,
        pointHoverRadius: 7,
        pointBackgroundColor: "rgb(34,197,94)",
        pointBorderColor: "rgb(34,197,94)",
        fill: false,
      },
      {
        label: "Investimentos",
        data: labels.map(
          (l) => investments.find((i) => i.label === l)?.value || 0,
        ),
        borderColor: "rgb(239,68,68)",
        backgroundColor: "rgba(239,68,68,0.2)",
        tension: 0.3,
        pointRadius: 5,
        pointHoverRadius: 7,
        pointBackgroundColor: "rgb(239,68,68)",
        pointBorderColor: "rgb(239,68,68)",
        fill: false,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top" as const,
      },
      title: {
        display: true,
        text: title,
      },
      tooltip: {
        callbacks: {
          label: function (context: any) {
            const entry =
              context.dataset.label === "Lucro (Vendas)"
                ? sales.find((s) => s.label === context.label)
                : investments.find((i) => i.label === context.label);
            return `${context.dataset.label}: R$ ${context.parsed.y.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} - ${entry?.description || ""}`;
          },
        },
      },
    },
    interaction: {
      mode: "nearest" as const,
      intersect: false,
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
        <div className="text-sm text-gray-600">{summaryLabel}</div>
        <div className="flex flex-wrap gap-2">
          <span className="px-3 py-1 rounded-full bg-green-50 text-green-700 text-xs font-medium">
            Lucro:{" "}
            {totalSales.toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            })}
          </span>
          <span className="px-3 py-1 rounded-full bg-red-50 text-red-700 text-xs font-medium">
            Investimentos:{" "}
            {totalInvestments.toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            })}
          </span>
        </div>
      </div>
      <div className="h-80">
        <Line data={data} options={options} />
      </div>
    </div>
  );
}
