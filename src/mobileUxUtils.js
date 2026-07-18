export const MOBILE_TASK_LEVELS = Object.freeze({ compact: 1, summary: 2, details: 3 });

export function nextMobileTaskLevel(level = MOBILE_TASK_LEVELS.compact) {
  return level >= MOBILE_TASK_LEVELS.details ? MOBILE_TASK_LEVELS.compact : level + 1;
}

export function getWorkflowLabel(status) {
  return ({ todo: "To Do", inProgress: "In Progress", completed: "Completed" })[status] || "To Do";
}

export function splitActiveAndOverdue(tasks, getDueBucket) {
  const overdue = [];
  const active = [];
  for (const task of tasks) {
    if (String(getDueBucket(task) || "").startsWith("Overdue")) overdue.push(task);
    else active.push(task);
  }
  return { active, overdue };
}

export function getReminderActionLabel(status, enabled = false) {
  if (status === "active") return "Connected";
  if (status === "blocked") return "Blocked in Browser Settings";
  if (status === "unsupported") return "Unsupported on This Device";
  if (status === "needs_attention") return "Failed — Retry";
  if (status === "connecting") return "Permission Needed";
  return enabled ? "Failed — Retry" : "Enable Reminders";
}

export function passwordsMatch(password, confirmation) {
  return Boolean(password) && password === confirmation;
}
