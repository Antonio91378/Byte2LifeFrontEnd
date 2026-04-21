"use client";

import { useEffect, useMemo, useRef, useState } from "react";

interface FilamentOption {
  id: string;
  description: string;
  color: string;
  colorHex?: string;
  type?: string;
  remainingMassGrams?: number;
  price?: number;
}

interface FilamentSelectProps {
  id?: string;
  filaments: FilamentOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
  loadingMessage?: string;
  emptyMessage?: string;
  showRemaining?: boolean;
  showPrice?: boolean;
  showType?: boolean;
}

const normalizeValue = (value?: string) => (value || "").trim().toLowerCase();

const toSoftColor = (hex?: string) => {
  if (!hex) return undefined;

  const normalized = hex.replace("#", "");
  let r = 0;
  let g = 0;
  let b = 0;

  if (normalized.length === 3) {
    r = Number.parseInt(normalized[0] + normalized[0], 16);
    g = Number.parseInt(normalized[1] + normalized[1], 16);
    b = Number.parseInt(normalized[2] + normalized[2], 16);
  } else if (normalized.length === 6) {
    r = Number.parseInt(normalized.slice(0, 2), 16);
    g = Number.parseInt(normalized.slice(2, 4), 16);
    b = Number.parseInt(normalized.slice(4, 6), 16);
  } else {
    return undefined;
  }

  return `rgba(${r}, ${g}, ${b}, 0.12)`;
};

