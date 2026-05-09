"use client";

import Modal from "@/components/Modal";
import axios from "axios";
import { useState, type ReactNode } from "react";

interface ImportResult {
  successCount: number;
  failureCount: number;
  errors: string[];
}

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [modalError, setModalError] = useState<{
    title: string;
    message: string | ReactNode;
  } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];

      // Client-side validation: File Type
      if (!selectedFile.name.toLowerCase().endsWith(".csv")) {
        setModalError({
          title: "Formato de Arquivo Inválido",
          message:
            "Por favor, selecione um arquivo CSV (.csv). Outros formatos não são suportados.",
        });
        e.target.value = ""; // Reset input
        return;
      }

      setFile(selectedFile);
      setResult(null);
    }
  };

  const handleDownloadTemplate = () => {
    const header =
      "Descrição;LinkFilamento;PrecoFilamento;DescricaoFilamento;CorFilamento;LinkProduto;Qualidade;Massa;Custo;ValorVenda;Lucro;PorcentagemLucro;SexoCliente;Categoria;NumeroCliente;NomeCliente;Impresso;Entregue;Pago;Tempo;StatusImpressao;DataVenda";
    const example =
      "Vaso Geométrico;http://loja.com/pla;120.00;PLA Azul;Azul;http://stl.com;Standard;150;18.00;50.00;32.00;177%;M;Novo;11999998888;João Silva;S;N;S;4h 30m;Pendente;23/12/2025";
    const csvContent = `\uFEFF${header}\n${example}`; // Add BOM for Excel compatibility

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "modelo_importacao_byte2life.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsLoading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await axios.post(
        "http://localhost:5000/api/import",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        },
      );

      const data = response.data as ImportResult;
      setResult(data);
      setFile(null);

      if (data.failureCount > 0) {
        setModalError({
          title: "Erros na Importação",
          message: (
            <div>
              <p className="mb-2 text-gray-700">
                O arquivo foi processado, mas algumas linhas apresentaram erros:
              </p>
              <ul className="list-disc list-inside text-sm text-red-600 space-y-1">
                {data.errors.map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
            </div>
          ),
        });
      } else {
        setModalError({
          title: "Sucesso",
          message: `Importação concluída! ${data.successCount} registros processados com sucesso.`,
        });
      }
    } catch (error) {
      console.error(error);
      setModalError({
        title: "Erro Crítico",
        message:
          "Ocorreu um erro inesperado ao comunicar com o servidor. Verifique se o backend está rodando.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Modal
        isOpen={!!modalError}
        onClose={() => setModalError(null)}
        title={modalError?.title || ""}
        type={modalError?.title.includes("Sucesso") ? "success" : "error"}
      >
        {modalError?.message}
      </Modal>

      <div className="flex justify-between items-center mb-8 border-b-2 border-brand-orange pb-2">
        <h1 className="text-3xl font-bold text-brand-purple">Importar Dados</h1>
        <button
          onClick={handleDownloadTemplate}
          className="text-sm flex items-center gap-2 text-brand-purple hover:text-purple-800 font-medium transition-colors"
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
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            ></path>
          </svg>
          Baixar Modelo
        </button>
      </div>

      <div className="bg-white p-8 rounded-xl shadow-md border border-gray-100">
        <div className="mb-6">
          <label
            className="block text-gray-700 text-sm font-bold mb-2"
            htmlFor="file-upload"
          >
            Selecione a planilha (.csv)
          </label>
          <div className="flex items-center justify-center w-full">
            <label
              htmlFor="dropzone-file"
              className="flex flex-col items-center justify-center w-full h-64 border-2 border-brand-purple border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <svg
                  className="w-10 h-10 mb-3 text-brand-purple"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  ></path>
                </svg>
                <p className="mb-2 text-sm text-gray-500">
                  <span className="font-semibold">Clique para enviar</span> ou
                  arraste e solte
                </p>
                <p className="text-xs text-gray-500">CSV (MAX. 10MB)</p>
              </div>
              <input
                id="dropzone-file"
                type="file"
                className="hidden"
                onChange={handleFileChange}
                accept=".csv"
              />
            </label>
          </div>
          {file && (
            <p className="mt-2 text-sm text-gray-600 font-medium">
              Arquivo selecionado:{" "}
              <span className="text-brand-purple">{file.name}</span>
            </p>
          )}
        </div>

        <button
          onClick={handleUpload}
          disabled={!file || isLoading}
          className={`w-full font-bold py-3 px-4 rounded-lg transition-colors focus:outline-none focus:shadow-outline ${
            !file || isLoading
              ? "bg-gray-300 text-gray-500 cursor-not-allowed"
              : "bg-brand-orange hover:bg-orange-600 text-white"
          }`}
        >
          {isLoading ? "Importando..." : "Iniciar Importação"}
        </button>

        {result && (
          <div className="mt-6 space-y-4">
            <div
              className={`p-4 rounded-lg ${result.failureCount === 0 ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-800"}`}
            >
              <p className="font-bold">Resultado da Importação:</p>
              <p>Sucesso: {result.successCount}</p>
              <p>Falhas: {result.failureCount}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
