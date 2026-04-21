"use client";

import {
    formatBytes,
    getAttachmentsByCategory,
    getSaleAttachmentUrl,
    SALE_ATTACHMENT_CATEGORIES,
    SaleAttachment,
} from "@/utils/saleAttachments";
import axios from "axios";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
    Suspense,
    use,
    useEffect,
    useMemo,
    useState,
    type MouseEvent as ReactMouseEvent,
    type WheelEvent as ReactWheelEvent,
} from "react";

interface Client {
  id: string;
  name: string;
  phoneNumber: string;
}

interface Filament {
  id: string;
  description: string;
  color: string;
}

interface PrintIncident {
  timestamp: string;
  reason: string;
  comment: string;
  wastedFilamentGrams?: number | null;
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

interface SaleDetail {
  id: string;
  description: string;
  productLink?: string;
  saleValue: number;
  cost: number;
  productionCost?: number;
  shippingCost?: number;
  profit: number;
  profitPercentage?: string;
  isPaid: boolean;
  isDelivered: boolean;
  isPrintConcluded: boolean;
  saleDate?: string;
  deliveryDate?: string;
  printStartConfirmedAt?: string;
  printStatus?: string;
  designPrintTime?: string;
  printQuality?: string;
  filamentId?: string;
  clientId?: string;
  massGrams?: number;
  hasCustomArt?: boolean;
  hasPainting?: boolean;
  hasVarnish?: boolean;
  designResponsible?: string;
  designTimeHours?: number;
  designValue?: number;
  paintResponsible?: string;
  paintTimeHours?: number;
  incidents?: PrintIncident[];
  errorReason?: string | null;
  wastedFilamentGrams?: number | null;
  attachments?: SaleAttachment[];
}

export default function SaleViewPage({
  params,
}: {
  readonly params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<div>Carregando...</div>}>
      <SaleViewContent params={params} />
    </Suspense>
  );
}

