import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (relativePath) => readFile(new URL(relativePath, import.meta.url), "utf8");

test("service worker waits for user approval before activating an update", async () => {
  const [worker, updates] = await Promise.all([
    read("../public/sw.js"),
    read("../src/serviceWorkerUpdates.js"),
  ]);

  assert.equal([...worker.matchAll(/self\.skipWaiting\(\)/g)].length, 1);
  assert.match(worker, /event\.data\?\.type === "SKIP_WAITING"/);
  assert.match(updates, /waitingWorker\.postMessage\(\{ type: "SKIP_WAITING" \}\)/);
  assert.match(updates, /registration\.waiting/);
  assert.match(updates, /registration\.addEventListener\("updatefound"/);
});

test("update handling checks again and reloads only after activation", async () => {
  const [updates, prompt, main] = await Promise.all([
    read("../src/serviceWorkerUpdates.js"),
    read("../src/ServiceWorkerUpdatePrompt.jsx"),
    read("../src/main.jsx"),
  ]);

  assert.match(updates, /serviceWorker\.addEventListener\("controllerchange"/);
  assert.match(updates, /if \(reloadRequested\) reloadForServiceWorkerUpdate/);
  assert.match(updates, /registration\.update\(\)/);
  assert.match(updates, /addEventListener\("online", checkForUpdate\)/);
  assert.match(updates, /setInterval\(checkForUpdate, 60 \* 60 \* 1000\)/);
  assert.match(prompt, /role="status" aria-live="polite"/);
  assert.match(prompt, /Finish any open edits/);
  assert.match(prompt, />Later<\/button>/);
  assert.match(main, /<ServiceWorkerUpdatePrompt \/>/);
});
