import test from "node:test";
import assert from "node:assert/strict";
import { applyCloudStateToLocal, collectSyncableState, createPortableExport, getCloudStateFingerprint, hasMeaningfulState, loadLatestLocalBackup, loadLocalSnapshot, parsePortableExport, readLegacySnapshot, readStoredSection, removeCloudAccountLocalData, resolveProfileDisplayName, saveLocalBackup, saveLocalSnapshot, validateCloudState } from "../src/cloudSync.js";

function memoryStorage() {
  const values = new Map();
  return { get length() { return values.size; }, key: (index) => [...values.keys()][index] ?? null, getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: (key) => values.delete(key) };
}

const state = (overrides = {}) => collectSyncableState({ tasks: [], courses: ["Other"], courseColors: {}, userSettings: {}, checklists: [], workspaceLayout: { desktop: {}, mobile: {}, collapsed: {} }, theme: "light", displayName: "Student", ...overrides });

test("cloud snapshots exclude device-only reminder and theme settings", () => {
  const snapshot = state({ theme: "dark", userSettings: { textSize: "large", externalPushEnabled: true, notificationsEnabled: true, activeColorThemeId: "ocean-focus", customColors: { page: "#ffffff" }, reminderMinutes: 60 } });
  assert.equal(snapshot.userSettings.textSize, "large");
  assert.equal(snapshot.userSettings.reminderMinutes, 60);
  assert.equal("externalPushEnabled" in snapshot.userSettings, false);
  assert.equal("notificationsEnabled" in snapshot.userSettings, false);
  assert.equal("activeColorThemeId" in snapshot.userSettings, false);
  assert.equal("customColors" in snapshot.userSettings, false);
  assert.equal("theme" in snapshot, false);
});

test("cloud validation rejects malformed account data", () => {
  assert.throws(() => validateCloudState({ schemaVersion: 1, tasks: "bad" }), /invalid/i);
  assert.throws(() => validateCloudState({ ...state(), schemaVersion: 999 }), /newer/i);
});

test("local cloud caches remain isolated by Supabase user id", () => {
  const storage = memoryStorage();
  saveLocalSnapshot(storage, "user-a", state({ tasks: [{ id: "a" }] }), 2, true);
  saveLocalSnapshot(storage, "user-b", state({ tasks: [{ id: "b" }] }), 7, false);
  assert.equal(loadLocalSnapshot(storage, "user-a").tasks[0].id, "a");
  assert.equal(loadLocalSnapshot(storage, "user-b").tasks[0].id, "b");
});

test("applying cloud state preserves device reminder and theme settings", () => {
  const storage = memoryStorage();
  applyCloudStateToLocal(storage, "auth-user", state({ userSettings: { textSize: "small" } }), { externalPushEnabled: true, notificationsEnabled: false, activeColorThemeId: "forest-study", customColors: { page: "#f2f8f1" } });
  const settings = JSON.parse(storage.getItem("settings_auth-user"));
  assert.deepEqual(settings, { textSize: "small", externalPushEnabled: true, notificationsEnabled: false, activeColorThemeId: "forest-study", customColors: { page: "#f2f8f1" } });
});

test("meaningful-state detection protects assignments and custom courses", () => {
  assert.equal(hasMeaningfulState(state()), false);
  assert.equal(hasMeaningfulState(state({ tasks: [{ id: "task" }] })), true);
  assert.equal(hasMeaningfulState(state({ courses: ["Other", "Biology"] })), true);
});

test("cloud account ids are never used as preferred names", () => {
  const storage = memoryStorage();
  const userId = "bbdf6a28-6727-42d2-aafd-8df1048ae28e";
  assert.equal(readLegacySnapshot(storage, userId, {}).displayName, "");
  assert.equal(resolveProfileDisplayName(userId, userId, "David"), "David");
});

test("legacy local profiles keep their preferred names", () => {
  const storage = memoryStorage();
  storage.setItem("taskacadia_preferred_name_student-profile", "Sam");
  assert.equal(readLegacySnapshot(storage, "student-profile", {}).displayName, "Sam");
});

test("saved fingerprints cannot be changed through a shared object reference", () => {
  const task = { id: "task", title: "Original" };
  const snapshot = state({ tasks: [task] });
  const savedFingerprint = getCloudStateFingerprint(snapshot);
  task.title = "Changed later";
  assert.notEqual(getCloudStateFingerprint(snapshot), savedFingerprint);
});

test("deleting a cloud account clears only that account's browser data", () => {
  const storage = memoryStorage();
  saveLocalSnapshot(storage, "deleted-user", state({ tasks: [{ id: "gone" }] }), 2, false);
  storage.setItem("tasks_deleted-user", "[]");
  storage.setItem("taskcabinet_cloud_backup_deleted-user_123", "{}");
  storage.setItem("tasks_other-user", "keep");
  removeCloudAccountLocalData(storage, "deleted-user");
  assert.equal(storage.getItem("tasks_deleted-user"), null);
  assert.equal(storage.getItem("taskcabinet_cloud_backup_deleted-user_123"), null);
  assert.equal(storage.getItem("tasks_other-user"), "keep");
});

test("portable exports round-trip validated planner data", () => {
  const original = state({ tasks: [{ id: "assignment", title: "Essay" }] });
  const exported = createPortableExport(original, "2026-07-13T12:00:00.000Z");
  assert.equal(exported.format, "taskcabinet-export");
  assert.deepEqual(parsePortableExport(exported), original);
  assert.throws(() => parsePortableExport({ format: "unknown" }), /supported/i);
});

test("damaged profile sections fall back independently", () => {
  const storage = memoryStorage();
  storage.setItem("tasks_student", "not-json");
  storage.setItem("courses_student", JSON.stringify(["Biology", "Other"]));
  storage.setItem("settings_student", JSON.stringify({ textSize: "large" }));
  assert.deepEqual(readStoredSection(storage, "tasks_student", [], Array.isArray), []);
  assert.deepEqual(readStoredSection(storage, "courses_student", ["Other"], Array.isArray), ["Biology", "Other"]);
  assert.deepEqual(readStoredSection(storage, "settings_student", {}, (value) => value && typeof value === "object" && !Array.isArray(value)), { textSize: "large" });
  storage.setItem("courses_student", JSON.stringify({ invalid: true }));
  assert.deepEqual(readStoredSection(storage, "courses_student", ["Other"], Array.isArray), ["Other"]);
});

test("latest local recovery backup is validated and skips damaged newer copies", () => {
  const storage = memoryStorage();
  assert.equal(loadLatestLocalBackup(storage, "student"), null);
  const originalNow = Date.now;
  try {
    Date.now = () => 100;
    saveLocalBackup(storage, "student", state({ tasks: [{ id: "safe-copy" }] }));
    storage.setItem("taskcabinet_cloud_backup_student_200", "damaged");
    const backup = loadLatestLocalBackup(storage, "student");
    assert.equal(backup.savedAt, 100);
    assert.equal(backup.state.tasks[0].id, "safe-copy");
  } finally {
    Date.now = originalNow;
  }
});

test("local recovery reports when every saved backup is malformed", () => {
  const storage = memoryStorage();
  storage.setItem("taskcabinet_cloud_backup_student_100", "{}");
  assert.throws(() => loadLatestLocalBackup(storage, "student"), /could not be read safely/i);
});
