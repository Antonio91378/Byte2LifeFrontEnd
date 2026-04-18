"use client";

import { useDialog } from "@/context/DialogContext";
import axios from "axios";
import Link from "next/link";
import { useEffect, useState } from "react";

interface Client {
  id: string;
  name: string;
  phoneNumber: string;
  sex: string;
  category: string;
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const { showAlert, showConfirm } = useDialog();

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      const url = searchTerm
        ? `http://localhost:5000/api/clients?name=${encodeURIComponent(searchTerm)}`
        : "http://localhost:5000/api/clients";

      axios
        .get(url)
        .then((res) => setClients(res.data))
        .catch((err) => console.error(err));
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  const handleDelete = (id: string) => {
    showConfirm(
      "Excluir Cliente",
      "Tem certeza que deseja excluir este cliente?",
      async () => {
        try {
          await axios.delete(`http://localhost:5000/api/clients/${id}`);
          setClients(clients.filter((c) => c.id !== id));
          await showAlert(
            "Sucesso",
            "Cliente excluído com sucesso!",
            "success",
          );
        } catch (error: any) {
          console.error(error);
          if (error.response?.data?.message) {
            await showAlert("Erro", error.response.data.message, "error");
          } else {
            await showAlert("Erro", "Erro ao excluir cliente", "error");
          }
        }
      },
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 border-b-2 border-brand-orange pb-4 md:flex-row md:items-center">
        <h1 className="text-3xl font-bold text-brand-purple">Clientes</h1>

        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center md:w-auto md:justify-end">
          <div className="group relative w-full md:w-72">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg
                className="h-5 w-5 text-gray-400 group-focus-within:text-brand-purple transition-colors"
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
            <input
              type="text"
              placeholder="Buscar clientes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-xl leading-5 bg-gray-50 text-gray-900 placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-brand-purple/20 focus:border-brand-purple transition-all duration-200 shadow-sm"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-red-500 transition-colors"
                title="Limpar busca"
              >
                <svg
                  className="h-5 w-5"
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
            )}
          </div>

          <Link
            href="/clients/new"
            className="flex h-10.5 w-full items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-brand-purple px-4 py-2 text-white shadow-md transition-colors hover:bg-purple-800 sm:w-auto"
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
            Novo Cliente
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {clients.map((c) => (
          <div
            key={c.id}
            className="group relative overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-md transition-shadow hover:shadow-lg"
          >
            <div className="h-2 bg-brand-purple"></div>
            <div className="p-5 sm:p-6">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <h3 className="wrap-break-word text-xl font-bold text-gray-800">
                  {c.name || "Sem Nome"}
                </h3>
                <span className="inline-flex w-fit rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600">
                  {c.category || "Sem categoria"}
                </span>
              </div>

              <div className="space-y-3">
                <div className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                  <span className="text-gray-500">Telefone</span>
                  <span className="font-medium text-gray-800 sm:text-right">
                    {c.phoneNumber || "Não informado"}
                  </span>
                </div>
                <div className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                  <span className="text-gray-500">Sexo</span>
                  <span className="font-medium text-gray-800 sm:text-right">
                    {c.sex || "Não informado"}
                  </span>
                </div>
              </div>

              <div className="mt-5 flex flex-col gap-2 border-t border-gray-100 pt-4 opacity-100 transition-opacity sm:flex-row sm:justify-end sm:opacity-0 sm:group-hover:opacity-100">
                <Link
                  href={`/clients/${c.id}`}
                  className="inline-flex items-center justify-center rounded-lg border border-brand-purple/20 px-4 py-2 text-sm font-semibold text-brand-purple transition-colors hover:bg-purple-50 hover:text-purple-900"
                >
                  Editar
                </Link>
                <button
                  onClick={() => handleDelete(c.id)}
                  className="inline-flex items-center justify-center rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 hover:text-red-900"
                >
                  Excluir
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {clients.length === 0 && (
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
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
            ></path>
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">
            Nenhum cliente cadastrado
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Comece adicionando um novo cliente.
          </p>
        </div>
      )}
    </div>
  );
}
