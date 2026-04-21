"use client";

import axios from "axios";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";

interface Sale {
  id: string;
  description: string;
  massGrams: number;
  saleValue: number;
  isPrintConcluded: boolean;
  saleDate?: string;
  printStatus?: string;
  wastedFilamentGrams?: number | null;
  incidents?: Array<{
    timestamp: string;
    reason: string;
    comment: string;
    wastedFilamentGrams?: number | null;
  }>;
  printStartScheduledAt?: string;
  printStartConfirmedAt?: string;
}

const INCIDENT_REASONS: Record<string, string> = {
  PowerLoss: "Queda de Energia",
  FilamentJam: "Entupimento/Trava de Filamento",
  LayerShift: "Deslocamento de Camada",
  AdhesionIssue: "Problema de Aderência",
  ManualPause: "Pausa Manual",
  Maintenance: "Manutenção",
  Other: "Outro",
};

export default function EditFilamentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { id } = use(params);
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState<Sale[]>([]);

  const [formData, setFormData] = useState({
    description: "",
    link: "",
    price: 0,
    initialMassGrams: 0,
    remainingMassGrams: 0,
    color: "",
    colorHex: "#000000",
    type: "PLA",
    isNozzle02Compatible: false,
    warningComment: "",
    slicingProfile3mfPath: "",
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [filamentRes, salesRes] = await Promise.all([
          axios.get(`http://localhost:5000/api/filaments/${id}`),
          axios.get(`http://localhost:5000/api/filaments/${id}/sales`),
        ]);
        setFormData({
          description: filamentRes.data.description || "",
          link: filamentRes.data.link || "",
          price: filamentRes.data.price ?? 0,
          initialMassGrams: filamentRes.data.initialMassGrams ?? 0,
          remainingMassGrams: filamentRes.data.remainingMassGrams ?? 0,
          color: filamentRes.data.color || "",
          colorHex: filamentRes.data.colorHex || "#000000",
          type: filamentRes.data.type || "PLA",
          isNozzle02Compatible: Boolean(filamentRes.data.isNozzle02Compatible),
          warningComment: filamentRes.data.warningComment || "",
          slicingProfile3mfPath: filamentRes.data.slicingProfile3mfPath || "",
        });
        setSales(salesRes.data);
        setLoading(false);
      } catch (err) {
        console.error(err);
        alert("Erro ao carregar dados");
        router.push("/filaments");
      }
    };
    fetchData();
  }, [id, router]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const target = e.target as HTMLInputElement;
    const nextValue =
      target.type === "checkbox" ? target.checked : target.value;
    setFormData((prev) => ({ ...prev, [target.name]: nextValue }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        description: formData.description,
        link: formData.link,
        price: formData.price,
        initialMassGrams: formData.initialMassGrams,
        remainingMassGrams: formData.remainingMassGrams,
        color: formData.color,
        colorHex: formData.colorHex,
        type: formData.type,
        isNozzle02Compatible: formData.isNozzle02Compatible,
        warningComment: formData.warningComment,
        slicingProfile3mfPath: formData.slicingProfile3mfPath,
      };
      await axios.put(`http://localhost:5000/api/filaments/${id}`, payload);
      router.push("/filaments");
    } catch (error) {
      console.error("Error updating filament:", error);
      alert("Erro ao atualizar filamento");
    } finally {
      setLoading(false);
    }
  };

  const formatSaleDate = (date?: string) => {
    return date
      ? new Date(date).toLocaleDateString("pt-BR")
      : "Data não informada";
  };

  const formatIncidentTimestamp = (timestamp?: string) => {
    return timestamp
      ? new Date(timestamp).toLocaleString("pt-BR")
      : "Sem data";
  };

  const getSaleStatusLabel = (sale: Sale) => {
    return sale.isPrintConcluded ? "Concluído" : sale.printStatus || "Pendente";
  };

  const getSaleStatusClassName = (sale: Sale) => {
    return sale.isPrintConcluded
      ? "bg-green-100 text-green-800"
      : "bg-yellow-100 text-yellow-800";
  };

  const renderIncidents = (sale: Sale, compact = false) => {
    if (!sale.incidents || sale.incidents.length === 0) {
      return (
        <span className="text-xs text-gray-400">Nenhuma falha registrada.</span>
      );
    }

    return (
      <div className={compact ? "max-h-44 space-y-3 overflow-y-auto pr-1" : "space-y-3"}>
        {sale.incidents.map((incident, index) => (
          <div
            key={`${sale.id}-${incident.timestamp}-${index}`}
            className="rounded-lg border border-amber-100 bg-amber-50/70 px-3 py-2"
          >
            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
              <span className="text-xs font-semibold text-amber-800">
                {INCIDENT_REASONS[incident.reason] || incident.reason}
              </span>
              <span className="text-[11px] text-gray-500">
                {formatIncidentTimestamp(incident.timestamp)}
              </span>
            </div>
            <p className="mt-1 wrap-break-word text-xs text-gray-700">
              {incident.comment || "Sem comentário adicional."}
            </p>
            {typeof incident.wastedFilamentGrams === "number" &&
            incident.wastedFilamentGrams > 0 ? (
              <p className="mt-1 text-[11px] font-medium text-amber-700">
                Desperdício: {incident.wastedFilamentGrams} g
              </p>
            ) : null}
          </div>
        ))}
      </div>
    );
  };

  if (loading) return <div className="text-center py-12">Carregando...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-brand-purple mb-8 border-b-2 border-brand-orange pb-4">
          Editar Filamento
        </h1>

        <form
          onSubmit={handleSubmit}
          className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 space-y-6"
        >
          {/* Tipo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tipo
            </label>
            <select
              name="type"
              value={formData.type}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-transparent text-gray-900"
              required
            >
              <option value="PLA">PLA</option>
              <option value="PLA-highSpeed">PLA-highSpeed</option>
              <option value="PLA Silk">PLA Silk</option>
              <option value="PETG">PETG</option>
              <option value="ABS">ABS</option>
              <option value="TPU">TPU</option>
              <option value="Nylon">Nylon</option>
              <option value="Outro">Outro</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              name="isNozzle02Compatible"
              checked={formData.isNozzle02Compatible}
              onChange={handleChange}
              className="w-5 h-5 text-brand-purple rounded focus:ring-brand-purple"
            />
            <span className="text-sm text-gray-700">
              Compativel com bico 0.2 mm
            </span>
          </div>
          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descrição / Marca
            </label>
            <input
              type="text"
              name="description"
              required
              value={formData.description}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-transparent text-gray-900"
            />
          </div>

          {/* Color */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cor
            </label>
            <div className="flex gap-4 items-center">
              <div className="relative flex-1">
                <input
                  type="text"
                  name="color"
                  required
                  placeholder="Ex: Vermelho Seda"
                  value={formData.color}
                  onChange={handleChange}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-transparent text-gray-900"
                />
              </div>
              <div className="flex flex-col items-center">
                <input
                  type="color"
                  name="colorHex"
                  value={formData.colorHex || "#000000"}
                  onChange={handleChange}
                  className="h-10 w-14 p-1 border border-gray-300 rounded cursor-pointer"
                  title="Escolher cor visual"
                />
                <span className="text-xs text-gray-500 mt-1">Visual</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-6">
            {/* Price */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Preço (R$)
              </label>
              <input
                type="number"
                name="price"
                step="0.01"
                required
                value={formData.price}
                onChange={handleChange}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-transparent text-gray-900"
              />
            </div>

            {/* Initial Mass */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Massa Inicial (g)
              </label>
              <input
                type="number"
                name="initialMassGrams"
                required
                value={formData.initialMassGrams}
                onChange={handleChange}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-transparent text-gray-900"
              />
            </div>

            {/* Remaining Mass */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Massa Restante (g)
              </label>
              <input
                type="number"
                name="remainingMassGrams"
                required
                value={formData.remainingMassGrams}
                onChange={handleChange}
                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-transparent text-gray-900"
              />
            </div>
          </div>

          {/* Link */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Link de Compra
            </label>
            <input
              type="url"
              name="link"
              value={formData.link}
              onChange={handleChange}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-transparent text-gray-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ressalvas de Fatiamento (warning)
            </label>
            <textarea
              name="warningComment"
              value={formData.warningComment}
              onChange={handleChange}
              rows={3}
              placeholder="Ex: precisa de perfil X, reduzir velocidade, usar brim..."
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-transparent text-gray-900"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Arquivo 3MF de Exemplo (caminho)
            </label>
            <input
              type="text"
              name="slicingProfile3mfPath"
              value={formData.slicingProfile3mfPath}
              onChange={handleChange}
              placeholder="Ex: C:\\perfis\\filamento_x.3mf"
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-transparent text-gray-900"
            />
          </div>

          <div className="flex justify-end gap-4 pt-6">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-brand-purple text-white rounded-lg hover:bg-purple-800 transition-colors disabled:opacity-50"
            >
              {loading ? "Salvando..." : "Salvar Alterações"}
            </button>
          </div>
        </form>
      </div>

      {/* Sales History */}
      <div>
        <h2 className="text-2xl font-bold text-brand-purple mb-4">
          Histórico de Uso
        </h2>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="divide-y divide-gray-200 md:hidden">
            {sales.map((sale) => (
              <article key={sale.id} className="space-y-4 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="wrap-break-word text-sm font-semibold text-gray-900">
                      {sale.description}
                    </h3>
                    <p className="mt-1 text-xs text-gray-500">
                      {formatSaleDate(sale.saleDate)}
                    </p>
                  </div>
                  <span
                    className={`inline-flex shrink-0 rounded-full px-2 py-1 text-xs font-semibold ${getSaleStatusClassName(sale)}`}
                  >
                    {getSaleStatusLabel(sale)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-gray-50 px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">
                      Consumo
                    </p>
                    <div className="mt-1 text-sm font-semibold text-gray-900">
                      {sale.massGrams}g
                    </div>
                    {typeof sale.wastedFilamentGrams === "number" &&
                    sale.wastedFilamentGrams > 0 ? (
                      <div className="mt-1 text-xs font-medium text-amber-700">
                        + {sale.wastedFilamentGrams}g desperdiçados
                      </div>
                    ) : null}
                  </div>

                  <div className="rounded-lg bg-gray-50 px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">
                      Valor venda
                    </p>
                    <div className="mt-1 text-sm font-semibold text-gray-900">
                      R$ {sale.saleValue.toFixed(2)}
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">
                    Falhas e Desperdício
                  </p>
                  <div className="mt-3">{renderIncidents(sale, true)}</div>
                </div>
              </article>
            ))}

            {sales.length === 0 && (
              <div className="px-6 py-4 text-center text-sm text-gray-500">
                Nenhuma venda registrada com este filamento.
              </div>
            )}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Venda
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Consumo (g)
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Valor Venda
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Falhas e Desperdício
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sales.map((sale) => (
                  <tr key={sale.id}>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div className="font-medium">{sale.description}</div>
                      <div className="mt-1 text-xs text-gray-500">
                        {formatSaleDate(sale.saleDate)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                      <div>{sale.massGrams}g</div>
                      {typeof sale.wastedFilamentGrams === "number" &&
                      sale.wastedFilamentGrams > 0 ? (
                        <div className="mt-1 text-xs font-medium text-amber-700">
                          + {sale.wastedFilamentGrams}g desperdiçados
                        </div>
                      ) : null}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      R$ {sale.saleValue.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex rounded-full px-2 text-xs leading-5 font-semibold ${getSaleStatusClassName(sale)}`}
                      >
                        {getSaleStatusLabel(sale)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {renderIncidents(sale)}
                    </td>
                  </tr>
                ))}
                {sales.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-6 py-4 text-center text-sm text-gray-500"
                    >
                      Nenhuma venda registrada com este filamento.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
