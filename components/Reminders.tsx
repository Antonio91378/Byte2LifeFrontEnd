"use client";

import { useDialog } from "@/context/DialogContext";
import axios from "axios";
import { useEffect, useMemo, useState } from "react";
import Modal from "./Modal";

interface Reminder {
  id: string;
  title: string;
  isDone: boolean;
  createdAt: string;
  updatedAt?: string | null;
}

const API_URL = "http://localhost:5000/api/reminders";

export default function Reminders() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [useLocalFallback, setUseLocalFallback] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formIsDone, setFormIsDone] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isExpandHovered, setIsExpandHovered] = useState(false);
  const { showAlert, showConfirm } = useDialog();

  const pendingCount = useMemo(
    () => reminders.filter((reminder) => !reminder.isDone).length,
    [reminders],
  );

  const storageKey = "byte2life_reminders";

  const readLocalReminders = () => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const writeLocalReminders = (items: Reminder[]) => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(storageKey, JSON.stringify(items));
  };

  const sortReminders = (items: Reminder[]) =>
    [...items].sort((a, b) => {
      if (a.isDone !== b.isDone) return a.isDone ? 1 : -1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  const upsertLocalReminder = (
    items: Reminder[],
    payload: { title: string; isDone: boolean },
    id?: string | null,
  ) => {
    if (id) {
      return items.map((item) =>
        item.id === id
          ? {
              ...item,
              title: payload.title,
              isDone: payload.isDone,
              updatedAt: new Date().toISOString(),
            }
          : item,
      );
    }

    const newItem: Reminder = {
      id:
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      title: payload.title,
      isDone: payload.isDone,
      createdAt: new Date().toISOString(),
      updatedAt: null,
    };
    return [...items, newItem];
  };

  const activateLocalMode = (items: Reminder[]) => {
    setUseLocalFallback(true);
    setReminders(sortReminders(items));
    setErrorMessage("");
  };

  const syncLocalToApi = async (serverItems: Reminder[]) => {
    const localItems = readLocalReminders();
    if (localItems.length === 0) {
      return serverItems;
    }

    const existing = new Set(
      serverItems.map(
        (item) => `${item.title.trim().toLowerCase()}|${item.isDone}`,
      ),
    );

    const toCreate = localItems.filter((item) => {
      const key = `${item.title.trim().toLowerCase()}|${item.isDone}`;
      return !existing.has(key);
    });

    if (toCreate.length === 0) {
      writeLocalReminders([]);
      return serverItems;
    }

    await Promise.allSettled(
      toCreate.map((item) =>
        axios.post(API_URL, {
          title: item.title,
          isDone: item.isDone,
        }),
      ),
    );

    writeLocalReminders([]);
    const refreshed = await axios.get(API_URL);
    return Array.isArray(refreshed.data) ? refreshed.data : serverItems;
  };

  const shouldFallbackToLocal = (error: unknown) => {
    if (!axios.isAxiosError(error)) return false;
    const status = error.response?.status;
    return status === 404 || status === 405;
  };

  const fetchReminders = async () => {
    if (useLocalFallback) {
      const localItems = sortReminders(readLocalReminders());
      setReminders(localItems);
      setErrorMessage("");
      setLoading(false);
      return;
    }

    try {
      const res = await axios.get(API_URL);
      const merged = await syncLocalToApi(
        Array.isArray(res.data) ? res.data : [],
      );
      setReminders(sortReminders(merged));
      setErrorMessage("");
    } catch (error) {
      if (shouldFallbackToLocal(error)) {
        const localItems = readLocalReminders();
        activateLocalMode(localItems);
      } else {
        console.error("Error fetching reminders:", error);
        setReminders([]);
        setErrorMessage("Lembretes indisponiveis no momento.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReminders();
  }, []);

  const openNew = () => {
    setEditingId(null);
    setFormTitle("");
    setFormIsDone(false);
    setIsModalOpen(true);
  };

  const openEdit = (reminder: Reminder) => {
    setEditingId(reminder.id);
    setFormTitle(reminder.title);
    setFormIsDone(reminder.isDone);
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    const trimmed = formTitle.trim();
    if (!trimmed) {
      showAlert("Atencao", "Informe o texto do lembrete.", "warning");
      return;
    }

    const payload = {
      title: trimmed,
      isDone: formIsDone,
    };

    try {
      if (useLocalFallback) {
        const localItems = readLocalReminders();
        const nextItems = upsertLocalReminder(localItems, payload, editingId);
        writeLocalReminders(nextItems);
        activateLocalMode(nextItems);
        setIsModalOpen(false);
        return;
      }

      if (editingId) {
        await axios.put(`${API_URL}/${editingId}`, payload);
      } else {
        await axios.post(API_URL, payload);
      }
      setIsModalOpen(false);
      await fetchReminders();
    } catch (error) {
      if (shouldFallbackToLocal(error)) {
        const localItems = readLocalReminders();
        const nextItems = upsertLocalReminder(localItems, payload, editingId);
        writeLocalReminders(nextItems);
        activateLocalMode(nextItems);
        setIsModalOpen(false);
      } else {
        console.error("Error saving reminder:", error);
        showAlert("Erro", "Falha ao salvar lembrete.", "error");
      }
    }
  };

  const handleToggleDone = async (reminder: Reminder) => {
    try {
      if (useLocalFallback) {
        const localItems = readLocalReminders();
        const nextItems = localItems.map((item) =>
          item.id === reminder.id
            ? {
                ...item,
                isDone: !reminder.isDone,
                updatedAt: new Date().toISOString(),
              }
            : item,
        );
        writeLocalReminders(nextItems);
        setReminders(sortReminders(nextItems));
        return;
      }

      await axios.put(`${API_URL}/${reminder.id}`, {
        title: reminder.title,
        isDone: !reminder.isDone,
      });
      await fetchReminders();
    } catch (error) {
      if (shouldFallbackToLocal(error)) {
        const localItems = readLocalReminders();
        const nextItems = localItems.map((item) =>
          item.id === reminder.id
            ? {
                ...item,
                isDone: !reminder.isDone,
                updatedAt: new Date().toISOString(),
              }
            : item,
        );
        writeLocalReminders(nextItems);
        activateLocalMode(nextItems);
      } else {
        console.error("Error updating reminder:", error);
        showAlert("Erro", "Falha ao atualizar lembrete.", "error");
      }
    }
  };

  const handleDelete = (id: string) => {
    showConfirm(
      "Excluir Lembrete",
      "Deseja remover este lembrete?",
      async () => {
        try {
          if (useLocalFallback) {
            const localItems = readLocalReminders().filter(
              (item) => item.id !== id,
            );
            writeLocalReminders(localItems);
            activateLocalMode(localItems);
            return;
          }

          await axios.delete(`${API_URL}/${id}`);
          await fetchReminders();
        } catch (error) {
          if (shouldFallbackToLocal(error)) {
            const localItems = readLocalReminders().filter(
              (item) => item.id !== id,
            );
            writeLocalReminders(localItems);
            activateLocalMode(localItems);
          } else {
            console.error("Error deleting reminder:", error);
            showAlert("Erro", "Falha ao excluir lembrete.", "error");
          }
        }
      },
    );
  };

  const cardBackgroundClass = isCollapsed
    ? isExpandHovered
      ? "bg-white backdrop-blur-none"
      : "bg-white/30 backdrop-blur-sm"
    : "bg-white";

  return (
    <div
      className={`rounded-2xl border border-gray-100 p-4 shadow-sm transition-all duration-200 sm:p-5 ${cardBackgroundClass}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-gray-800 sm:text-lg">
            Lembretes
          </h2>
          <p className="text-xs text-gray-500">{pendingCount} pendentes</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsCollapsed((prev) => !prev)}
            onMouseEnter={() => setIsExpandHovered(true)}
            onMouseLeave={() => setIsExpandHovered(false)}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 text-gray-600 transition-colors hover:border-gray-300 hover:text-gray-900 sm:h-9 sm:w-9"
            title={isCollapsed ? "Mostrar lembretes" : "Ocultar lembretes"}
            aria-label={isCollapsed ? "Mostrar lembretes" : "Ocultar lembretes"}
          >
            {isCollapsed ? (
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
                  d="M5 12h14"
                ></path>
              </svg>
            ) : (
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
                  d="M5 15l7-7 7 7"
                ></path>
              </svg>
            )}
          </button>
          <button
            onClick={openNew}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-purple text-white transition-colors hover:bg-purple-800 sm:h-9 sm:w-9"
            title="Adicionar lembrete"
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
          </button>
        </div>
      </div>

      {isCollapsed ? (
        <div
          className={`mt-3 rounded-lg border border-white/40 px-3 py-2 text-xs text-gray-600 transition-all duration-200 sm:mt-4 ${
            isExpandHovered
              ? "bg-white backdrop-blur-none"
              : "bg-white/30 backdrop-blur-sm"
          }`}
        >
          Lembretes ocultos.
        </div>
      ) : (
        <div className="mt-3 max-h-72 space-y-3 overflow-y-auto pr-1 sm:mt-4 sm:max-h-90">
          {loading ? (
            <div className="text-sm text-gray-500">Carregando...</div>
          ) : errorMessage ? (
            <div className="text-sm text-gray-500 italic">{errorMessage}</div>
          ) : (
            <>
              {useLocalFallback && (
                <div className="text-xs text-gray-500 italic">
                  Lembretes em modo local.
                </div>
              )}
              {reminders.length === 0 ? (
                <div className="text-sm text-gray-500 italic">
                  Nenhum lembrete cadastrado.
                </div>
              ) : (
                reminders.map((reminder) => (
                  <div
                    key={reminder.id}
                    className={`flex items-start gap-2.5 rounded-lg border p-2.5 sm:gap-3 sm:p-3 ${
                      reminder.isDone
                        ? "bg-gray-50 border-gray-200"
                        : "bg-amber-50 border-amber-100"
                    }`}
                  >
                    <button
                      onClick={() => handleToggleDone(reminder)}
                      className={`mt-0.5 w-5 h-5 rounded-full border flex items-center justify-center ${
                        reminder.isDone
                          ? "bg-green-500 border-green-500 text-white"
                          : "border-amber-400 text-amber-500"
                      }`}
                      title={
                        reminder.isDone
                          ? "Marcar como pendente"
                          : "Marcar como concluido"
                      }
                    >
                      {reminder.isDone ? (
                        <svg
                          className="w-3.5 h-3.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="3"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      ) : (
                        <svg
                          className="w-3.5 h-3.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M12 8v4m0 4h.01"
                          />
                        </svg>
                      )}
                    </button>

                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm font-medium ${reminder.isDone ? "text-gray-400 line-through" : "text-gray-800"}`}
                      >
                        {reminder.title}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Criado em{" "}
                        {new Date(reminder.createdAt).toLocaleDateString(
                          "pt-BR",
                        )}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEdit(reminder)}
                        className="text-gray-400 hover:text-brand-purple transition-colors"
                        title="Editar lembrete"
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
                      </button>
                      <button
                        onClick={() => handleDelete(reminder.id)}
                        className="text-gray-400 hover:text-red-600 transition-colors"
                        title="Excluir lembrete"
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
                      </button>
                    </div>
                  </div>
                ))
              )}
            </>
          )}
        </div>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingId ? "Editar Lembrete" : "Novo Lembrete"}
        footer={
          <>
            <button
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 rounded-lg font-medium text-gray-600 hover:bg-gray-100 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 rounded-lg font-medium bg-brand-purple hover:bg-purple-800 text-white transition-colors"
            >
              Salvar
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Texto do lembrete
            </label>
            <textarea
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              rows={3}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-purple focus:border-transparent text-gray-900"
              placeholder="Ex: Fazer orcamento para o cliente X"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={formIsDone}
              onChange={(e) => setFormIsDone(e.target.checked)}
              className="h-4 w-4 text-brand-purple border-gray-300 rounded"
            />
            Marcar como concluido
          </label>
        </div>
      </Modal>
    </div>
  );
}
