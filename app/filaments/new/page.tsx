'use client';

import axios from 'axios';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function NewFilamentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    description: '',
    link: '',
    price: 0,
    initialMassGrams: 1000,
    remainingMassGrams: 1000,
    color: '',
    colorHex: '#000000',
    type: 'PLA',
    warningComment: '',
    slicingProfile3mfPath: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post('http://localhost:5000/api/filaments', formData);
      router.push('/filaments');
    } catch (error) {
      console.error('Error creating filament:', error);
      alert('Erro ao criar filamento');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold text-brand-purple mb-8 border-b-2 border-brand-orange pb-4">Novo Filamento</h1>
      
      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-xl shadow-sm border border-gray-100 space-y-6">
        {/* Tipo */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
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
        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Descrição / Marca</label>
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
          <label className="block text-sm font-medium text-gray-700 mb-1">Cor</label>
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
                value={formData.colorHex}
                onChange={handleChange}
                className="h-10 w-14 p-1 border border-gray-300 rounded cursor-pointer"
                title="Escolher cor visual"
              />
              <span className="text-xs text-gray-500 mt-1">Visual</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Price */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Preço (R$)</label>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Massa Inicial (g)</label>
            <input
              type="number"
              name="initialMassGrams"
              required
              value={formData.initialMassGrams}
              onChange={(e) => {
                const val = Number(e.target.value);
                setFormData(prev => ({ 
                  ...prev, 
                  initialMassGrams: val,
                  remainingMassGrams: val // Auto-update remaining when initial changes on create
                }));
              }}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-transparent text-gray-900"
            />
          </div>
        </div>

        {/* Link */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Link de Compra</label>
          <input
            type="url"
            name="link"
            value={formData.link}
            onChange={handleChange}
            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-transparent text-gray-900"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Ressalvas de Fatiamento (warning)</label>
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
          <label className="block text-sm font-medium text-gray-700 mb-1">Arquivo 3MF de Exemplo (caminho)</label>
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
            {loading ? 'Salvando...' : 'Salvar Filamento'}
          </button>
        </div>

      </form>
    </div>
  );
}
