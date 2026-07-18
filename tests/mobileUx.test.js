import test from "node:test";
import assert from "node:assert/strict";
import { getReminderActionLabel, getWorkflowLabel, MOBILE_TASK_LEVELS, nextMobileTaskLevel, passwordsMatch, splitActiveAndOverdue } from "../src/mobileUxUtils.js";

test("mobile cards cycle through compact, summary, details, and compact", () => {
  assert.equal(nextMobileTaskLevel(MOBILE_TASK_LEVELS.compact), MOBILE_TASK_LEVELS.summary);
  assert.equal(nextMobileTaskLevel(MOBILE_TASK_LEVELS.summary), MOBILE_TASK_LEVELS.details);
  assert.equal(nextMobileTaskLevel(MOBILE_TASK_LEVELS.details), MOBILE_TASK_LEVELS.compact);
});

test("active and overdue mobile categories are mutually exclusive", () => {
  const tasks = [{ id: 1, bucket: "Overdue 🚨" }, { id: 2, bucket: "Due Today ⏰" }, { id: 3, bucket: "Later" }];
  const result = splitActiveAndOverdue(tasks, (task) => task.bucket);
  assert.deepEqual(result.overdue.map((task) => task.id), [1]);
  assert.deepEqual(result.active.map((task) => task.id), [2, 3]);
});

test("mobile labels do not change stored workflow values", () => {
  assert.equal(getWorkflowLabel("todo"), "To Do");
  assert.equal(getWorkflowLabel("inProgress"), "In Progress");
  assert.equal(getWorkflowLabel("completed"), "Completed");
});

test("password validation only requires a value and matching confirmation", () => {
  assert.equal(passwordsMatch("a", "a"), true);
  assert.equal(passwordsMatch("a", "b"), false);
  assert.equal(passwordsMatch("", ""), false);
});

test("reminder action copy reflects verified connection state", () => {
  assert.equal(getReminderActionLabel("active", true), "Connected");
  assert.equal(getReminderActionLabel("blocked", true), "Blocked in Browser Settings");
  assert.equal(getReminderActionLabel("unsupported", false), "Unsupported on This Device");
  assert.equal(getReminderActionLabel("needs_attention", true), "Failed — Retry");
  assert.equal(getReminderActionLabel("off", false), "Enable Reminders");
});
