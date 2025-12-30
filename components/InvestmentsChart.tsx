"use client";
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import 'chart.js/auto';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

interface ChartEntry {
  label: string;
  value: number;
  description: string;
}

interface InvestmentsChartProps {
  sales: ChartEntry[];
  investments: ChartEntry[];
  month: string;
}

export default function InvestmentsChart({ sales, investments, month }: InvestmentsChartProps) {
  const totalSales = sales.reduce((acc, item) => acc + (Number(item.value) || 0), 0);
  const totalInvestments = investments.reduce((acc, item) => acc + (Number(item.value) || 0), 0);

  // Gera todos os dias do mês selecionado
  function getAllDaysOfMonth(month: string) {
    const [year, m] = month.split('-').map(Number);
    const days: string[] = [];
    const date = new Date(year, m - 1, 1);
    while (date.getMonth() === m - 1) {
      days.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`);
      date.setDate(date.getDate() + 1);
    }
    return days;
  }

  const labels = getAllDaysOfMonth(month);

  const data = {
    labels,
    datasets: [
      {
        label: 'Lucro (Vendas)',
        data: labels.map(l => sales.find(s => s.label === l)?.value || 0),
        borderColor: 'rgb(34,197,94)',
        backgroundColor: 'rgba(34,197,94,0.2)',
        tension: 0.3,
        pointRadius: 5,
        pointHoverRadius: 7,
        pointBackgroundColor: 'rgb(34,197,94)',
        pointBorderColor: 'rgb(34,197,94)',
        fill: false,
      },
      {
        label: 'Investimentos',
        data: labels.map(l => investments.find(i => i.label === l)?.value || 0),
        borderColor: 'rgb(239,68,68)',
        backgroundColor: 'rgba(239,68,68,0.2)',
        tension: 0.3,
        pointRadius: 5,
        pointHoverRadius: 7,
        pointBackgroundColor: 'rgb(239,68,68)',
        pointBorderColor: 'rgb(239,68,68)',
        fill: false,
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: `Lucro x Investimentos - ${month}`,
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            const entry =
              context.dataset.label === 'Lucro (Vendas)'
                ? sales.find(s => s.label === context.label)
                : investments.find(i => i.label === context.label);
            return `${context.dataset.label}: R$ ${context.parsed.y.toLocaleString('pt-BR', {minimumFractionDigits: 2})} - ${entry?.description || ''}`;
          },
        },
      },
    },
    interaction: {
      mode: 'nearest' as const,
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
        <div className="text-sm text-gray-600">Resumo do mes</div>
        <div className="flex flex-wrap gap-2">
          <span className="px-3 py-1 rounded-full bg-green-50 text-green-700 text-xs font-medium">
            Lucro: {totalSales.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </span>
          <span className="px-3 py-1 rounded-full bg-red-50 text-red-700 text-xs font-medium">
            Investimentos: {totalInvestments.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </span>
        </div>
      </div>
      <Line data={data} options={options} height={100} />
    </div>
  );
}
