import assert from "node:assert/strict";
import test from "node:test";

import {
    getNozzle02CompatibilityLabel,
    getNozzle02CompatibilityValue,
    toNozzle02CompatibilityPayload,
} from "./filamentNozzleCompatibility";

test("getNozzle02CompatibilityValue maps backend values to tri-state", () => {
  assert.equal(
    getNozzle02CompatibilityValue({ isNozzle02Compatible: true }),
    "compatible",
  );
  assert.equal(
    getNozzle02CompatibilityValue({ isNozzle02Compatible: false }),
    "incompatible",
  );
  assert.equal(
    getNozzle02CompatibilityValue({ isNozzle02Compatible: null }),
    "unknown",
  );
  assert.equal(getNozzle02CompatibilityValue({}), "unknown");
});

test("toNozzle02CompatibilityPayload preserves unknown as null", () => {
  assert.equal(toNozzle02CompatibilityPayload("compatible"), true);
  assert.equal(toNozzle02CompatibilityPayload("incompatible"), false);
  assert.equal(toNozzle02CompatibilityPayload("unknown"), null);
  assert.equal(
    getNozzle02CompatibilityLabel("unknown"),
    "Bico 0.2: desconhecido",
  );
});