export default function FilamentSelect({
  id,
  filaments,
  value,
  onChange,
  placeholder = "Selecione um filamento...",
  disabled = false,
  loading = false,
  loadingMessage = "Buscando filamentos...",
  emptyMessage = "Nenhum filamento encontrado.",
  showRemaining = false,
  showPrice = false,
  showType = true,
}: Readonly<FilamentSelectProps>) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [colorFilter, setColorFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const listboxId = id ? `${id}-listbox` : undefined;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        !wrapperRef.current ||
        wrapperRef.current.contains(event.target as Node)
      ) {
        return;
      }

      setOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (disabled) {
      setOpen(false);
    }
  }, [disabled]);

  const selected = filaments.find((item) => item.id === value);
  const colors = useMemo(() => {
    const list = Array.from(
      new Set(filaments.map((item) => item.color).filter(Boolean)),
    );
    return list.sort((firstColor, secondColor) =>
      firstColor.localeCompare(secondColor),
    );
  }, [filaments]);

  const types = useMemo(() => {
    const list = Array.from(
      new Set(filaments.map((item) => item.type || "").filter(Boolean)),
    );
    return list.sort((firstType, secondType) =>
      firstType.localeCompare(secondType),
    );
  }, [filaments]);

  const filtered = useMemo(() => {
    const normalizedSearch = normalizeValue(search);

    return filaments.filter((item) => {
      if (colorFilter !== "all" && item.color !== colorFilter) {
        return false;
      }

      if (typeFilter !== "all" && item.type !== typeFilter) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const target =
        `${item.description} ${item.color} ${item.type || ""}`.toLowerCase();
      return target.includes(normalizedSearch);
    });
  }, [filaments, colorFilter, typeFilter, search]);

  const handleSelect = (nextId: string) => {
    onChange(nextId);
    setOpen(false);
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-controls={listboxId}
        aria-haspopup="listbox"
        className={`w-full flex items-center justify-between gap-3 border border-gray-300 rounded-lg px-3 py-2 text-left transition-colors ${
          disabled
            ? "bg-gray-100 text-gray-500 cursor-not-allowed"
            : "bg-white hover:border-brand-purple"
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          {selected ? (
            <>
              <span
                className="w-3 h-3 rounded-full border border-gray-200 shadow-sm"
                style={{ backgroundColor: selected.colorHex || "#d1d5db" }}
              ></span>
              <span className="truncate text-gray-900">
                {selected.description}
              </span>
              <span className="text-xs text-gray-500">({selected.color})</span>
            </>
          ) : loading ? (
            <>
              <svg
                className="w-4 h-4 animate-spin text-brand-purple"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                ></path>
              </svg>
              <span className="text-gray-500 truncate">{loadingMessage}</span>
            </>
          ) : (
            <span className="text-gray-500 truncate">{placeholder}</span>
          )}
        </div>
        <svg
          className="w-4 h-4 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M19 9l-7 7-7-7"
          ></path>
        </svg>
      </button>

      {open && (
        <div className="absolute z-30 mt-2 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
          <div className="p-3 border-b border-gray-100 space-y-2">
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={
                loading
                  ? "Aguardando resposta do backend..."
                  : "Buscar filamento..."
              }
              disabled={loading}
              className={`w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-brand-purple focus:outline-none ${loading ? "bg-gray-50 text-gray-400 cursor-wait" : "text-gray-900"}`}
            />
            <div className="flex gap-2">
              <select
                value={colorFilter}
                onChange={(event) => setColorFilter(event.target.value)}
                disabled={loading}
                className={`w-full rounded-md border border-gray-200 px-2 py-2 text-xs focus:border-brand-purple focus:outline-none ${loading ? "bg-gray-50 text-gray-400 cursor-wait" : "text-gray-700"}`}
              >
                <option value="all">Todas as cores</option>
                {colors.map((color) => (
                  <option key={color} value={color}>
                    {color}
                  </option>
                ))}
              </select>
              <select
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value)}
                disabled={loading}
                className={`w-full rounded-md border border-gray-200 px-2 py-2 text-xs focus:border-brand-purple focus:outline-none ${loading ? "bg-gray-50 text-gray-400 cursor-wait" : "text-gray-700"}`}
              >
                <option value="all">Todos os tipos</option>
                {types.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {loading ? (
            <div className="px-4 py-4">
              <div className="flex items-center gap-2 text-sm font-medium text-brand-purple">
                <svg
                  className="w-4 h-4 animate-spin"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  ></path>
                </svg>
                <span>{loadingMessage}</span>
              </div>
              <div className="mt-3 space-y-2 animate-pulse">
                {[0, 1, 2].map((index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-3"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="h-3 w-3 rounded-full bg-gray-200"></div>
                      <div className="min-w-0 flex-1 space-y-2">
                        <div
                          className={`h-3 rounded-full bg-gray-100 ${index === 1 ? "w-5/12" : "w-7/12"}`}
                        ></div>
                        <div
                          className={`h-2 rounded-full bg-gray-100 ${index === 2 ? "w-4/12" : "w-6/12"}`}
                        ></div>
                      </div>
                    </div>
                    <div className="h-3 w-16 rounded-full bg-gray-100"></div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <ul
              id={listboxId}
              role="listbox"
              className="max-h-64 overflow-y-auto"
            >
              {filtered.length === 0 && (
                <li className="px-4 py-3 text-sm text-gray-500">
                  {emptyMessage}
                </li>
              )}
              {filtered.map((item) => {
                const softColor = toSoftColor(item.colorHex);
                const rowStyle = softColor
                  ? { backgroundColor: softColor }
                  : undefined;

                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={item.id === value}
                      onClick={() => handleSelect(item.id)}
                      className="w-full flex items-center justify-between gap-3 px-4 py-2 text-left hover:bg-gray-50 transition-colors"
                      style={rowStyle}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className="w-3 h-3 rounded-full border border-gray-200 shadow-sm"
                          style={{
                            backgroundColor: item.colorHex || "#d1d5db",
                          }}
                        ></span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {item.description}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            {item.color}
                            {showType && item.type ? ` • ${item.type}` : ""}
                          </p>
                        </div>
                      </div>
                      <div className="text-xs text-gray-500 text-right">
                        {showRemaining &&
                          typeof item.remainingMassGrams === "number" && (
                            <div>{item.remainingMassGrams}g</div>
                          )}
                        {showPrice && typeof item.price === "number" && (
                          <div>R$ {item.price.toFixed(2)}/kg</div>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
