import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { getTutorialStorageKey, shouldStartTutorialForProfile } from "../src/onboardingUtils.js";

const read = (relativePath) => readFile(new URL(relativePath, import.meta.url), "utf8");

test("only a profile without tutorial history starts the tutorial automatically", async () => {
  const app = await read("../src/App.jsx");
  const values = new Map();
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };

  assert.match(app, /const startTutorialForProfile = \(profileKey\) =>/);
  assert.match(app, /if \(!shouldStartTutorialForProfile\(localStorage, profileKey\)\) return;/);
  assert.equal(shouldStartTutorialForProfile(storage, "student"), true);
  storage.setItem(getTutorialStorageKey("student"), JSON.stringify({ complete: false }));
  assert.equal(shouldStartTutorialForProfile(storage, "student"), false);
  storage.setItem(getTutorialStorageKey("student"), JSON.stringify({ complete: true }));
  assert.equal(shouldStartTutorialForProfile(storage, "student"), false);
});

test("tutorial is available on mobile and has no skip control", async () => {
  const [app, styles] = await Promise.all([read("../src/App.jsx"), read("../src/App.css")]);

  assert.match(app, /\{tutorialOpen && \(/);
  assert.doesNotMatch(app, /tutorialOpen && !isMobileUi/);
  assert.doesNotMatch(app, /Skip tutorial|className="tutorial-skip"/);
  assert.doesNotMatch(styles, /\.tutorial-skip/);
  assert.match(app, /<button type="button" className="btn btn-primary" onClick=\{finishTutorial\}>Finish<\/button>/);
});

test("the welcome page offers an isolated browser-only guest preview", async () => {
  const [app, styles] = await Promise.all([read("../src/App.jsx"), read("../src/App.css")]);

  assert.match(app, /const continueAsGuest = \(\) =>/);
  assert.match(app, /setAccountMode\("local"\);[\s\S]*?setCurrentUser\("guest"\);/);
  assert.match(app, /onClick=\{continueAsGuest\}>Continue as Guest<\/button>/);
  assert.match(styles, /\.welcome-header-actions \{[^}]*display: grid;/);
});
