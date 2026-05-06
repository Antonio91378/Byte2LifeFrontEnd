import assert from "node:assert/strict";
import test from "node:test";
import {
  formatDateOnly,
  getDateOnlySortValue,
  getLocalDateOnlyValue,
  toDateOnlyValue,
} from "./dateOnly";

test("formats API date-only values without timezone shifting", () => {
  assert.equal(formatDateOnly("2026-05-17T00:00:00Z"), "17/05/2026");
  assert.equal(formatDateOnly("2026-04-24"), "24/04/2026");
});

test("normalizes date-only input values", () => {
  assert.equal(toDateOnlyValue("2026-05-17T00:00:00Z"), "2026-05-17");
  assert.equal(toDateOnlyValue(""), "");
});

test("sorts date-only values by calendar day", () => {
  assert.equal(
    getDateOnlySortValue("2026-05-17T00:00:00Z"),
    Date.UTC(2026, 4, 17),
  );
});

test("creates local date input values", () => {
  assert.equal(getLocalDateOnlyValue(new Date(2026, 4, 17, 23, 30)), "2026-05-17");
});
