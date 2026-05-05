"use client";

import { API_BASE_URL } from "@/utils/api";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Clock3,
  Flame,
  Gauge,
  Layers3,
  ListChecks,
  Loader2,
  Power,
  Radio,
  RefreshCw,
  Send,
  SlidersHorizontal,
  Thermometer,
  Wifi,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

interface PrinterMonitorEvent {
  level: string;
  message: string;
}

interface PrinterMonitorStatus {
  host?: string;
  serial?: string;
  receivedAt?: string;
  received_at?: string;
  summary?: {
    device?: {
      serial?: string;
      name?: string;
      model?: string;
      wifiSignal?: string;
      wifi_signal?: string;
    };
    job?: {
      state?: string;
      file?: string;
      progressPercent?: number;
      progress_percent?: number;
      remainingMinutes?: number;
      remaining_minutes?: number;
      layer?: number;
      totalLayers?: number;
      total_layers?: number;
    };
    temperatures?: {
      nozzleC?: number;
      nozzle_c?: number;
      nozzleTargetC?: number;
      nozzle_target_c?: number;
      bedC?: number;
      bed_c?: number;
      bedTargetC?: number;
      bed_target_c?: number;
      chamberC?: number;
      chamber_c?: number;
    };
    material?: {
      amsStatus?: number;
      ams_status?: number;
      vtTray?: {
        tray_type?: string;
        tray_color?: string;
        tray_info_idx?: string;
      };
      vt_tray?: {
        tray_type?: string;
        tray_color?: string;
        tray_info_idx?: string;
      };
    };
    health?: {
      printError?: number;
      print_error?: number;
      failReason?: string;
      fail_reason?: string;
      hms?: unknown[];
    };
  };
  events?: PrinterMonitorEvent[];
}

interface PrinterCommand {
  id: string;
  type: string;
  label: string;
  status: string;
  error?: string;
  createdAt: string;
  completedAt?: string;
}

type PrinterTab = "monitor" | "control";

function firstNumber(...values: Array<number | undefined>) {
  return values.find((value) => Number.isFinite(value));
}

function firstString(...values: Array<string | undefined>) {
  return values.find((value) => typeof value === "string" && value.length > 0);
}

function formatCelsius(value?: number) {
  return Number.isFinite(value) ? `${value!.toFixed(1)} C` : "-";
}

function formatDate(value?: string) {
  if (!value) return "-";
  return new Date(value).toLocaleString("pt-BR");
}

function stateLabel(state?: string) {
  const labels: Record<string, string> = {
    FINISH: "Finalizada",
    RUNNING: "Imprimindo",
    PAUSE: "Pausada",
    FAILED: "Falhou",
    IDLE: "Ociosa",
  };
  return state ? labels[state] ?? state : "-";
}

function MetricCard({
  label,
  value,
  detail,
  icon,
}: Readonly<{
  label: string;
  value: string;
  detail?: string;
  icon: ReactNode;
}>) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-gray-500">{label}</span>
        <span className="rounded-lg bg-purple-50 p-2 text-brand-purple">
          {icon}
        </span>
      </div>
      <div className="mt-3 text-2xl font-bold text-gray-900">{value}</div>
      {detail && <div className="mt-1 text-sm text-gray-500">{detail}</div>}
    </div>
  );
}

