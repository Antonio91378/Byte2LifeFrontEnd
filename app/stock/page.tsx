"use client";

import { useDialog } from "@/context/DialogContext";
import { resolveAssetUrl } from "@/utils/api";
import axios from "axios";
import Link from "next/link";
import { useEffect, useState } from "react";

interface StockItem {
  id: string;
  description: string;
  filamentId: string;
  printTime: string;
  weightGrams: number;
  cost: number; // Sale Price
  productionCost: number; // Production Cost
  photos: string[];
  status: string;
  printQuality: string;
  nozzleDiameter?: string;
  layerHeight?: string;
  hasCustomArt: boolean;
  hasPainting: boolean;
  hasVarnish: boolean;
}

interface Filament {
  id: string;
  description: string;
  color: string;
}

export default function StockPage() {
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [filaments, setFilaments] = useState<Filament[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selectedItem, setSelectedItem] = useState<StockItem | null>(null);
  const { showConfirm, showAlert } = useDialog();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [stockRes, filamentsRes] = await Promise.all([
          axios.get("http://localhost:5000/api/stock"),
          axios.get("http://localhost:5000/api/filaments"),
        ]);
        setStockItems(stockRes.data);
        setFilaments(filamentsRes.data);
      } catch (error) {
        console.error("Error fetching stock data", error);
      }
    };
    fetchData();
  }, []);

  const getFilamentName = (id: string) => {
    const filament = filaments.find((f) => f.id === id);
    return filament
      ? `${filament.description} (${filament.color})`
      : "Desconhecido";
  };

  const handleDelete = (id: string) => {
    showConfirm(
      "Excluir Item",
      "Tem certeza que deseja excluir este item do estoque?",
      async () => {
        try {
          await axios.delete(`http://localhost:5000/api/stock/${id}`);
          setStockItems(stockItems.filter((item) => item.id !== id));
          if (selectedItem?.id === id) setSelectedItem(null);
          showAlert("Sucesso", "Item excluído com sucesso!", "success");
        } catch (error) {
          console.error(error);
          showAlert("Erro", "Erro ao excluir item", "error");
        }
      },
    );
  };

  const filteredItems = stockItems.filter((item) => {
    const matchesSearch = item.description
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesStatus =
      statusFilter === "All" || item.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-8 relative">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 border-b-2 border-brand-orange pb-4 md:flex-row md:items-center">
        <h1 className="text-3xl font-bold text-brand-purple">
          Estoque de Impressões
        </h1>

        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center md:w-auto md:justify-end md:gap-4">
          <div className="relative w-full md:w-64">
            <input
              type="text"
              placeholder="Buscar item..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-gray-300 bg-white py-3 pl-10 pr-4 text-gray-900 placeholder-gray-500 focus:border-brand-purple focus:ring-brand-purple"
            />
            <svg
              className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              ></path>
            </svg>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 focus:border-brand-purple focus:ring-brand-purple sm:w-auto"
          >
            <option value="All" className="text-gray-900">
              Todos os Status
            </option>
            <option value="Available" className="text-gray-900">
              Disponíveis
            </option>
            <option value="Sold" className="text-gray-900">
              Vendidos
            </option>
          </select>

          <Link
            href="/stock/new"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-purple px-4 py-3 text-white shadow-md transition-colors hover:bg-purple-800 sm:w-auto"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 4v16m8-8H4"
              ></path>
            </svg>
            Novo Item
          </Link>
        </div>
      </div>

      {/* Grid */}
      {filteredItems.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
            ></path>
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">
            Nenhum item encontrado
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Tente ajustar os filtros ou adicione um novo item.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredItems.map((item) => (
            <StockCard
              key={item.id}
              item={item}
              getFilamentName={getFilamentName}
              onDelete={handleDelete}
              onSelect={() => setSelectedItem(item)}
            />
          ))}
        </div>
      )}

      {/* Side Drawer */}
      <SideDrawer
        item={selectedItem}
        isOpen={!!selectedItem}
        onClose={() => setSelectedItem(null)}
        getFilamentName={getFilamentName}
      />
    </div>
  );
}

