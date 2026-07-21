import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (relativePath) => readFile(new URL(relativePath, import.meta.url), "utf8");

test("assignment expansion passes the flashcard component its required task contract", async () => {
  const app = await read("../src/App.jsx");

  assert.match(app, /<AssignmentFlashcards\s+task=\{task\}\s+userId=\{currentUser\}\s+onOpenDeck=/);
  assert.doesNotMatch(app, /<AssignmentFlashcards\s+assignment=/);
});

test("assignment flashcards fail closed when assignment data is unavailable", async () => {
  const component = await read("../src/components/AssignmentFlashcards.jsx");

  assert.match(component, /\{ task = \{\}, userId, onOpenDeck = \(\) => \{\} \}/);
  assert.match(component, /if \(!task\.id \|\| !userId\) return;/);
  assert.match(component, /if \(!task\.id\) return null;/);
});

test("assignment cards use clean actions and stronger title hierarchy", async () => {
  const styles = await read("../src/App.css");

  assert.match(styles, /\.task-title-text \{[^}]*font-size: clamp\(1\.08rem, 1\.4vw, 1\.22rem\);/);
  assert.match(styles, /\.task-course-pill \{[^}]*min-height: 31px;[^}]*padding: 6px 12px;[^}]*font-size: 0\.8rem;/);
  assert.match(styles, /\.task-actions \{\s*align-items: center;[^}]*padding: 0;[^}]*border: 0;[^}]*background: transparent;/);
});