export default function PrinterPage() {
  const [activeTab, setActiveTab] = useState<PrinterTab>("monitor");
  const [status, setStatus] = useState<PrinterMonitorStatus | null>(null);
  const [connectionState, setConnectionState] = useState("conectando");
  const [error, setError] = useState("");
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [cameraVersion, setCameraVersion] = useState(1);
  const [cameraState, setCameraState] = useState("desligada");
  const [cameraUpdatedAt, setCameraUpdatedAt] = useState("");
  const [commandPin, setCommandPin] = useState("");
  const [bedTemp, setBedTemp] = useState("60");
  const [nozzleTemp, setNozzleTemp] = useState("200");
  const [speedProfile, setSpeedProfile] = useState("2");
  const [customGcode, setCustomGcode] = useState("");
  const [commandMessage, setCommandMessage] = useState("");
  const [commandHistory, setCommandHistory] = useState<PrinterCommand[]>([]);

  useEffect(() => {
    let active = true;

    async function fetchLatest() {
      try {
        const response = await fetch(`${API_BASE_URL}/printer-monitor/latest`, {
          cache: "no-store",
        });

        if (response.ok && active) {
          setStatus(await response.json());
          setError("");
        }
      } catch (requestError) {
        console.error(requestError);
      }
    }

    fetchLatest();

    const source = new EventSource(`${API_BASE_URL}/printer-monitor/events`);

    source.addEventListener("open", () => {
      if (!active) return;
      setConnectionState("ao vivo");
      setError("");
    });

    source.addEventListener("printer", (event) => {
      if (!active) return;
      setStatus(JSON.parse(event.data));
      setConnectionState("ao vivo");
      setError("");
    });

    source.onerror = () => {
      if (!active) return;
      setConnectionState("reconectando");
      setError("Sem atualizacao em tempo real no momento.");
    };

    return () => {
      active = false;
      source.close();
    };
  }, []);

  useEffect(() => {
    if (!cameraEnabled) {
      return;
    }

    const interval = setInterval(() => {
      setCameraVersion(Date.now());
    }, 1200);

    return () => clearInterval(interval);
  }, [cameraEnabled]);

  useEffect(() => {
    if (activeTab !== "control") {
      return;
    }

    let active = true;

    async function fetchCommands() {
      try {
        const response = await fetch(`${API_BASE_URL}/printer-monitor/commands`, {
          cache: "no-store",
        });

        if (response.ok && active) {
          setCommandHistory(await response.json());
        }
      } catch (requestError) {
        console.error(requestError);
      }
    }

    fetchCommands();
    const interval = setInterval(fetchCommands, 4000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [activeTab]);

  const view = useMemo(() => {
    const summary = status?.summary;
    const device = summary?.device;
    const job = summary?.job;
    const temperatures = summary?.temperatures;
    const material = summary?.material;
    const health = summary?.health;
    const tray = material?.vtTray ?? material?.vt_tray;

    return {
      serial: firstString(status?.serial, device?.serial),
      host: status?.host,
      receivedAt: firstString(status?.receivedAt, status?.received_at),
      wifiSignal: firstString(device?.wifiSignal, device?.wifi_signal),
      state: job?.state,
      file: job?.file,
      progress: firstNumber(job?.progressPercent, job?.progress_percent) ?? 0,
      remainingMinutes: firstNumber(
        job?.remainingMinutes,
        job?.remaining_minutes,
      ),
      layer: job?.layer,
      totalLayers: firstNumber(job?.totalLayers, job?.total_layers),
      nozzleC: firstNumber(temperatures?.nozzleC, temperatures?.nozzle_c),
      nozzleTargetC: firstNumber(
        temperatures?.nozzleTargetC,
        temperatures?.nozzle_target_c,
      ),
      bedC: firstNumber(temperatures?.bedC, temperatures?.bed_c),
      bedTargetC: firstNumber(
        temperatures?.bedTargetC,
        temperatures?.bed_target_c,
      ),
      chamberC: firstNumber(temperatures?.chamberC, temperatures?.chamber_c),
      materialType: tray?.tray_type,
      materialCode: tray?.tray_info_idx,
      materialColor: tray?.tray_color,
      printError: firstNumber(health?.printError, health?.print_error) ?? 0,
      failReason: firstString(health?.failReason, health?.fail_reason),
      events: status?.events ?? [],
    };
  }, [status]);

  const isLive = connectionState === "ao vivo";
  const cameraUrl = `${API_BASE_URL}/printer-monitor/camera/latest?t=${cameraVersion}`;

  function toggleCamera() {
    const nextEnabled = !cameraEnabled;
    setCameraEnabled(nextEnabled);

    if (nextEnabled) {
      setCameraState("aguardando imagem");
      setCameraUpdatedAt("");
      setCameraVersion(Date.now());
      return;
    }

    setCameraState("desligada");
    setCameraUpdatedAt("");
  }

  async function refreshCommands() {
    const response = await fetch(`${API_BASE_URL}/printer-monitor/commands`, {
      cache: "no-store",
    });

    if (response.ok) {
      setCommandHistory(await response.json());
    }
  }

  async function createCommand(
    payload: {
      type: string;
      mode?: string;
      value?: number;
      gcode?: string;
    },
    confirmation: string,
  ) {
    if (!window.confirm(confirmation)) {
      return;
    }

    setCommandMessage("Enviando comando...");

    try {
      const response = await fetch(`${API_BASE_URL}/printer-monitor/commands`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(commandPin ? { "x-printer-command-pin": commandPin } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null);
        throw new Error(errorPayload?.message || `HTTP ${response.status}`);
      }

      const command = await response.json();
      setCommandMessage(`Comando criado: ${command.label}`);
      await refreshCommands();
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Erro ao criar comando";
      setCommandMessage(message);
    }
  }

  return (
    <div className="space-y-6 py-4">
      <div className="flex flex-col justify-between gap-4 border-b-2 border-brand-orange pb-4 md:flex-row md:items-end">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-brand-orange">
            <Radio className="h-4 w-4" />
            Monitoramento em tempo real
          </div>
          <h1 className="mt-2 text-3xl font-bold text-brand-purple">
            Impressora Bambu
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            {view.serial ? `Serial ${view.serial}` : "Aguardando primeiro envio do coletor local"}
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm">
          <span
            className={`h-3 w-3 rounded-full ${isLive ? "bg-green-500" : "bg-amber-500"}`}
          />
          <span className="text-sm font-semibold text-gray-700">
            {connectionState}
          </span>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {error}
        </div>
      )}

      <div className="flex rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
        <button
          type="button"
          onClick={() => setActiveTab("monitor")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-3 text-sm font-semibold transition-colors ${
            activeTab === "monitor"
              ? "bg-brand-purple text-white"
              : "text-gray-600 hover:bg-purple-50 hover:text-brand-purple"
          }`}
        >
          <Radio className="h-4 w-4" />
          Monitoramento
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("control")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-3 text-sm font-semibold transition-colors ${
            activeTab === "control"
              ? "bg-brand-purple text-white"
              : "text-gray-600 hover:bg-purple-50 hover:text-brand-purple"
          }`}
        >
          <SlidersHorizontal className="h-4 w-4" />
          Controle
        </button>
      </div>

      <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <div
          className={`flex flex-col justify-between gap-3 px-5 py-4 sm:flex-row sm:items-center ${
            cameraEnabled ? "border-b border-gray-100" : ""
          }`}
        >
          <div className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-brand-purple" />
            <h2 className="text-lg font-bold text-gray-900">Camera</h2>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-gray-500">
              {cameraUpdatedAt || cameraState}
            </span>
            {cameraEnabled && (
              <button
                type="button"
                onClick={() => setCameraVersion(Date.now())}
                className="rounded-lg border border-gray-200 bg-white p-2 text-brand-purple shadow-sm transition-colors hover:bg-purple-50"
                aria-label="Atualizar camera"
                title="Atualizar camera"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onClick={toggleCamera}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold shadow-sm transition-colors ${
                cameraEnabled
                  ? "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                  : "bg-brand-purple text-white hover:bg-purple-900"
              }`}
              aria-pressed={cameraEnabled}
            >
              <Power className="h-4 w-4" />
              {cameraEnabled ? "Desligar" : "Ligar camera"}
            </button>
          </div>
        </div>
        {cameraEnabled && (
          <div className="relative aspect-video bg-black">
            <img
              src={cameraUrl}
              alt="Camera da impressora Bambu"
              className="h-full w-full object-contain"
              onLoad={() => {
                setCameraState("ao vivo");
                setCameraUpdatedAt(new Date().toLocaleTimeString("pt-BR"));
              }}
              onError={() => {
                setCameraState("sem imagem");
                setCameraUpdatedAt("");
              }}
            />
            {cameraState !== "ao vivo" && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-sm text-white">
                {cameraState}
              </div>
            )}
          </div>
        )}
      </section>

      {activeTab === "monitor" ? (
      <>
      {!status ? (
        <div className="flex items-center justify-center gap-3 rounded-lg border border-dashed border-gray-300 bg-white p-10 text-gray-600">
          <Loader2 className="h-5 w-5 animate-spin" />
          Aguardando dados do backend no Render.
        </div>
      ) : (
        <>
          <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Estado"
              value={stateLabel(view.state)}
              detail={view.file || "Sem arquivo ativo"}
              icon={<CheckCircle2 className="h-5 w-5" />}
            />
            <MetricCard
              label="Progresso"
              value={`${Math.round(view.progress)}%`}
              detail={
                view.layer && view.totalLayers
                  ? `Camada ${view.layer} de ${view.totalLayers}`
                  : "Camadas indisponiveis"
              }
              icon={<Gauge className="h-5 w-5" />}
            />
            <MetricCard
              label="Tempo restante"
              value={
                Number.isFinite(view.remainingMinutes)
                  ? `${view.remainingMinutes} min`
                  : "-"
              }
              detail={`Atualizado em ${formatDate(view.receivedAt)}`}
              icon={<Clock3 className="h-5 w-5" />}
            />
            <MetricCard
              label="Wi-Fi"
              value={view.wifiSignal || "-"}
              detail={view.host || "Host indisponivel"}
              icon={<Wifi className="h-5 w-5" />}
            />
          </section>

          <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-4">
              <h2 className="text-lg font-bold text-gray-900">Andamento</h2>
              <span className="text-sm font-medium text-gray-500">
                {Math.round(view.progress)}%
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-brand-orange transition-all"
                style={{ width: `${Math.max(0, Math.min(100, view.progress))}%` }}
              />
            </div>
          </section>

          <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2 text-lg font-bold text-gray-900">
                <Thermometer className="h-5 w-5 text-brand-orange" />
                Temperaturas
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-gray-500">Bico</span>
                  <span className="font-semibold text-gray-900">
                    {formatCelsius(view.nozzleC)} / alvo {formatCelsius(view.nozzleTargetC)}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-gray-500">Mesa</span>
                  <span className="font-semibold text-gray-900">
                    {formatCelsius(view.bedC)} / alvo {formatCelsius(view.bedTargetC)}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-gray-500">Camara</span>
                  <span className="font-semibold text-gray-900">
                    {formatCelsius(view.chamberC)}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2 text-lg font-bold text-gray-900">
                <Layers3 className="h-5 w-5 text-brand-purple" />
                Material
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-gray-500">Tipo</span>
                  <span className="font-semibold text-gray-900">
                    {view.materialType || "-"}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-gray-500">Codigo</span>
                  <span className="font-semibold text-gray-900">
                    {view.materialCode || "-"}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-gray-500">Cor</span>
                  <span className="font-semibold text-gray-900">
                    {view.materialColor || "-"}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2 text-lg font-bold text-gray-900">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Alertas
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-gray-500">Erro</span>
                  <span className="font-semibold text-gray-900">
                    {view.printError}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-gray-500">Falha</span>
                  <span className="font-semibold text-gray-900">
                    {view.failReason || "-"}
                  </span>
                </div>
                {view.events.length === 0 ? (
                  <div className="rounded-lg bg-green-50 p-3 text-green-700">
                    Nenhum evento critico.
                  </div>
                ) : (
                  view.events.map((event, index) => (
                    <div
                      key={`${event.level}-${index}`}
                      className="rounded-lg bg-amber-50 p-3 text-amber-800"
                    >
                      <strong>{event.level}:</strong> {event.message}
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        </>
      )}
      </>
      ) : (
        <section className="space-y-4">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Comandos de controle podem aquecer componentes, mover estados da
            impressora ou interferir em uma impressao. Cada acao exige
            confirmacao antes de entrar na fila.
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <label className="block text-sm font-semibold text-gray-700">
              PIN de comandos
            </label>
            <input
              type="password"
              value={commandPin}
              onChange={(event) => setCommandPin(event.target.value)}
              placeholder="Obrigatorio se configurado no Render"
              className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-brand-purple focus:outline-none focus:ring-2 focus:ring-purple-100"
            />
            <p className="mt-2 text-xs text-gray-500">
              Configure `BAMBU_COMMAND_PIN` no backend para proteger comandos em
              producao.
            </p>
          </div>

          {commandMessage && (
            <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 shadow-sm">
              {commandMessage}
            </div>
          )}

          <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2 text-lg font-bold text-gray-900">
                <Power className="h-5 w-5 text-brand-purple" />
                Acoes rapidas
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() =>
                    createCommand(
                      { type: "chamber_light", mode: "on" },
                      "Ligar a luz da impressora?",
                    )
                  }
                  className="rounded-lg bg-brand-purple px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-purple-900"
                >
                  Ligar luz
                </button>
                <button
                  type="button"
                  onClick={() =>
                    createCommand(
                      { type: "chamber_light", mode: "off" },
                      "Desligar a luz da impressora?",
                    )
                  }
                  className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50"
                >
                  Desligar luz
                </button>
                <button
                  type="button"
                  onClick={() =>
                    createCommand(
                      { type: "pause_print" },
                      "Pausar a impressao atual?",
                    )
                  }
                  className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50"
                >
                  Pausar
                </button>
                <button
                  type="button"
                  onClick={() =>
                    createCommand(
                      { type: "resume_print" },
                      "Retomar a impressao atual?",
                    )
                  }
                  className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50"
                >
                  Retomar
                </button>
                <button
                  type="button"
                  onClick={() =>
                    createCommand(
                      { type: "stop_print" },
                      "Parar a impressao atual? Esta acao pode cancelar o trabalho em andamento.",
                    )
                  }
                  className="rounded-lg bg-red-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-red-700 sm:col-span-2"
                >
                  Parar impressao
                </button>
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2 text-lg font-bold text-gray-900">
                <Flame className="h-5 w-5 text-brand-orange" />
                Temperaturas
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">
                    Mesa aquecida
                  </label>
                  <div className="mt-2 flex gap-2">
                    <input
                      type="number"
                      min="0"
                      max="110"
                      value={bedTemp}
                      onChange={(event) => setBedTemp(event.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-brand-purple focus:outline-none focus:ring-2 focus:ring-purple-100"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        createCommand(
                          { type: "bed_temp", value: Number(bedTemp) },
                          `Alterar temperatura da mesa para ${bedTemp} C?`,
                        )
                      }
                      className="rounded-lg bg-brand-orange px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-600"
                    >
                      Aplicar
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-600">
                    Bico
                  </label>
                  <div className="mt-2 flex gap-2">
                    <input
                      type="number"
                      min="0"
                      max="300"
                      value={nozzleTemp}
                      onChange={(event) => setNozzleTemp(event.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-brand-purple focus:outline-none focus:ring-2 focus:ring-purple-100"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        createCommand(
                          { type: "nozzle_temp", value: Number(nozzleTemp) },
                          `Alterar temperatura do bico para ${nozzleTemp} C?`,
                        )
                      }
                      className="rounded-lg bg-brand-orange px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-600"
                    >
                      Aplicar
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2 text-lg font-bold text-gray-900">
                <Gauge className="h-5 w-5 text-brand-purple" />
                Velocidade
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <select
                  value={speedProfile}
                  onChange={(event) => setSpeedProfile(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-brand-purple focus:outline-none focus:ring-2 focus:ring-purple-100"
                >
                  <option value="1">Silencioso</option>
                  <option value="2">Padrao</option>
                  <option value="3">Sport</option>
                  <option value="4">Ludicrous</option>
                </select>
                <button
                  type="button"
                  onClick={() =>
                    createCommand(
                      { type: "speed_profile", mode: speedProfile },
                      "Alterar perfil de velocidade da impressora?",
                    )
                  }
                  className="rounded-lg bg-brand-purple px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-purple-900"
                >
                  Aplicar
                </button>
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2 text-lg font-bold text-gray-900">
                <Send className="h-5 w-5 text-brand-purple" />
                G-code avancado
              </div>
              <textarea
                value={customGcode}
                onChange={(event) => setCustomGcode(event.target.value)}
                rows={4}
                placeholder="Ex.: M140 S60"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-brand-purple focus:outline-none focus:ring-2 focus:ring-purple-100"
              />
              <button
                type="button"
                onClick={() =>
                  createCommand(
                    { type: "custom_gcode", gcode: customGcode },
                    "Enviar este G-code para a impressora?",
                  )
                }
                className="mt-3 rounded-lg bg-brand-purple px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-purple-900"
              >
                Enviar G-code
              </button>
            </div>
          </section>

          <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-lg font-bold text-gray-900">
                <ListChecks className="h-5 w-5 text-brand-purple" />
                Fila de comandos
              </div>
              <button
                type="button"
                onClick={refreshCommands}
                className="rounded-lg border border-gray-200 bg-white p-2 text-brand-purple shadow-sm hover:bg-purple-50"
                aria-label="Atualizar comandos"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-2">
              {commandHistory.length === 0 ? (
                <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-500">
                  Nenhum comando criado ainda.
                </div>
              ) : (
                commandHistory.map((command) => (
                  <div
                    key={command.id}
                    className="flex flex-col justify-between gap-2 rounded-lg border border-gray-100 bg-gray-50 p-3 text-sm sm:flex-row sm:items-center"
                  >
                    <div>
                      <div className="font-semibold text-gray-900">
                        {command.label}
                      </div>
                      <div className="text-gray-500">
                        {formatDate(command.createdAt)}
                        {command.error ? ` - ${command.error}` : ""}
                      </div>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        command.status === "succeeded"
                          ? "bg-green-100 text-green-700"
                          : command.status === "failed"
                            ? "bg-red-100 text-red-700"
                            : command.status === "claimed"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-purple-100 text-brand-purple"
                      }`}
                    >
                      {command.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>
        </section>
      )}
    </div>
  );
}