function SaleViewContent({
  params,
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [sale, setSale] = useState<SaleDetail | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [filaments, setFilaments] = useState<Filament[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [saleRes, clientsRes, filamentsRes] = await Promise.all([
          axios.get(`http://localhost:5000/api/sales/${id}`),
          axios.get("http://localhost:5000/api/clients"),
          axios.get("http://localhost:5000/api/filaments"),
        ]);

        setSale(saleRes.data);
        setClients(clientsRes.data);
        setFilaments(filamentsRes.data);
      } catch (error) {
        console.error("Error fetching sale details:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  const productImages = useMemo(
    () =>
      getAttachmentsByCategory(
        sale?.attachments,
        SALE_ATTACHMENT_CATEGORIES.PRODUCT_IMAGE,
      ),
    [sale?.attachments],
  );
  const complementaryImages = useMemo(
    () =>
      getAttachmentsByCategory(
        sale?.attachments,
        SALE_ATTACHMENT_CATEGORIES.COMPLEMENTARY_IMAGE,
      ),
    [sale?.attachments],
  );
  const complementaryFiles = useMemo(
    () =>
      getAttachmentsByCategory(
        sale?.attachments,
        SALE_ATTACHMENT_CATEGORIES.COMPLEMENTARY_FILE,
      ),
    [sale?.attachments],
  );

  const editHref = useMemo(() => {
    const query = searchParams?.toString();
    return query ? `/sales/${id}?${query}` : `/sales/${id}`;
  }, [id, searchParams]);

  const returnToSalesHref = useMemo(() => {
    const query = searchParams?.toString();
    return query ? `/sales?${query}` : "";
  }, [searchParams]);

  const getClientName = (clientId?: string) => {
    if (!clientId) {
      return "Não informado";
    }

    const client = clients.find((item) => item.id === clientId);
    return client?.name || "Cliente removido";
  };

  const getFilamentName = (filamentId?: string) => {
    if (!filamentId) {
      return "Não informado";
    }

    const filament = filaments.find((item) => item.id === filamentId);
    return filament
      ? `${filament.description} (${filament.color})`
      : "Filamento removido";
  };

  if (loading) {
    return <div className="py-12 text-center">Carregando...</div>;
  }

  if (!sale) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-white py-12 text-center">
        <p className="text-lg font-semibold text-gray-800">
          Venda não encontrada
        </p>
        <p className="mt-2 text-sm text-gray-500">
          O registro pode ter sido removido ou estar indisponível.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-10">
      <div className="flex flex-col gap-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm md:flex-row md:items-start md:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge
              label={sale.isPrintConcluded ? "Impresso" : "Pendente"}
              tone={sale.isPrintConcluded ? "blue" : "gray"}
            />
            <StatusBadge
              label={sale.isDelivered ? "Entregue" : "A enviar"}
              tone={sale.isDelivered ? "purple" : "amber"}
            />
            <StatusBadge
              label={sale.isPaid ? "Pago" : "Não pago"}
              tone={sale.isPaid ? "green" : "red"}
            />
          </div>

          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-gray-500">
              Visualização da venda
            </p>
            <h1 className="mt-1 text-2xl font-bold text-gray-900 md:text-3xl">
              {sale.description}
            </h1>
          </div>

          <div className="flex flex-wrap gap-3 text-sm text-gray-600">
            <InfoPill label="Cliente" value={getClientName(sale.clientId)} />
            <InfoPill
              label="Filamento"
              value={getFilamentName(sale.filamentId)}
            />
            <InfoPill label="Data da venda" value={formatDate(sale.saleDate)} />
            <InfoPill label="Entrega" value={formatDate(sale.deliveryDate)} />
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row md:flex-col md:items-stretch">
          {returnToSalesHref ? (
            <Link
              href={returnToSalesHref}
              className="rounded-xl border border-gray-300 px-4 py-3 text-center text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
            >
              Voltar ao relatório
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => router.back()}
              className="rounded-xl border border-gray-300 px-4 py-3 text-center text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
            >
              Voltar
            </button>
          )}

          <Link
            href={editHref}
            className="rounded-xl bg-brand-purple px-4 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-purple-800"
          >
            Editar venda
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <MetricCard
          label="Valor de venda"
          value={`R$ ${sale.saleValue.toFixed(2)}`}
          tone="orange"
        />
        <MetricCard
          label="Custo total"
          value={`R$ ${(sale.cost || 0).toFixed(2)}`}
        />
        <MetricCard
          label="Lucro"
          value={`R$ ${(sale.profit || 0).toFixed(2)}`}
          tone={sale.profit >= 0 ? "green" : "red"}
        />
        <MetricCard
          label="Margem"
          value={sale.profitPercentage || "0%"}
          tone={sale.profit >= 0 ? "green" : "red"}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <ImageCarouselSection
            title="Imagem do produto"
            description="Imagem principal que identifica a peça vendida."
            attachments={productImages}
          />

          <ImageCarouselSection
            title="Imagens complementares"
            description="Comprovantes, etiquetas ou qualquer material visual de apoio."
            attachments={complementaryImages}
          />

          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  Arquivos complementares
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Modelos 3MF, STL, PDFs ou outros arquivos anexados à venda.
                </p>
              </div>
            </div>

            {complementaryFiles.length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
                Nenhum arquivo complementar cadastrado.
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {complementaryFiles.map((attachment) => (
                  <div
                    key={attachment.storageId}
                    className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p
                        className="truncate text-sm font-semibold text-gray-800"
                        title={attachment.fileName}
                      >
                        {attachment.fileName}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {attachment.contentType || "arquivo"} •{" "}
                        {formatBytes(attachment.sizeBytes)}
                      </p>
                    </div>

                    <a
                      href={getSaleAttachmentUrl(attachment.storageId)}
                      download={attachment.fileName}
                      className="rounded-lg border border-brand-purple/20 bg-white px-3 py-2 text-xs font-semibold text-brand-purple transition-colors hover:bg-brand-purple/5"
                    >
                      Baixar arquivo
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <DetailCard title="Dados da venda">
            <DetailRow label="Cliente" value={getClientName(sale.clientId)} />
            <DetailRow
              label="Filamento"
              value={getFilamentName(sale.filamentId)}
            />
            <DetailRow
              label="Qualidade"
              value={sale.printQuality || "Não informado"}
            />
            <DetailRow
              label="Massa"
              value={sale.massGrams ? `${sale.massGrams} g` : "Não informado"}
            />
            <DetailRow
              label="Tempo estimado"
              value={sale.designPrintTime || "Não informado"}
            />
            <DetailRow
              label="Início confirmado"
              value={formatDateTime(sale.printStartConfirmedAt)}
            />
            <DetailRow
              label="Frete"
              value={`R$ ${(sale.shippingCost || 0).toFixed(2)}`}
            />
            <DetailRow
              label="Custo de produção"
              value={`R$ ${Number(sale.productionCost || Math.max((sale.cost || 0) - (sale.shippingCost || 0), 0)).toFixed(2)}`}
            />
          </DetailCard>

          <DetailCard title="Serviços adicionais">
            <DetailRow
              label="Arte personalizada"
              value={sale.hasCustomArt ? "Sim" : "Não"}
            />
            <DetailRow
              label="Pintura"
              value={sale.hasPainting ? "Sim" : "Não"}
            />
            <DetailRow label="Verniz" value={sale.hasVarnish ? "Sim" : "Não"} />
            <DetailRow
              label="Responsável design"
              value={sale.designResponsible || "Não informado"}
            />
            <DetailRow
              label="Tempo design"
              value={
                sale.designTimeHours
                  ? `${sale.designTimeHours} h`
                  : "Não informado"
              }
            />
            <DetailRow
              label="Valor design"
              value={
                sale.designValue
                  ? `R$ ${sale.designValue.toFixed(2)}`
                  : "Não informado"
              }
            />
            <DetailRow
              label="Responsável pintura"
              value={sale.paintResponsible || "Não informado"}
            />
            <DetailRow
              label="Tempo pintura"
              value={
                sale.paintTimeHours
                  ? `${sale.paintTimeHours} h`
                  : "Não informado"
              }
            />
          </DetailCard>

          <DetailCard title="Ocorrências da impressão">
            <DetailRow
              label="Status atual"
              value={sale.printStatus || "Não informado"}
            />
            <DetailRow
              label="Desperdício acumulado"
              value={
                typeof sale.wastedFilamentGrams === "number" &&
                sale.wastedFilamentGrams > 0
                  ? `${sale.wastedFilamentGrams} g`
                  : "Nenhum desperdício registrado"
              }
            />

            {sale.incidents && sale.incidents.length > 0 ? (
              <div className="space-y-3">
                {sale.incidents.map((incident, index) => (
                  <div
                    key={`${incident.timestamp}-${index}`}
                    className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3"
                  >
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-brand-purple">
                          {INCIDENT_REASONS[incident.reason] || incident.reason}
                        </p>
                        <p className="mt-1 text-sm text-gray-700">
                          {incident.comment || "Sem comentário adicional."}
                        </p>
                      </div>
                      <p className="text-xs text-gray-500">
                        {formatDateTime(incident.timestamp)}
                      </p>
                    </div>

                    {typeof incident.wastedFilamentGrams === "number" &&
                    incident.wastedFilamentGrams > 0 ? (
                      <p className="mt-2 text-xs font-medium text-amber-700">
                        Desperdício registrado: {incident.wastedFilamentGrams} g
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
                Nenhuma ocorrência registrada ainda. Quando houver interrupções
                ou falhas, elas aparecerão aqui.
              </div>
            )}

            {sale.errorReason ? (
              <DetailRow
                label="Último motivo informado"
                value={sale.errorReason}
              />
            ) : null}
          </DetailCard>

          <DetailCard title="Links e observações">
            <div className="space-y-3 text-sm text-gray-600">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
                  Link do produto
                </p>
                {sale.productLink ? (
                  <a
                    href={sale.productLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-block break-all text-brand-purple hover:underline"
                  >
                    {sale.productLink}
                  </a>
                ) : (
                  <p className="mt-1 text-gray-500">Nenhum link cadastrado.</p>
                )}
              </div>
            </div>
          </DetailCard>
        </div>
      </div>
    </div>
  );
}

function ImageCarouselSection({
  title,
  description,
  attachments,
}: Readonly<{
  title: string;
  description: string;
  attachments: SaleAttachment[];
}>) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isViewerOpen, setIsViewerOpen] = useState(false);

  useEffect(() => {
    setCurrentIndex(0);
  }, [attachments.length]);

  if (attachments.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-gray-900">{title}</h2>
        <p className="mt-1 text-sm text-gray-500">{description}</p>
        <div className="mt-4 rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-10 text-center text-sm text-gray-500">
          Nenhuma imagem cadastrada nesta categoria.
        </div>
      </div>
    );
  }

  const activeAttachment = attachments[currentIndex];

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          <p className="mt-1 text-sm text-gray-500">{description}</p>
        </div>

        <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">
          {currentIndex + 1} de {attachments.length}
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-gray-200 bg-gray-100">
        <div className="relative aspect-4/3 overflow-hidden">
          <button
            type="button"
            onClick={() => setIsViewerOpen(true)}
            className="group block h-full w-full text-left"
          >
            <img
              src={getSaleAttachmentUrl(activeAttachment.storageId)}
              alt={activeAttachment.fileName}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            />

            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between bg-linear-to-t from-black/55 via-black/10 to-transparent px-4 py-4 text-white">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/75">
                  Clique para ampliar
                </p>
                <p className="mt-1 text-sm font-semibold text-white">
                  Zoom com scroll do mouse
                </p>
              </div>

              <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/30 px-3 py-1 text-xs font-semibold backdrop-blur-sm">
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  ></path>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  ></path>
                </svg>
                Ver grande
              </span>
            </div>
          </button>

          {attachments.length > 1 && (
            <>
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setCurrentIndex((previousIndex) =>
                    previousIndex === 0
                      ? attachments.length - 1
                      : previousIndex - 1,
                  );
                }}
                className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white transition-colors hover:bg-black/75"
                aria-label="Imagem anterior"
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
                    d="M15 19l-7-7 7-7"
                  ></path>
                </svg>
              </button>

              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setCurrentIndex((previousIndex) =>
                    previousIndex === attachments.length - 1
                      ? 0
                      : previousIndex + 1,
                  );
                }}
                className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white transition-colors hover:bg-black/75"
                aria-label="Próxima imagem"
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
                    d="M9 5l7 7-7 7"
                  ></path>
                </svg>
              </button>
            </>
          )}
        </div>
      </div>

      {attachments.length > 1 && (
        <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-6">
          {attachments.map((attachment, index) => (
            <button
              key={attachment.storageId}
              type="button"
              onClick={() => setCurrentIndex(index)}
              className={`overflow-hidden rounded-xl border ${index === currentIndex ? "border-brand-purple" : "border-gray-200"}`}
            >
              <img
                src={getSaleAttachmentUrl(attachment.storageId)}
                alt={attachment.fileName}
                className="aspect-square h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      )}

      <ImageLightbox
        isOpen={isViewerOpen}
        onClose={() => setIsViewerOpen(false)}
        attachments={attachments}
        currentIndex={currentIndex}
        onIndexChange={setCurrentIndex}
        title={title}
      />
    </div>
  );
}

function ImageLightbox({
  isOpen,
  onClose,
  attachments,
  currentIndex,
  onIndexChange,
  title,
}: Readonly<{
  isOpen: boolean;
  onClose: () => void;
  attachments: SaleAttachment[];
  currentIndex: number;
  onIndexChange: (index: number) => void;
  title: string;
}>) {
  const [zoomScale, setZoomScale] = useState(1);
  const [transformOrigin, setTransformOrigin] = useState("50% 50%");

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (event.key === "ArrowLeft" && attachments.length > 1) {
        onIndexChange(
          currentIndex === 0 ? attachments.length - 1 : currentIndex - 1,
        );
        return;
      }

      if (event.key === "ArrowRight" && attachments.length > 1) {
        onIndexChange(
          currentIndex === attachments.length - 1 ? 0 : currentIndex + 1,
        );
      }
    };

    globalThis.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      globalThis.removeEventListener("keydown", handleKeyDown);
    };
  }, [attachments.length, currentIndex, isOpen, onClose, onIndexChange]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setZoomScale(1);
    setTransformOrigin("50% 50%");
  }, [currentIndex, isOpen]);

  if (!isOpen || attachments.length === 0) {
    return null;
  }

  const activeAttachment = attachments[currentIndex];

  const updateTransformOrigin = (
    event: ReactMouseEvent<HTMLDivElement> | ReactWheelEvent<HTMLDivElement>,
  ) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const originX = ((event.clientX - rect.left) / rect.width) * 100;
    const originY = ((event.clientY - rect.top) / rect.height) * 100;
    setTransformOrigin(`${originX}% ${originY}%`);
  };

  const handleWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    updateTransformOrigin(event);

    setZoomScale((previousScale) =>
      clamp(previousScale + (event.deltaY < 0 ? 0.25 : -0.25), 1, 4),
    );
  };

  const handleMouseMove = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (zoomScale <= 1) {
      return;
    }

    updateTransformOrigin(event);
  };

  return (
    <dialog
      open
      aria-label={`Visualização ampliada de ${title}`}
      className="fixed inset-0 z-50 m-0 h-screen w-screen max-w-none overflow-hidden border-none bg-slate-950/90 p-4 backdrop-blur-sm"
    >
      <div className="relative flex h-full items-center justify-center">
        <button
          type="button"
          onClick={onClose}
          className="absolute inset-0 block h-full w-full cursor-default border-0 bg-transparent p-0"
          aria-label="Fechar visualização ampliada"
        ></button>

        <div className="relative flex h-full max-h-[92vh] w-full max-w-6xl min-h-0 flex-col overflow-hidden rounded-4xl border border-white/10 bg-slate-900/90 text-white shadow-2xl">
          <div className="flex flex-col gap-4 border-b border-white/10 px-5 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/50">
                {title}
              </p>
              <h3 className="mt-1 text-lg font-bold text-white sm:text-xl">
                {activeAttachment.fileName}
              </h3>
              <p className="mt-2 text-sm text-white/65">
                Use o scroll do mouse para aproximar ou afastar. Pressione Esc
                para fechar.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/80">
                Zoom {Math.round(zoomScale * 100)}%
              </span>
              <button
                type="button"
                onClick={() =>
                  setZoomScale((previousScale) =>
                    clamp(previousScale - 0.25, 1, 4),
                  )
                }
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-lg font-bold text-white transition-colors hover:bg-white/10"
                aria-label="Reduzir zoom"
              >
                -
              </button>
              <button
                type="button"
                onClick={() => {
                  setZoomScale(1);
                  setTransformOrigin("50% 50%");
                }}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-white/10"
              >
                Resetar
              </button>
              <button
                type="button"
                onClick={() =>
                  setZoomScale((previousScale) =>
                    clamp(previousScale + 0.25, 1, 4),
                  )
                }
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-lg font-bold text-white transition-colors hover:bg-white/10"
                aria-label="Aumentar zoom"
              >
                +
              </button>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition-colors hover:bg-white/10"
                aria-label="Fechar visualização ampliada"
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
            </div>
          </div>

          <div className="relative flex-1 min-h-0 px-4 py-4 sm:px-6 sm:py-5">
            <div className="relative flex h-full min-h-[45vh] min-w-0 items-center justify-center overflow-hidden rounded-3xl border border-white/10 bg-black/50 p-3 sm:p-4">
              <div className="relative h-full w-full">
                <img
                  src={getSaleAttachmentUrl(activeAttachment.storageId)}
                  alt={activeAttachment.fileName}
                  className="absolute inset-0 h-full w-full select-none object-contain transition-transform duration-150"
                  onWheel={handleWheel}
                  onMouseMove={handleMouseMove}
                  style={{
                    transform: `scale(${zoomScale})`,
                    transformOrigin,
                    willChange: "transform",
                  }}
                />
              </div>

              {attachments.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      onIndexChange(
                        currentIndex === 0
                          ? attachments.length - 1
                          : currentIndex - 1,
                      )
                    }
                    className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full border border-white/10 bg-black/45 p-3 text-white transition-colors hover:bg-black/70"
                    aria-label="Imagem anterior"
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
                        d="M15 19l-7-7 7-7"
                      ></path>
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onIndexChange(
                        currentIndex === attachments.length - 1
                          ? 0
                          : currentIndex + 1,
                      )
                    }
                    className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full border border-white/10 bg-black/45 p-3 text-white transition-colors hover:bg-black/70"
                    aria-label="Próxima imagem"
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
                        d="M9 5l7 7-7 7"
                      ></path>
                    </svg>
                  </button>
                </>
              )}
            </div>
          </div>

          {attachments.length > 1 && (
            <div className="border-t border-white/10 px-4 py-4 sm:px-6">
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
                {attachments.map((attachment, index) => (
                  <button
                    key={attachment.storageId}
                    type="button"
                    onClick={() => onIndexChange(index)}
                    className={`overflow-hidden rounded-xl border transition-colors ${index === currentIndex ? "border-brand-orange" : "border-white/10 hover:border-white/25"}`}
                  >
                    <img
                      src={getSaleAttachmentUrl(attachment.storageId)}
                      alt={attachment.fileName}
                      className="aspect-square h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </dialog>
  );
}

function MetricCard({
  label,
  value,
  tone = "default",
}: Readonly<{
  label: string;
  value: string;
  tone?: "default" | "orange" | "green" | "red";
}>) {
  const toneClasses: Record<string, string> = {
    default: "border-gray-100 bg-white text-gray-900",
    orange: "border-orange-100 bg-orange-50 text-orange-800",
    green: "border-green-100 bg-green-50 text-green-800",
    red: "border-red-100 bg-red-50 text-red-800",
  };

  return (
    <div className={`rounded-2xl border p-5 shadow-sm ${toneClasses[tone]}`}>
      <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}

function DetailCard({
  title,
  children,
}: Readonly<{
  title: string;
  children: React.ReactNode;
}>) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-bold text-gray-900">{title}</h2>
      <div className="mt-4 space-y-3">{children}</div>
    </div>
  );
}

function DetailRow({
  label,
  value,
}: Readonly<{
  label: string;
  value: string;
}>) {
  return (
    <div className="flex flex-col gap-1 border-b border-gray-100 pb-3 last:border-b-0 last:pb-0">
      <span className="text-xs font-bold uppercase tracking-wide text-gray-500">
        {label}
      </span>
      <span className="text-sm font-medium text-gray-800">{value}</span>
    </div>
  );
}

function StatusBadge({
  label,
  tone,
}: Readonly<{
  label: string;
  tone: "gray" | "blue" | "purple" | "amber" | "green" | "red";
}>) {
  const toneClasses: Record<string, string> = {
    gray: "bg-gray-100 text-gray-700",
    blue: "bg-blue-100 text-blue-700",
    purple: "bg-purple-100 text-purple-700",
    amber: "bg-amber-100 text-amber-700",
    green: "bg-green-100 text-green-700",
    red: "bg-red-100 text-red-700",
  };

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-bold ${toneClasses[tone]}`}
    >
      {label}
    </span>
  );
}

function InfoPill({
  label,
  value,
}: Readonly<{
  label: string;
  value: string;
}>) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-medium text-gray-700">
      <span className="uppercase tracking-wide text-gray-400">{label}:</span>
      <span>{value}</span>
    </span>
  );
}

function formatDate(value?: string) {
  if (!value) {
    return "Não informado";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Não informado";
  }

  return date.toLocaleDateString("pt-BR");
}

function formatDateTime(value?: string) {
  if (!value) {
    return "Não informado";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Não informado";
  }

  return date.toLocaleString("pt-BR");
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
