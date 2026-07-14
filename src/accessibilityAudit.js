export const MANUAL_ACCESSIBILITY_CHECKS = [
  { id: "keyboard", label: "Keyboard navigation", detail: "Use Tab, Shift+Tab, Enter, Space, and Escape without touching a mouse." },
  { id: "focus", label: "Visible focus and logical order", detail: "Confirm the focus indicator is always visible and moves in a sensible order." },
  { id: "screen-reader", label: "Screen-reader names and announcements", detail: "Check controls, headings, errors, completion messages, and Trash undo with a screen reader." },
  { id: "zoom", label: "200% zoom and text scaling", detail: "Confirm content reflows without clipping, overlap, or lost controls." },
  { id: "mobile", label: "Mobile reflow and keyboard", detail: "Check portrait mode and text entry with the on-screen keyboard open." },
  { id: "contrast", label: "Light, dark, and custom-theme contrast", detail: "Confirm important text, focus rings, buttons, and status colors remain readable." },
  { id: "motion", label: "Reduced motion", detail: "Enable reduced motion and confirm essential information does not depend on animation." },
  { id: "errors", label: "Clear errors and recovery", detail: "Trigger validation errors and confirm they explain what happened and how to recover." },
  { id: "dialogs", label: "Dialog focus behavior", detail: "Open and close dialogs; focus should stay inside and return to the opening control." },
  { id: "touch", label: "Touch targets", detail: "Confirm important phone controls are comfortable to tap without accidental activation." },
];

const hasAccessibleName = (element) => Boolean(
  element.getAttribute?.("aria-label")?.trim()
  || element.getAttribute?.("aria-labelledby")?.trim()
  || element.getAttribute?.("title")?.trim()
  || element.textContent?.trim(),
);

const isIgnored = (element) => Boolean(
  element.closest?.('[hidden], [aria-hidden="true"]')
  || element.getAttribute?.("type") === "hidden",
);

export function runAccessibilityAudit(root) {
  const issues = [];
  const addIssue = (rule, message, element) => issues.push({
    rule,
    message,
    element: element?.tagName?.toLowerCase?.() || "element",
    identifier: element?.id || element?.getAttribute?.("aria-label") || element?.textContent?.trim?.().slice(0, 60) || "",
  });

  const ids = new Map();
  root.querySelectorAll("[id]").forEach((element) => {
    if (isIgnored(element)) return;
    const id = element.id;
    if (ids.has(id)) addIssue("duplicate-id", `Duplicate id “${id}” can confuse assistive technology.`, element);
    else ids.set(id, element);
  });

  root.querySelectorAll("button, a[href], [role='button']").forEach((element) => {
    if (!isIgnored(element) && !hasAccessibleName(element)) addIssue("accessible-name", "Interactive control has no accessible name.", element);
  });

  root.querySelectorAll("input, select, textarea").forEach((element) => {
    if (isIgnored(element)) return;
    const labelled = element.labels?.length > 0
      || element.getAttribute("aria-label")?.trim()
      || element.getAttribute("aria-labelledby")?.trim()
      || element.getAttribute("title")?.trim();
    if (!labelled) addIssue("form-label", "Form control is not connected to an accessible label.", element);
  });

  root.querySelectorAll("img").forEach((element) => {
    if (!isIgnored(element) && !element.hasAttribute("alt")) addIssue("image-alt", "Image is missing an alt attribute.", element);
  });

  root.querySelectorAll("[role='dialog']").forEach((element) => {
    if (isIgnored(element)) return;
    if (!element.getAttribute("aria-label") && !element.getAttribute("aria-labelledby")) addIssue("dialog-name", "Dialog has no accessible name.", element);
    if (element.getAttribute("aria-modal") !== "true") addIssue("dialog-modal", "Dialog should declare aria-modal=true.", element);
  });

  root.querySelectorAll("[role='button']:not(button)").forEach((element) => {
    if (!isIgnored(element) && !element.hasAttribute("tabindex")) addIssue("keyboard-control", "Custom button is not keyboard focusable.", element);
  });

  const grouped = Object.values(issues.reduce((groups, issue) => {
    const current = groups[issue.rule] || { rule: issue.rule, count: 0, message: issue.message, examples: [] };
    current.count += 1;
    if (current.examples.length < 3) current.examples.push(`${issue.element}${issue.identifier ? `: ${issue.identifier}` : ""}`);
    groups[issue.rule] = current;
    return groups;
  }, {}));

  return { passed: issues.length === 0, issueCount: issues.length, groups: grouped, checkedAt: new Date().toISOString() };
}
