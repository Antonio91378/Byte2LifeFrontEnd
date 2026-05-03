import assert from "node:assert/strict";
import test from "node:test";

import {
    applyDraftFlags,
    buildClonedSalePayload,
    formatSaleDraftIssuesSummary,
    getSaleDraftIssues,
} from "./saleDraft";

test("getSaleDraftIssues lista os campos obrigatorios pendentes", () => {
  const issues = getSaleDraftIssues({
    description: "",
    saleDate: "2026-05-03",
    deliveryDate: "",
    saleValue: 0,
    designPrintTime: "",
    filaments: [],
    hasCustomArt: true,
    designTimeHours: 0,
    designResponsible: "",
  });

  assert.deepEqual(
    issues.map((issue) => issue.id),
    [
      "description",
      "deliveryDate",
      "saleValue",
      "filaments",
      "printTime",
      "designResponsible",
      "designTime",
    ],
  );
  assert.equal(
    formatSaleDraftIssuesSummary(issues),
    "descrição, data de entrega, valor da venda e mais 4",
  );
});

test("applyDraftFlags força status pendente para vendas incompletas", () => {
  const draftPayload = applyDraftFlags({
    description: "Miniatura",
    saleDate: "2026-05-03",
    deliveryDate: "",
    saleValue: 150,
    designPrintTime: "5h",
    filaments: [{ filamentId: "fil-1", massGrams: 120 }],
    printStatus: "InQueue",
    isPrintConcluded: true,
  });

  assert.equal(draftPayload.printStatus, "Pending");
  assert.equal(draftPayload.isPrintConcluded, false);

  const readyPayload = applyDraftFlags({
    description: "Miniatura",
    saleDate: "2026-05-03",
    deliveryDate: "2026-05-10",
    saleValue: 150,
    designPrintTime: "5h",
    filaments: [{ filamentId: "fil-1", massGrams: 120 }],
    printStatus: "InQueue",
    isPrintConcluded: false,
  });

  assert.equal(readyPayload.printStatus, "InQueue");
  assert.equal(readyPayload.isPrintConcluded, false);
});

test("buildClonedSalePayload reseta progresso e cria clone em rascunho", () => {
  const clone = buildClonedSalePayload(
    {
      id: "sale-1",
      description: "Capacete",
      saleDate: "2026-04-10",
      deliveryDate: "2026-04-20",
      saleValue: 300,
      designPrintTime: "8h",
      filaments: [{ filamentId: "fil-1", massGrams: 220 }],
      isPrintConcluded: true,
      isDelivered: true,
      isPaid: true,
      printStatus: "Concluded",
      printStartedAt: "2026-04-11T10:00:00.000Z",
      printStartScheduledAt: "2026-04-11T10:00:00.000Z",
      printStartConfirmedAt: "2026-04-11T10:00:00.000Z",
      designStartConfirmedAt: "2026-04-10T08:00:00.000Z",
      paintStartConfirmedAt: "2026-04-12T08:00:00.000Z",
      incidents: [{ reason: "LayerShift" }],
      attachments: [{ name: "foto.png" }],
      isActive: false,
    },
    "reset",
  );

  assert.equal(clone.id, undefined);
  assert.equal(clone.deliveryDate, null);
  assert.equal(clone.printStatus, "Pending");
  assert.equal(clone.isPrintConcluded, false);
  assert.equal(clone.isDelivered, false);
  assert.equal(clone.isPaid, false);
  assert.equal(clone.printStartedAt, null);
  assert.equal(clone.printStartScheduledAt, null);
  assert.equal(clone.printStartConfirmedAt, null);
  assert.equal(clone.designStartConfirmedAt, null);
  assert.equal(clone.paintStartConfirmedAt, null);
  assert.deepEqual(clone.incidents, []);
  assert.deepEqual(clone.attachments, []);
  assert.equal(clone.isActive, true);
  assert.ok(typeof clone.saleDate === "string" && clone.saleDate.length === 10);
});
