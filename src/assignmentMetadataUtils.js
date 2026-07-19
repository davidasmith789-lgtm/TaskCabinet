const normalize = (value) => String(value || "").trim().toLowerCase();

const reasonCategory = (label) => {
  const value = normalize(label);
  if (value.startsWith("overdue")) return "due";
  if (value.startsWith("due today") || value.startsWith("due tomorrow")) return "due";
  if (value === "needs date" || value === "no due date") return "due";
  if (value.includes("priority")) return "priority";
  if (value === "in progress" || value === "to do" || value === "completed") return "status";
  if (value === "short win" || value === "long project") return "duration";
  return value;
};

export function getUniqueAssignmentMetadata({
  dueLabel = "",
  countdownLabel = "",
  reasons = [],
  priorityShown = false,
  statusShown = false,
  estimateShown = false,
} = {}) {
  const hiddenCategories = new Set();
  if (countdownLabel || dueLabel) hiddenCategories.add("due");
  if (priorityShown) hiddenCategories.add("priority");
  if (statusShown) hiddenCategories.add("status");
  if (estimateShown) hiddenCategories.add("duration");

  const seen = new Set();
  const uniqueReasons = reasons.filter((reason) => {
    const category = reasonCategory(reason);
    if (!category || hiddenCategories.has(category) || seen.has(category)) return false;
    seen.add(category);
    return true;
  });

  return {
    dueLabel: countdownLabel ? "" : dueLabel,
    countdownLabel,
    reasons: uniqueReasons,
  };
}
