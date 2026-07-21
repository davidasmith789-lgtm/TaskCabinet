import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("completed assignment cards are never styled as overdue", async () => {
  const app = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");

  assert.match(app, /const overdue = status !== "completed" && getTaskDueBucket\(task\)\.startsWith\("Overdue"\);/);
  assert.match(app, /\$\{overdue \? " is-overdue" : ""\}/);
});
