import assert from "node:assert/strict";
import test from "node:test";

import { calculateConsecutiveUpDays } from "../src/lib/quant-rules.ts";

const bar = (open, close) => ({ open, close });

test("detects a strict three-day positive streak", () => {
  const candles = [
    bar(9.8, 10),
    bar(10.1, 10.5),
    bar(10.6, 11),
    bar(11.1, 11.5),
  ];
  assert.equal(calculateConsecutiveUpDays(candles), 3);
});

test("detects four-up as a four-day streak", () => {
  const candles = [
    bar(9.8, 10),
    bar(10.1, 10.4),
    bar(10.5, 10.8),
    bar(10.9, 11.2),
    bar(11.3, 11.6),
  ];
  assert.equal(calculateConsecutiveUpDays(candles), 4);
});

test("stops at the latest bearish candle or doji", () => {
  assert.equal(calculateConsecutiveUpDays([
    bar(9.8, 10),
    bar(10.2, 10.1),
  ]), 0);
  assert.equal(calculateConsecutiveUpDays([
    bar(9.8, 10),
    bar(10.3, 10.3),
  ]), 0);
});

test("requires each close to exceed the previous close", () => {
  const candles = [
    bar(9.8, 10),
    bar(9.9, 10.5),
    bar(9.8, 10.4),
  ];
  assert.equal(calculateConsecutiveUpDays(candles), 0);
});
