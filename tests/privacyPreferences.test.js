import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  PRIVACY_PREFERENCES_STORAGE_KEY,
  readPrivacyPreferences,
  writePrivacyPreferences,
} from "../src/privacyPreferences.js";

const read = (relativePath) => readFile(new URL(relativePath, import.meta.url), "utf8");
const createStorage = (initial = {}) => {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
  };
};

test("analytics is off when the browser has no valid preference", () => {
  assert.deepEqual(readPrivacyPreferences(createStorage()), { version: 1, analyticsEnabled: false });
  assert.deepEqual(
    readPrivacyPreferences(createStorage({ [PRIVACY_PREFERENCES_STORAGE_KEY]: "damaged" })),
    { version: 1, analyticsEnabled: false },
  );
  assert.deepEqual(
    readPrivacyPreferences(createStorage({ [PRIVACY_PREFERENCES_STORAGE_KEY]: JSON.stringify({ version: 1, analyticsEnabled: "yes" }) })),
    { version: 1, analyticsEnabled: false },
  );
});

test("analytics preference enables, disables, and persists per browser", () => {
  const storage = createStorage();
  writePrivacyPreferences(storage, true);
  assert.equal(readPrivacyPreferences(storage).analyticsEnabled, true);
  writePrivacyPreferences(storage, false);
  assert.equal(readPrivacyPreferences(storage).analyticsEnabled, false);
});

test("privacy controls gate telemetry and stay outside planner sync and exports", async () => {
  const app = await read("../src/App.jsx");
  const cloudSync = await read("../src/cloudSync.js");
  const privacy = await read("../src/PrivacyDataPanel.jsx");

  assert.match(app, /analyticsEnabled && <Suspense fallback=\{null\}><Telemetry \/><\/Suspense>/);
  assert.match(app, /settingsSection === "privacy"/);
  assert.match(app, /PrivacyDataDialog open=\{privacyDialogOpen\}/);
  assert.doesNotMatch(cloudSync, /glowdocket_privacy_preferences/);
  assert.match(privacy, /role="dialog" aria-modal="true" aria-labelledby="privacy-dialog-title"/);
  assert.match(privacy, /event\.key === "Escape"/);
  assert.match(privacy, /event\.key !== "Tab"/);
  assert.match(privacy, /trigger\?\.focus/);
  assert.match(privacy, /role="status" aria-live="polite"/);
});
