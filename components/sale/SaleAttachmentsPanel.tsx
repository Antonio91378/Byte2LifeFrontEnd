"use client";

import { useRef } from "react";

import {
    formatBytes,
    PendingSaleAttachment,
    SALE_ATTACHMENT_CATEGORIES,
    SaleAttachment,
    SaleAttachmentCategory,
    toAttachmentListItems,
} from "@/utils/saleAttachments";

interface SaleAttachmentsPanelProps {
  existingAttachments: SaleAttachment[];
  pendingAttachments: PendingSaleAttachment[];
  processingCategories: SaleAttachmentCategory[];
  onFilesSelected: (
    category: SaleAttachmentCategory,
    files: File[],
  ) => Promise<void>;
  onRemoveExisting: (storageId: string) => void;
  onRemovePending: (localId: string) => void;
}

const FILE_ACCEPT = ".3mf,.stl,.obj,.zip,.pdf,.txt,.csv,.json,.md";

export default function SaleAttachmentsPanel({
  existingAttachments,
  pendingAttachments,
  processingCategories,
  onFilesSelected,
  onRemoveExisting,
  onRemovePending,
}: Readonly<SaleAttachmentsPanelProps>) {
  const productImages = toAttachmentListItems(
    existingAttachments,
    pendingAttachments,
    SALE_ATTACHMENT_CATEGORIES.PRODUCT_IMAGE,
  );
  const complementaryImages = toAttachmentListItems(
    existingAttachments,
    pendingAttachments,
    SALE_ATTACHMENT_CATEGORIES.COMPLEMENTARY_IMAGE,
  );
  const complementaryFiles = toAttachmentListItems(
    existingAttachments,
    pendingAttachments,
    SALE_ATTACHMENT_CATEGORIES.COMPLEMENTARY_FILE,
  );

  return (
    <div className="col-span-1 md:col-span-2 rounded-xl border border-gray-200 bg-gray-50 p-4 md:p-5 space-y-6">
      <div>
        <h3 className="text-sm md:text-base font-bold text-brand-purple">
          Imagens e arquivos da venda
        </h3>
        <p className="mt-1 text-xs text-gray-500">
          Imagens são preparadas no navegador antes do envio para reduzir uso de
          armazenamento no plano free.
        </p>
      </div>

      <AttachmentUploadSection
        title="Imagem do produto"
        description="Miniatura principal da venda. Limite de 2 MB por imagem."
        category={SALE_ATTACHMENT_CATEGORIES.PRODUCT_IMAGE}
        items={productImages}
        processing={processingCategories.includes(
          SALE_ATTACHMENT_CATEGORIES.PRODUCT_IMAGE,
        )}
        accept="image/*"
        emptyLabel="Nenhuma imagem principal adicionada."
        onFilesSelected={onFilesSelected}
        onRemoveExisting={onRemoveExisting}
        onRemovePending={onRemovePending}
      />

      <AttachmentUploadSection
        title="Imagem complementar"
        description="Comprovantes, etiquetas dos correios ou outras imagens auxiliares."
        category={SALE_ATTACHMENT_CATEGORIES.COMPLEMENTARY_IMAGE}
        items={complementaryImages}
        processing={processingCategories.includes(
          SALE_ATTACHMENT_CATEGORIES.COMPLEMENTARY_IMAGE,
        )}
        accept="image/*"
        emptyLabel="Nenhuma imagem complementar adicionada."
        onFilesSelected={onFilesSelected}
        onRemoveExisting={onRemoveExisting}
        onRemovePending={onRemovePending}
      />

      <AttachmentUploadSection
        title="Arquivo complementar"
        description="Arquivos como 3MF, STL, PDF ou ZIP. Limite de 8 MB por arquivo."
        category={SALE_ATTACHMENT_CATEGORIES.COMPLEMENTARY_FILE}
        items={complementaryFiles}
        processing={processingCategories.includes(
          SALE_ATTACHMENT_CATEGORIES.COMPLEMENTARY_FILE,
        )}
        accept={FILE_ACCEPT}
        emptyLabel="Nenhum arquivo complementar adicionado."
        onFilesSelected={onFilesSelected}
        onRemoveExisting={onRemoveExisting}
        onRemovePending={onRemovePending}
      />
    </div>
  );
}

