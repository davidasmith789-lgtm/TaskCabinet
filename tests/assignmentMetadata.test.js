import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { getUniqueAssignmentMetadata } from "../src/assignmentMetadataUtils.js";

const read = (relativePath) => readFile(new URL(relativePath, import.meta.url), "utf8");

test("specific countdowns replace generic due and overdue labels", () => {
  const overdue = getUniqueAssignmentMetadata({
    dueLabel: "Overdue",
    countdownLabel: "Overdue by 6 days",
    reasons: ["Overdue", "High priority", "2/3 checklist steps done"],
    priorityShown: true,
  });
  assert.deepEqual(overdue, {
    dueLabel: "",
    countdownLabel: "Overdue by 6 days",
    reasons: ["2/3 checklist steps done"],
  });

  const dueToday = getUniqueAssignmentMetadata({
    dueLabel: "Due today",
    countdownLabel: "6h 47m left today",
    reasons: ["Due today"],
  });
  assert.equal(dueToday.dueLabel, "");
  assert.deepEqual(dueToday.reasons, []);
});

test("duration, workflow, completion, and no-date labels are not repeated", () => {
  const inProgress = getUniqueAssignmentMetadata({
    dueLabel: "Due Friday",
    reasons: ["In progress", "Long project", "High priority"],
    priorityShown: true,
    statusShown: true,
    estimateShown: true,
  });
  assert.deepEqual(inProgress.reasons, []);
  assert.equal(inProgress.dueLabel, "Due Friday");

  const completed = getUniqueAssignmentMetadata({ reasons: ["Completed"], statusShown: true });
  assert.deepEqual(completed.reasons, []);

  const noDate = getUniqueAssignmentMetadata({ dueLabel: "No due date", reasons: ["Needs date"] });
  assert.equal(noDate.dueLabel, "No due date");
  assert.deepEqual(noDate.reasons, []);
});

test("cards and recommendations share centralized non-duplicating metadata", async () => {
  const app = await read("../src/App.jsx");
  assert.match(app, /const renderRecommendationMetadata =/);
  assert.match(app, /getUniqueAssignmentMetadata\(/);
  assert.match(app, /renderRecommendationMetadata\(item, \{ showCourse: true \}\)/);
  assert.match(app, /renderRecommendationMetadata\(item\)/);
  assert.doesNotMatch(app, /return `\$\{getTaskCourseOrCategory\(task\)\} \|/);
  assert.match(app, /mobile-task-level-\$\{mobileLevel\}/);
});

test("assignment workflow wording uses In Progress without changing unrelated start concepts", async () => {
  const app = await read("../src/App.jsx");
  assert.doesNotMatch(app, /Use Start when you begin/);
  assert.doesNotMatch(app, />Start this</);
  assert.match(app, /Choose In Progress when you begin something/);
  assert.match(app, />In Progress<\/button>/);
  assert.match(app, /calendarWeekStartsOn/);
});
