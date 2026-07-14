import test from "node:test";
import assert from "node:assert/strict";
import { formatFocusDuration, getFocusTimeUpdate } from "../src/focusSessionUtils.js";

test("formats short and hour-long focus durations", () => {
  assert.equal(formatFocusDuration(65), "01:05");
  assert.equal(formatFocusDuration(3661), "1:01:01");
});

test("adds rounded session minutes without changing the estimate by default", () => {
  assert.deepEqual(getFocusTimeUpdate({ focusMinutesSpent: 5, estimatedMinutes: 30 }, 61), {
    focusMinutesSpent: 7,
  });
});

test("optionally reduces the remaining estimate without going below zero", () => {
  assert.deepEqual(getFocusTimeUpdate({ estimatedMinutes: 10 }, 721, true), {
    focusMinutesSpent: 13,
    estimatedMinutes: 0,
  });
});
