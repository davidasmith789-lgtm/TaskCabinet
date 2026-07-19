import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("assignment completion uses accessible dependency-free confetti with reduced-motion fallbacks", async () => {
  const [app, css, packageJson] = await Promise.all([
    readFile(new URL("../src/App.jsx", import.meta.url), "utf8"),
    readFile(new URL("../src/App.css", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(app, /setCompletionCelebration/);
  assert.match(app, /className="completion-confetti" aria-hidden="true"/);
  assert.match(app, /COMPLETION_CONFETTI\.map/);
  assert.match(css, /@keyframes completion-confetti-fall/);
  assert.match(css, /\.reduce-motion \.completion-confetti \{ display: none; \}/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.doesNotMatch(packageJson, /confetti|canvas-confetti/);
});
