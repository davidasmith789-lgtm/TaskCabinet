import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DEFAULT_GAMIFICATION, getNewAchievementIds, normalizeGamification, summarizeWeeklyMomentum } from "../src/gamificationUtils.js";

const completedTask = (id, completedAt, extra = {}) => ({ id, title: id, isCompleted: true, completedAt, ...extra });

test("weekly momentum honors week starts, ignores legacy and deleted work, and clamps goals", () => {
  const now = new Date(2026, 6, 22, 12);
  const tasks = [
    completedTask("sun", "2026-07-19T12:00:00"),
    completedTask("mon", "2026-07-20T12:00:00"),
    completedTask("legacy", null),
    completedTask("deleted", "2026-07-21T12:00:00", { isDeleted: true }),
  ];
  assert.deepEqual(summarizeWeeklyMomentum(tasks, { weeklyGoal: 5 }, { now, weekStartsOn: "sunday" }), { completed: 2, goal: 5, productiveDays: 2, progress: 40, goalReached: false });
  assert.equal(summarizeWeeklyMomentum(tasks, { weeklyGoal: 5 }, { now, weekStartsOn: "monday" }).completed, 1);
  assert.equal(normalizeGamification({ weeklyGoal: 999 }).weeklyGoal, 50);
  assert.equal(normalizeGamification({ weeklyGoal: -2 }).weeklyGoal, 1);
});

test("achievements unlock from totals, weekly consistency, and completion context without duplicates", () => {
  const tasks = [0, 1, 2, 3, 4].map((offset) => completedTask(String(offset), `2026-07-${20 + offset}T12:00:00`, { priority: offset === 4 ? "HIGH" : "MED" }));
  const unlocked = getNewAchievementIds(tasks, { ...DEFAULT_GAMIFICATION, weeklyGoal: 5 }, { priority: "HIGH", wasOverdue: true, source: "focus" }, { now: new Date(2026, 6, 24), weekStartsOn: "sunday" });
  for (const id of ["first-completion", "five-completions", "weekly-goal", "three-productive-days", "high-priority", "overdue-recovery", "focus-finish"]) assert.ok(unlocked.includes(id));
  assert.deepEqual(getNewAchievementIds(tasks, { weeklyGoal: 5, earnedAchievementIds: unlocked }, { priority: "HIGH", wasOverdue: true, source: "focus" }, { now: new Date(2026, 6, 24) }), []);
});

test("locked cosmetics cannot be restored as selected", () => {
  const normalized = normalizeGamification({ selectedConfetti: "stars", selectedTitle: "focus-finisher", earnedAchievementIds: [] });
  assert.equal(normalized.selectedConfetti, "standard");
  assert.equal(normalized.selectedTitle, "getting-started");
});

test("completion paths timestamp work, undo clears it, and celebration covers the viewport", async () => {
  const [app, css] = await Promise.all([
    readFile(new URL("../src/App.jsx", import.meta.url), "utf8"),
    readFile(new URL("../src/App.css", import.meta.url), "utf8"),
  ]);
  assert.match(app, /completedAt,/);
  assert.match(app, /completedAt: null/);
  assert.match(app, /source: "focus"/);
  assert.match(app, /source: "related-tasks"/);
  assert.match(app, /Momentum & Achievements/);
  assert.match(css, /\.completion-celebration\s*\{[\s\S]*?inset: 0;/);
  assert.match(css, /calc\(100vh \+ 40px\)/);
  assert.match(css, /\.reduce-motion \.completion-confetti/);
});