function StockCard({
  item,
  getFilamentName,
  onDelete,
  onSelect,
}: Readonly<{
  item: StockItem;
  getFilamentName: (id: string) => string;
  onDelete: (id: string) => void;
  onSelect: () => void;
}>) {
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);

  const nextPhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.photos && item.photos.length > 1) {
      setCurrentPhotoIndex((prev) => (prev + 1) % item.photos.length);
    }
  };

  const prevPhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.photos && item.photos.length > 1) {
      setCurrentPhotoIndex(
        (prev) => (prev - 1 + item.photos.length) % item.photos.length,
      );
    }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-lg transition-all hover:-translate-y-1 hover:shadow-xl">
      <button
        type="button"
        onClick={onSelect}
        className="absolute inset-0 z-10 rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple/40"
        aria-label={`Abrir detalhes de ${item.description}`}
      />

      <div className="group relative h-48 overflow-hidden bg-gray-100 sm:h-52">
        {item.photos && item.photos.length > 0 ? (
          <>
            <img
              src={resolveAssetUrl(item.photos[currentPhotoIndex])}
              alt={item.description}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            />
            {item.photos.length > 1 && (
              <>
                <button
                  onClick={prevPhoto}
                  aria-label="Foto anterior"
                  className="absolute left-2 top-1/2 z-20 rounded-full bg-black/55 p-2 text-white opacity-100 transition-opacity hover:bg-black/70 sm:-translate-y-1/2 sm:opacity-0 sm:group-hover:opacity-100"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M15 19l-7-7 7-7"
                    ></path>
                  </svg>
                </button>
                <button
                  onClick={nextPhoto}
                  aria-label="Próxima foto"
                  className="absolute right-2 top-1/2 z-20 rounded-full bg-black/55 p-2 text-white opacity-100 transition-opacity hover:bg-black/70 sm:-translate-y-1/2 sm:opacity-0 sm:group-hover:opacity-100"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M9 5l7 7-7 7"
                    ></path>
                  </svg>
                </button>
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                  {item.photos.map((photo, idx) => (
                    <div
                      key={photo}
                      className={`w-1.5 h-1.5 rounded-full ${idx === currentPhotoIndex ? "bg-white" : "bg-white/50"}`}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            <svg
              className="w-12 h-12"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              ></path>
            </svg>
          </div>
        )}
        <div className="absolute top-2 right-2">
          <span
            className={`px-2 py-1 text-xs font-bold rounded-full ${item.status === "Available" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}
          >
            {item.status === "Available" ? "Disponível" : "Vendido"}
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3
          className="mb-2 wrap-break-word text-lg font-bold leading-snug text-gray-800"
          title={item.description}
        >
          {item.description}
        </h3>
        <p className="mb-4 text-sm leading-snug text-gray-500 wrap-break-word">
          {getFilamentName(item.filamentId)}
        </p>

        <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 mb-4">
          <div>
            <span className="block text-xs text-gray-400 uppercase">
              Custo Prod.
            </span>
            <span className="font-medium text-gray-700">
              R$ {(item.productionCost || 0).toFixed(2)}
            </span>
          </div>
          <div>
            <span className="block text-xs text-gray-400 uppercase">
              Valor Sugerido
            </span>
            <span className="font-bold text-green-600">
              R$ {item.cost.toFixed(2)}
            </span>
          </div>
        </div>

        <div className="relative z-20 mt-auto flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4">
          <Link
            href={`/sales/new?stockId=${item.id}`}
            onClick={(e) => e.stopPropagation()}
            className="flex min-h-11 flex-1 items-center justify-center gap-1 rounded-xl bg-brand-purple px-4 py-2.5 text-center text-sm font-medium text-white transition-colors hover:bg-purple-800"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              ></path>
            </svg>
            Vender
          </Link>
          <Link
            href={`/stock/${item.id}`}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl border border-blue-100 px-3 py-2.5 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-50"
            title="Editar"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              ></path>
            </svg>
            <span className="sm:hidden">Editar</span>
          </Link>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(item.id);
            }}
            className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl border border-red-100 px-3 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
            title="Excluir"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              ></path>
            </svg>
            <span className="sm:hidden">Excluir</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function SideDrawer({
  item,
  isOpen,
  onClose,
  getFilamentName,
}: Readonly<{
  item: StockItem | null;
  isOpen: boolean;
  onClose: () => void;
  getFilamentName: (id: string) => string;
}>) {
  if (!item) return null;

  return (
    <>
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Fechar detalhes do item"
        className={`fixed inset-0 bg-black/30 backdrop-blur-sm z-40 transition-opacity duration-300 ${isOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 z-50 h-full w-full overflow-y-auto bg-white shadow-2xl transition-transform duration-300 ease-in-out ${isOpen ? "translate-x-0" : "translate-x-full"} md:w-120`}
      >
        <div className="space-y-5 p-5 sm:space-y-6 sm:p-6">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="wrap-break-word text-xl font-bold text-gray-900 sm:text-2xl">
                {item.description}
              </h2>
              <p className="mt-1 text-sm text-gray-500 wrap-break-word">
                ID: {item.id}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <svg
                className="w-6 h-6 text-gray-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M6 18L18 6M6 6l12 12"
                ></path>
              </svg>
            </button>
          </div>

          {/* Main Image */}
          <div className="aspect-video bg-gray-100 rounded-xl overflow-hidden">
            {item.photos && item.photos.length > 0 ? (
              <img
                src={resolveAssetUrl(item.photos[0])}
                alt={item.description}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                <svg
                  className="w-16 h-16"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  ></path>
                </svg>
              </div>
            )}
          </div>

          {/* Gallery Grid if more than 1 photo */}
          {item.photos && item.photos.length > 1 && (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {item.photos.map((photo) => (
                <div
                  key={photo}
                  className="aspect-square rounded-lg overflow-hidden border border-gray-200"
                >
                  <img
                    src={resolveAssetUrl(photo)}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Details Grid */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
            <div className="bg-gray-50 p-4 rounded-xl">
              <span className="block text-xs text-gray-500 uppercase font-bold mb-1">
                Filamento
              </span>
              <span className="text-gray-900 font-medium">
                {getFilamentName(item.filamentId)}
              </span>
            </div>
            <div className="bg-gray-50 p-4 rounded-xl">
              <span className="block text-xs text-gray-500 uppercase font-bold mb-1">
                Peso
              </span>
              <span className="text-gray-900 font-medium">
                {item.weightGrams}g
              </span>
            </div>
            <div className="bg-gray-50 p-4 rounded-xl">
              <span className="block text-xs text-gray-500 uppercase font-bold mb-1">
                Tempo de Impressão
              </span>
              <span className="text-gray-900 font-medium">
                {item.printTime}
              </span>
            </div>
            <div className="bg-gray-50 p-4 rounded-xl">
              <span className="block text-xs text-gray-500 uppercase font-bold mb-1">
                Qualidade
              </span>
              <span className="text-gray-900 font-medium">
                {item.printQuality || "Normal"}
              </span>
            </div>
            <div className="bg-gray-50 p-4 rounded-xl">
              <span className="block text-xs text-gray-500 uppercase font-bold mb-1">
                Nozzle
              </span>
              <span className="text-gray-900 font-medium">
                {item.nozzleDiameter || "-"}
              </span>
            </div>
            <div className="bg-gray-50 p-4 rounded-xl">
              <span className="block text-xs text-gray-500 uppercase font-bold mb-1">
                Camada
              </span>
              <span className="text-gray-900 font-medium">
                {item.layerHeight || "-"}
              </span>
            </div>
          </div>

          {/* Financials */}
          <div className="border-t border-gray-100 pt-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Financeiro</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
              <div className="p-4 rounded-xl border border-gray-200">
                <span className="block text-xs text-gray-500 uppercase font-bold mb-1">
                  Custo de Produção
                </span>
                <span className="text-xl font-bold text-gray-700">
                  R$ {(item.productionCost || 0).toFixed(2)}
                </span>
              </div>
              <div className="p-4 rounded-xl bg-green-50 border border-green-100">
                <span className="block text-xs text-green-600 uppercase font-bold mb-1">
                  Valor de Venda
                </span>
                <span className="text-xl font-bold text-green-700">
                  R$ {item.cost.toFixed(2)}
                </span>
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-2 rounded-xl border border-blue-100 bg-blue-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm font-medium text-blue-800">
                Lucro Estimado
              </span>
              <span className="text-lg font-bold text-blue-900">
                R$ {(item.cost - (item.productionCost || 0)).toFixed(2)}
              </span>
            </div>
          </div>

          {/* Extras */}
          <div className="border-t border-gray-100 pt-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              Acabamentos
            </h3>
            <div className="flex flex-wrap gap-2.5">
              <span
                className={`px-3 py-1 rounded-full text-sm font-medium ${item.hasCustomArt ? "bg-purple-100 text-purple-800" : "bg-gray-100 text-gray-400"}`}
              >
                Arte Personalizada
              </span>
              <span
                className={`px-3 py-1 rounded-full text-sm font-medium ${item.hasPainting ? "bg-purple-100 text-purple-800" : "bg-gray-100 text-gray-400"}`}
              >
                Pintura
              </span>
              <span
                className={`px-3 py-1 rounded-full text-sm font-medium ${item.hasVarnish ? "bg-purple-100 text-purple-800" : "bg-gray-100 text-gray-400"}`}
              >
                Verniz
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-auto flex flex-col gap-3 pt-6 sm:flex-row">
            <Link
              href={`/sales/new?stockId=${item.id}`}
              className="flex-1 rounded-xl bg-brand-purple py-3 text-center font-bold text-white shadow-lg transition-all hover:bg-purple-800 hover:shadow-xl"
            >
              Vender Item
            </Link>
            <Link
              href={`/stock/${item.id}`}
              className="rounded-xl border border-gray-300 px-6 py-3 text-center font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              Editar
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
