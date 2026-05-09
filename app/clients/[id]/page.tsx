"use client";

import axios from "axios";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";

export default function EditClientPage({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const router = useRouter();
  const { id } = use(params);
  const [pageLoading, setPageLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    phoneNumber: "",
    sex: "",
    category: "",
  });

  useEffect(() => {
    axios
      .get(`http://localhost:5000/api/clients/${id}`)
      .then((res) => {
        setFormData(res.data);
        setPageLoading(false);
      })
      .catch((err) => {
        console.error(err);
        alert("Erro ao carregar cliente");
        router.push("/clients");
      });
  }, [id, router]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await axios.put(`http://localhost:5000/api/clients/${id}`, formData);
      router.push("/clients");
    } catch (error) {
      console.error("Error updating client:", error);
      alert("Erro ao atualizar cliente");
    } finally {
      setIsSaving(false);
    }
  };

  if (pageLoading) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white px-6 py-12 text-center text-gray-500 shadow-sm">
        Carregando...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-1 sm:px-0">
      <div className="mb-6 border-b-2 border-brand-orange pb-4 sm:mb-8">
        <h1 className="text-3xl font-bold text-brand-purple">Editar Cliente</h1>
        <p className="mt-2 text-sm text-gray-500">
          Atualize os dados do cliente sem perder o ritmo do atendimento.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-5 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:space-y-6 sm:p-8"
      >
        {/* Name */}
        <div>
          <label
            htmlFor="client-name"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Nome
          </label>
          <input
            id="client-name"
            type="text"
            name="name"
            required
            value={formData.name}
            onChange={handleChange}
            className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 transition-colors focus:border-transparent focus:ring-2 focus:ring-brand-purple"
          />
        </div>

        {/* Phone Number */}
        <div>
          <label
            htmlFor="client-phone"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Telefone
          </label>
          <input
            id="client-phone"
            type="text"
            name="phoneNumber"
            required
            value={formData.phoneNumber}
            onChange={handleChange}
            inputMode="tel"
            className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 transition-colors focus:border-transparent focus:ring-2 focus:ring-brand-purple"
          />
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6">
          {/* Sex */}
          <div>
            <label
              htmlFor="client-sex"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Sexo
            </label>
            <select
              id="client-sex"
              name="sex"
              required
              value={formData.sex}
              onChange={handleChange}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 transition-colors focus:border-transparent focus:ring-2 focus:ring-brand-purple"
            >
              <option value="">Selecione</option>
              <option value="M">Masculino</option>
              <option value="F">Feminino</option>
              <option value="O">Outro</option>
            </select>
          </div>

          {/* Category */}
          <div>
            <label
              htmlFor="client-category"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Categoria
            </label>
            <input
              id="client-category"
              type="text"
              name="category"
              value={formData.category}
              onChange={handleChange}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-gray-900 transition-colors focus:border-transparent focus:ring-2 focus:ring-brand-purple"
            />
          </div>
        </div>

        <div className="flex flex-col-reverse gap-3 pt-4 sm:flex-row sm:justify-end sm:gap-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="w-full rounded-xl border border-gray-200 px-4 py-3 font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-800 sm:w-auto sm:border-0 sm:px-4 sm:py-2"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="w-full rounded-xl bg-brand-purple px-6 py-3 font-medium text-white transition-colors hover:bg-purple-800 disabled:opacity-50 sm:w-auto sm:rounded-lg sm:py-2"
          >
            {isSaving ? "Salvando..." : "Salvar Alterações"}
          </button>
        </div>
      </form>
    </div>
  );
}
