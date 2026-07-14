import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { MANUAL_ACCESSIBILITY_CHECKS, runAccessibilityAudit } from "../src/accessibilityAudit.js";

const element = ({ tagName = "BUTTON", id = "", text = "", attrs = {}, labels = [] } = {}) => ({
  tagName, id, textContent: text, labels,
  getAttribute: (name) => attrs[name] ?? (name === "type" ? "" : null),
  hasAttribute: (name) => name in attrs,
  closest: () => null,
});

const root = (collections) => ({ querySelectorAll: (selector) => collections[selector] || [] });

test("automated accessibility audit reports common naming and labeling failures", () => {
  const unnamedButton = element();
  const unlabelledInput = element({ tagName: "INPUT" });
  const missingAlt = element({ tagName: "IMG" });
  const result = runAccessibilityAudit(root({
    "[id]": [],
    "button, a[href], [role='button']": [unnamedButton],
    "input, select, textarea": [unlabelledInput],
    img: [missingAlt],
    "[role='dialog']": [],
    "[role='button']:not(button)": [],
  }));
  assert.equal(result.passed, false);
  assert.equal(result.issueCount, 3);
  assert.deepEqual(result.groups.map((group) => group.rule).sort(), ["accessible-name", "form-label", "image-alt"]);
});

test("automated accessibility audit passes correctly named controls", () => {
  const namedButton = element({ text: "Save" });
  const labelledInput = element({ tagName: "INPUT", labels: [{}] });
  const image = element({ tagName: "IMG", attrs: { alt: "" } });
  const result = runAccessibilityAudit(root({
    "[id]": [],
    "button, a[href], [role='button']": [namedButton],
    "input, select, textarea": [labelledInput],
    img: [image],
    "[role='dialog']": [],
    "[role='button']:not(button)": [],
  }));
  assert.equal(result.passed, true);
});

test("manual accessibility verification covers non-automated behavior", () => {
  const ids = MANUAL_ACCESSIBILITY_CHECKS.map((item) => item.id);
  for (const required of ["keyboard", "screen-reader", "zoom", "contrast", "motion", "dialogs", "touch"]) assert.ok(ids.includes(required));
});

test("automated and manual verification remain available in Settings", async () => {
  const [app, styles] = await Promise.all([
    readFile(new URL("../src/App.jsx", import.meta.url), "utf8"),
    readFile(new URL("../src/App.css", import.meta.url), "utf8"),
  ]);
  assert.match(app, /id: "accessibility"/);
  assert.match(app, /Run Accessibility Check/);
  assert.match(app, /Manual Accessibility Verification/);
  assert.match(app, /taskcabinet_accessibility_checklist_/);
  assert.match(styles, /\.accessibility-checklist/);
});
