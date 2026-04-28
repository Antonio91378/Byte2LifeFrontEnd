import assert from "node:assert/strict";
import test from "node:test";

import {
    aggregateActiveSalesByDay,
    aggregateActiveSalesByMonth,
    buildInvestmentSummary,
} from "./investmentMetrics";

function assertClose(actual: number, expected: number) {
  assert.equal(Number(actual.toFixed(2)), Number(expected.toFixed(2)));
}

test("buildInvestmentSummary excludes inactive sales from lucro, receita and ROI", () => {
  const summary = buildInvestmentSummary({
    sales: [
      {
        description: "VALIDACAO VISUAL - Venda hibernavel",
        isActive: false,
        saleDate: "2026-04-27T12:00:00.000Z",
        saleValue: 249.9,
        profit: 151.6,
      },
      {
        description: "Venda ativa",
        isActive: true,
        saleDate: "2026-04-27T12:00:00.000Z",
        saleValue: 100,
        profit: 40,
      },
      {
        description: "Venda legada ativa",
        saleDate: "2026-04-20T12:00:00.000Z",
        saleValue: "80,00",
        profit: "30,00",
      },
    ],
    designTasks: [{ value: 10 }],
    paintingTasks: [{ Value: "5,50" }],
    investments: [{ amount: 50 }],
  });

  assert.equal(summary.activeSales.length, 2);
  assertClose(summary.totalProfit, 85.5);
  assertClose(summary.totalRevenue, 195.5);
  assertClose(summary.totalInvestment, 50);
  assertClose(summary.balance, 35.5);
  assertClose(summary.progress, 171);
});

test("aggregateActiveSalesByMonth and aggregateActiveSalesByDay ignore inactive sales", () => {
  const sales = [
    {
      description: "VALIDACAO VISUAL - Venda hibernavel",
      isActive: false,
      saleDate: "2026-04-27T12:00:00.000Z",
      profit: 151.6,
    },
    {
      description: "Venda ativa",
      isActive: true,
      saleDate: "2026-04-27T12:00:00.000Z",
      profit: 40,
    },
    {
      description: "Venda legada ativa",
      saleDate: "2026-04-20T12:00:00.000Z",
      profit: "30,00",
    },
    {
      description: "Venda maio",
      isActive: true,
      saleDate: "2026-05-01T12:00:00.000Z",
      profit: 10,
    },
  ];

  assert.deepEqual(aggregateActiveSalesByMonth(sales), [
    {
      label: "2026-04",
      value: 70,
      description: "Lucro de 2026-04",
    },
    {
      label: "2026-05",
      value: 10,
      description: "Lucro de 2026-05",
    },
  ]);

  assert.deepEqual(aggregateActiveSalesByDay(sales, "2026-04"), [
    {
      label: "2026-04-27",
      value: 40,
      description: "Lucro em 2026-04-27",
    },
    {
      label: "2026-04-20",
      value: 30,
      description: "Lucro em 2026-04-20",
    },
  ]);
});
