'use client';

import Modal from '@/components/Modal';
import { useDialog } from '@/context/DialogContext';
import axios from 'axios';
import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
const InvestmentsChart = dynamic(() => import('@/components/InvestmentsChart'), { ssr: false });
// Função utilitária para formatar ano-mês
function getMonthLabel(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Função utilitária para formatar ano-mês-dia
function getDayLabel(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getSaleDateStr(sale: any) {
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

function getSaleProfit(sale: any) {
  const raw = sale.profit ?? sale.Profit ?? 0;
  if (typeof raw === "number") return raw;
  const normalized = String(raw).replace(/\./g, "").replace(/,/, ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

// Agrega vendas por m??s
function aggregateSalesByMonth(sales: any[]) {
  const map = new Map<string, { value: number; description: string }>();
  sales.forEach(sale => {
    const dateStr = getSaleDateStr(sale);
    if (!dateStr) return;
    const label = getMonthLabel(dateStr);
    const prev = map.get(label) || { value: 0, description: "" };
    map.set(label, {
      value: prev.value + getSaleProfit(sale),
      description: `Lucro de ${label}`
    });
  });
  return Array.from(map.entries()).map(([label, { value, description }]) => ({ label, value, description }));
}

// Agrega vendas por dia de um m??s
function aggregateSalesByDay(sales: any[], month: string) {
  const map = new Map<string, { value: number; description: string }>();
  sales.forEach(sale => {
    const dateStr = getSaleDateStr(sale);
    if (!dateStr) return;
    if (getMonthLabel(dateStr) !== month) return;
    const label = getDayLabel(dateStr);
    const prev = map.get(label) || { value: 0, description: "" };
    map.set(label, {
      value: prev.value + getSaleProfit(sale),
      description: `Lucro em ${label}`
    });
  });
  return Array.from(map.entries()).map(([label, { value, description }]) => ({ label, value, description }));
}

// Agrega investimentos por mês
function aggregateInvestmentsByMonth(investments: Investment[]) {
  const map = new Map<string, { value: number; description: string }>();
  investments.forEach(inv => {
    const label = getMonthLabel(inv.date);
    const prev = map.get(label) || { value: 0, description: '' };
    map.set(label, {
      value: prev.value + inv.amount,
      description: `Investimentos de ${label}`
    });
  });
  return Array.from(map.entries()).map(([label, { value, description }]) => ({ label, value, description }));
}

// Agrega investimentos por dia de um mês
function aggregateInvestmentsByDay(investments: Investment[], month: string) {
  const map = new Map<string, { value: number; description: string }>();
  investments.forEach(inv => {
    if (getMonthLabel(inv.date) === month) {
      const label = getDayLabel(inv.date);
      const prev = map.get(label) || { value: 0, description: '' };
      map.set(label, {
        value: prev.value + inv.amount,
        description: `Investimento em ${label}`
      });
    }
  });
  return Array.from(map.entries()).map(([label, { value, description }]) => ({ label, value, description }));
}

interface Investment {
  id: string;
  description: string;
  amount: number;
  date: string;
  category: string;
}

export default function InvestmentsPage() {
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [totalProfit, setTotalProfit] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalInvestment, setTotalInvestment] = useState(0);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    description: '',
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    category: 'Geral'
  });

  // Dropdown de mês
  const [selectedMonth, setSelectedMonth] = useState<string>('');

  const { showAlert, showConfirm } = useDialog();

  const fetchData = async () => {
    try {
      const [salesRes, invRes] = await Promise.all([
        axios.get('http://localhost:5000/api/sales'),
        axios.get('http://localhost:5000/api/investments')
      ]);

      const profit = salesRes.data.reduce((acc: number, sale: any) => acc + getSaleProfit(sale), 0);
      const revenue = salesRes.data.reduce((acc: number, sale: any) => {
        const raw = sale.saleValue ?? sale.SaleValue ?? 0;
        if (typeof raw === "number") return acc + raw;
        const normalized = String(raw).replace(/\./g, "").replace(/,/, ".");
        const parsed = Number(normalized);
        return acc + (Number.isFinite(parsed) ? parsed : 0);
      }, 0);
      setTotalProfit(profit);
      setTotalRevenue(revenue);

      const invList = invRes.data.sort((a: Investment, b: Investment) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      const investmentTotal = invList.reduce((acc: number, inv: any) => acc + inv.amount, 0);
      setTotalInvestment(investmentTotal);
      setInvestments(invList);
    } catch (err) {
      console.error(err);
      showAlert('Erro', 'Falha ao carregar dados.', 'error');
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    fetchData();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await axios.put(`http://localhost:5000/api/investments/${editingId}`, formData);
      } else {
        await axios.post('http://localhost:5000/api/investments', formData);
      }
      setIsModalOpen(false);
      resetForm();
      fetchData();
    } catch (err) {
      console.error(err);
      showAlert('Erro', 'Falha ao salvar investimento.', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    showConfirm('Excluir Investimento', 'Tem certeza que deseja excluir este item?', async () => {
      try {
        await axios.delete(`http://localhost:5000/api/investments/${id}`);
        fetchData();
      } catch (err) {
        console.error(err);
        showAlert('Erro', 'Falha ao excluir.', 'error');
      }
    });
  };

  const handleEdit = (inv: Investment) => {
    setEditingId(inv.id);
    setFormData({
      description: inv.description,
      amount: inv.amount,
      date: inv.date.split('T')[0],
      category: inv.category
    });
    setIsModalOpen(true);
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      description: '',
      amount: 0,
      date: new Date().toISOString().split('T')[0],
      category: 'Geral'
    });
  };

  const balance = totalProfit - totalInvestment;
  const progress = totalInvestment > 0 ? (totalProfit / totalInvestment) * 100 : 0;



  // Estado para vendas
  const [sales, setSales] = useState<any[]>([]);

  // Buscar todas as vendas do backend uma vez
  useEffect(() => {
    axios.get('http://localhost:5000/api/sales')
      .then(res => setSales(res.data))
      .catch(() => setSales([]));
  }, []);

  // Determina todos os meses disponíveis a partir dos dados
  const allMonths = useMemo(() => {
    const monthsSet = new Set<string>();
    investments.forEach(inv => monthsSet.add(getMonthLabel(inv.date)));
    sales.forEach(sale => {
      const dateStr = getSaleDateStr(sale);
      if (dateStr) {
        monthsSet.add(getMonthLabel(dateStr));
      }
    });
    return Array.from(monthsSet).sort().reverse();
  }, [investments, sales]);

  // Seleciona mês atual por padrão
  useEffect(() => {
    if (!selectedMonth && allMonths.length > 0) {
      // Busca o mês atual no formato YYYY-MM
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      if (allMonths.includes(currentMonth)) {
        setSelectedMonth(currentMonth);
      } else {
        setSelectedMonth(allMonths[0]);
      }
    }
  }, [allMonths, selectedMonth]);

  // Dados agregados por dia do m??s selecionado
  const salesByDay = useMemo(() => {
    if (!selectedMonth) return [];
    return aggregateSalesByDay(sales, selectedMonth);
  }, [selectedMonth, sales]);
  const investmentsByDay = useMemo(() => {
    if (!selectedMonth) return [];
    return aggregateInvestmentsByDay(investments, selectedMonth);
  }, [selectedMonth, investments]);

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-0 pb-12">
      <div className="flex justify-between items-center mb-8 border-b-2 border-brand-orange pb-4">
        <h1 className="text-3xl font-bold text-brand-purple">Investimentos & ROI</h1>
        <button
          onClick={() => { resetForm(); setIsModalOpen(true); }}
          className="bg-brand-purple text-white px-4 py-2 rounded-lg hover:bg-purple-800 transition-colors flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
          Novo Investimento
        </button>
      </div>

      {/* Filtro de mês */}
      <div className="mb-4 flex items-center gap-2">
        <label className="font-medium text-gray-700">Mês:</label>
        <select
          className="p-2 border border-gray-300 rounded-lg text-gray-800 bg-white focus:ring-2 focus:ring-brand-purple focus:border-transparent"
          value={selectedMonth && allMonths.includes(selectedMonth) ? selectedMonth : (allMonths[0] || '')}
          onChange={e => setSelectedMonth(e.target.value)}
        >
          {allMonths.map(month => (
            <option key={month} value={month}>{month}</option>
          ))}
        </select>
      </div>

      {/* Gráfico Lucro x Investimentos diário */}
      <InvestmentsChart sales={salesByDay} investments={investmentsByDay} month={selectedMonth || ''} />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Total Profit */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-green-100 relative overflow-hidden">
          <div className="absolute right-0 top-0 p-4 opacity-10">
            <svg className="w-24 h-24 text-green-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 8.586 15.586 4H12z" clipRule="evenodd"></path></svg>
          </div>
          <h3 className="text-sm font-bold text-gray-500 uppercase mb-1">Lucro Bruto (Vendas)</h3>
          <p className="text-3xl font-bold text-green-600">
            {totalProfit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Receita Total: {totalRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
        </div>

        {/* Total Investment */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-red-100 relative overflow-hidden">
          <div className="absolute right-0 top-0 p-4 opacity-10">
            <svg className="w-24 h-24 text-red-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M12 13a1 1 0 100 2h5a1 1 0 001-1V9a1 1 0 10-2 0v2.586l-4.293-4.293a1 1 0 00-1.414 0L8 9.586 3.707 5.293a1 1 0 00-1.414 1.414l5 5a1 1 0 001.414 0L11 9.414 15.586 14H12z" clipRule="evenodd"></path></svg>
          </div>
          <h3 className="text-sm font-bold text-gray-500 uppercase mb-1">Investimento Total</h3>
          <p className="text-3xl font-bold text-red-600">
            {totalInvestment.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
        </div>

        {/* Balance / ROI */}
        <div className={`bg-white p-6 rounded-xl shadow-sm border relative overflow-hidden ${balance >= 0 ? 'border-brand-purple' : 'border-orange-200'}`}>
          <h3 className="text-sm font-bold text-gray-500 uppercase mb-1">Balanço (ROI)</h3>
          <p className={`text-3xl font-bold ${balance >= 0 ? 'text-brand-purple' : 'text-orange-600'}`}>
            {balance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
          <div className="mt-2 w-full bg-gray-200 rounded-full h-2.5">
            <div 
              className={`h-2.5 rounded-full ${balance >= 0 ? 'bg-green-500' : 'bg-orange-500'}`} 
              style={{ width: `${Math.min(progress, 100)}%` }}
            ></div>
          </div>
          <p className="text-xs text-gray-500 mt-1 text-right">{progress.toFixed(1)}% do investimento recuperado</p>
        </div>
      </div>

      {/* List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50">
          <h2 className="font-bold text-gray-700">Histórico de Investimentos</h2>
        </div>
        
        {investments.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            Nenhum investimento registrado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 text-gray-600 text-sm">
                  <th className="p-4 font-medium">Data</th>
                  <th className="p-4 font-medium">Descrição</th>
                  <th className="p-4 font-medium">Categoria</th>
                  <th className="p-4 font-medium text-right">Valor</th>
                  <th className="p-4 font-medium text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {investments.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4 text-gray-600 text-sm">
                      {new Date(inv.date).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="p-4 font-medium text-gray-800">{inv.description}</td>
                    <td className="p-4">
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                        {inv.category}
                      </span>
                    </td>
                    <td className="p-4 text-right font-bold text-red-600">
                      - {inv.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex justify-center gap-2">
                        <button 
                          onClick={() => handleEdit(inv)}
                          className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                          title="Editar"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                        </button>
                        <button 
                          onClick={() => handleDelete(inv.id)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded"
                          title="Excluir"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingId ? 'Editar Investimento' : 'Novo Investimento'}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
            <input
              type="text"
              required
              value={formData.description}
              onChange={e => setFormData({...formData, description: e.target.value})}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-transparent"
              placeholder="Ex: Impressora 3D"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Valor (R$)</label>
              <input
                type="number"
                required
                step="0.01"
                min="0"
                value={formData.amount}
                onChange={e => setFormData({...formData, amount: parseFloat(e.target.value)})}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
              <input
                type="date"
                required
                value={formData.date}
                onChange={e => setFormData({...formData, date: e.target.value})}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
            <select
              value={formData.category}
              onChange={e => setFormData({...formData, category: e.target.value})}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-transparent"
            >
              <option value="Geral">Geral</option>
              <option value="Equipamento">Equipamento</option>
              <option value="Material">Material</option>
              <option value="Manutenção">Manutenção</option>
              <option value="Marketing">Marketing</option>
              <option value="Outro">Outro</option>
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-brand-purple text-white rounded-lg hover:bg-purple-800"
            >
              Salvar
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