interface AttachmentUploadSectionProps {
  title: string;
  description: string;
  category: SaleAttachmentCategory;
  items: ReturnType<typeof toAttachmentListItems>;
  processing: boolean;
  accept: string;
  emptyLabel: string;
  onFilesSelected: (
    category: SaleAttachmentCategory,
    files: File[],
  ) => Promise<void>;
  onRemoveExisting: (storageId: string) => void;
  onRemovePending: (localId: string) => void;
}

function AttachmentUploadSection({
  title,
  description,
  category,
  items,
  processing,
  accept,
  emptyLabel,
  onFilesSelected,
  onRemoveExisting,
  onRemovePending,
}: Readonly<AttachmentUploadSectionProps>) {
  const isImageSection =
    category !== SALE_ATTACHMENT_CATEGORIES.COMPLEMENTARY_FILE;
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleInputChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const inputElement = event.currentTarget;
    const nextFiles = Array.from(event.target.files || []);
    if (nextFiles.length === 0) {
      return;
    }

    try {
      await onFilesSelected(category, nextFiles);
    } finally {
      inputElement.value = "";
    }
  };

  return (
    <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <h4 className="text-sm font-bold text-gray-800">{title}</h4>
          <p className="mt-1 text-xs text-gray-500">{description}</p>
        </div>

        <button
          type="button"
          disabled={processing}
          onClick={() => fileInputRef.current?.click()}
          className={`inline-flex items-center justify-center rounded-lg border border-dashed px-4 py-2 text-xs font-semibold transition-colors ${processing ? "cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400" : "cursor-pointer border-brand-purple/30 bg-brand-purple/5 text-brand-purple hover:bg-brand-purple/10"}`}
        >
          {processing ? "Preparando..." : "Adicionar arquivos"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple
          className="hidden"
          disabled={processing}
          onChange={handleInputChange}
        />
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-5 text-center text-sm text-gray-500">
          {emptyLabel}
        </div>
      ) : isImageSection ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((item) => (
            <div
              key={item.key}
              className="group overflow-hidden rounded-xl border border-gray-200 bg-gray-50"
            >
              <div className="relative aspect-square overflow-hidden bg-gray-100">
                {item.url ? (
                  <img
                    src={item.url}
                    alt={item.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-gray-300">
                    <svg
                      className="h-8 w-8"
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

                <button
                  type="button"
                  onClick={() => {
                    if (item.isPending && item.localId) {
                      onRemovePending(item.localId);
                      return;
                    }

                    if (!item.isPending && item.storageId) {
                      onRemoveExisting(item.storageId);
                    }
                  }}
                  className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white transition-colors hover:bg-black/75"
                  title="Remover"
                >
                  <svg
                    className="h-3 w-3"
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

                {item.isPending && (
                  <span className="absolute bottom-2 left-2 rounded-full bg-white/90 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-brand-purple">
                    Novo
                  </span>
                )}
              </div>

              <div className="space-y-1 p-3">
                <p
                  className="truncate text-xs font-semibold text-gray-700"
                  title={item.name}
                >
                  {item.name}
                </p>
                <p className="text-[11px] text-gray-500">
                  {formatBytes(item.sizeBytes)}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.key}
              className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p
                  className="truncate text-sm font-semibold text-gray-800"
                  title={item.name}
                >
                  {item.name}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {item.contentType || "arquivo"} •{" "}
                  {formatBytes(item.sizeBytes)}
                  {item.isPending ? " • novo" : ""}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {!item.isPending && item.url && (
                  <a
                    href={item.url}
                    download={item.name}
                    className="rounded-lg border border-brand-purple/20 px-3 py-2 text-xs font-semibold text-brand-purple transition-colors hover:bg-brand-purple/5"
                  >
                    Baixar
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (item.isPending && item.localId) {
                      onRemovePending(item.localId);
                      return;
                    }

                    if (!item.isPending && item.storageId) {
                      onRemoveExisting(item.storageId);
                    }
                  }}
                  className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50"
                >
                  Remover
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
