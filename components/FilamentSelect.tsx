'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

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
  filaments: FilamentOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  showRemaining?: boolean;
  showPrice?: boolean;
  showType?: boolean;
}

const normalizeValue = (value?: string) => (value || '').trim().toLowerCase();
const toSoftColor = (hex?: string) => {
  if (!hex) return undefined;
  const normalized = hex.replace('#', '');
  let r = 0;
  let g = 0;
  let b = 0;

  if (normalized.length === 3) {
    r = parseInt(normalized[0] + normalized[0], 16);
    g = parseInt(normalized[1] + normalized[1], 16);
    b = parseInt(normalized[2] + normalized[2], 16);
  } else if (normalized.length === 6) {
    r = parseInt(normalized.slice(0, 2), 16);
    g = parseInt(normalized.slice(2, 4), 16);
    b = parseInt(normalized.slice(4, 6), 16);
  } else {
    return undefined;
  }

  return `rgba(${r}, ${g}, ${b}, 0.12)`;
};

export default function FilamentSelect({
  filaments,
  value,
  onChange,
  placeholder = 'Selecione um filamento...',
  disabled = false,
  showRemaining = false,
  showPrice = false,
  showType = true
}: FilamentSelectProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [colorFilter, setColorFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!wrapperRef.current || wrapperRef.current.contains(event.target as Node)) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (disabled) {
      setOpen(false);
    }
  }, [disabled]);

  const selected = filaments.find(item => item.id === value);
  const colors = useMemo(() => {
    const list = Array.from(new Set(filaments.map(item => item.color).filter(Boolean)));
    return list.sort((a, b) => a.localeCompare(b));
  }, [filaments]);
  const types = useMemo(() => {
    const list = Array.from(new Set(filaments.map(item => item.type || '').filter(Boolean)));
    return list.sort((a, b) => a.localeCompare(b));
  }, [filaments]);

  const filtered = useMemo(() => {
    const normalizedSearch = normalizeValue(search);
    return filaments.filter(item => {
      if (colorFilter !== 'all' && item.color !== colorFilter) {
        return false;
      }
      if (typeFilter !== 'all' && item.type !== typeFilter) {
        return false;
      }
      if (!normalizedSearch) {
        return true;
      }
      const target = `${item.description} ${item.color} ${item.type || ''}`.toLowerCase();
      return target.includes(normalizedSearch);
    });
  }, [filaments, colorFilter, typeFilter, search]);

  const handleSelect = (id: string) => {
    onChange(id);
    setOpen(false);
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(prev => !prev)}
        className={`w-full flex items-center justify-between gap-3 border border-gray-300 rounded-lg px-3 py-2 text-left transition-colors ${
          disabled ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'bg-white hover:border-brand-purple'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          {selected ? (
            <>
              <span
                className="w-3 h-3 rounded-full border border-gray-200 shadow-sm"
                style={{ backgroundColor: selected.colorHex || '#d1d5db' }}
              ></span>
              <span className="truncate text-gray-900">{selected.description}</span>
              <span className="text-xs text-gray-500">({selected.color})</span>
            </>
          ) : (
            <span className="text-gray-500 truncate">{placeholder}</span>
          )}
        </div>
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
        </svg>
      </button>

      {open && (
        <div className="absolute z-30 mt-2 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
          <div className="p-3 border-b border-gray-100 space-y-2">
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar filamento..."
              className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-brand-purple focus:outline-none"
            />
            <div className="flex gap-2">
              <select
                value={colorFilter}
                onChange={(event) => setColorFilter(event.target.value)}
                className="w-full rounded-md border border-gray-200 px-2 py-2 text-xs text-gray-700 focus:border-brand-purple focus:outline-none"
              >
                <option value="all">Todas as cores</option>
                {colors.map(color => (
                  <option key={color} value={color}>{color}</option>
                ))}
              </select>
              <select
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value)}
                className="w-full rounded-md border border-gray-200 px-2 py-2 text-xs text-gray-700 focus:border-brand-purple focus:outline-none"
              >
                <option value="all">Todos os tipos</option>
                {types.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
          </div>
          <ul className="max-h-64 overflow-y-auto">
            {filtered.length === 0 && (
              <li className="px-4 py-3 text-sm text-gray-500">Nenhum filamento encontrado.</li>
            )}
            {filtered.map(item => {
              const softColor = toSoftColor(item.colorHex);
              const rowStyle = softColor ? { backgroundColor: softColor } : undefined;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(item.id)}
                    className="w-full flex items-center justify-between gap-3 px-4 py-2 text-left hover:bg-gray-50 transition-colors"
                    style={rowStyle}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className="w-3 h-3 rounded-full border border-gray-200 shadow-sm"
                        style={{ backgroundColor: item.colorHex || '#d1d5db' }}
                      ></span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{item.description}</p>
                        <p className="text-xs text-gray-500 truncate">
                          {item.color}
                          {showType && item.type ? ` • ${item.type}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 text-right">
                      {showRemaining && typeof item.remainingMassGrams === 'number' && (
                        <div>{item.remainingMassGrams}g</div>
                      )}
                      {showPrice && typeof item.price === 'number' && (
                        <div>R$ {item.price.toFixed(2)}/kg</div>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
