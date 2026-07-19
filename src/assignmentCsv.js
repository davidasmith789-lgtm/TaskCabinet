export const ASSIGNMENT_CSV_COLUMNS = [
  "Assignment Name", "Course", "Workflow Status", "Due Date", "Due Time", "Priority",
  "Estimated Minutes", "Notes", "Links", "Related Tasks", "Completed", "Archived",
];

export function escapeCsvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function visibleLinks(task) {
  return (Array.isArray(task.links) ? task.links : []).map((link) => typeof link === "string" ? link : link?.url || link?.href || "").filter(Boolean).join("\n");
}

export function createAssignmentsCsv(tasks, options = {}) {
  const statusFor = options.getStatus || ((task) => task.status || (task.isCompleted ? "completed" : "todo"));
  const rows = (Array.isArray(tasks) ? tasks : []).filter((task) => !task.isDeleted).map((task) => [
    task.title, task.course, statusFor(task),
    task.dueMonth && task.dueDay ? `${String(task.dueMonth).padStart(2, "0")}/${String(task.dueDay).padStart(2, "0")}` : "",
    task.dueHour ? `${task.dueHour} ${task.dueAmPm || ""}`.trim() : "",
    task.priority, task.estimatedMinutes, task.notes,
    visibleLinks(task),
    (Array.isArray(task.subtasks) ? task.subtasks : []).map((item) => item.text).filter(Boolean).join("\n"),
    task.isCompleted ? "Yes" : "No", task.isArchived ? "Yes" : "No",
  ]);
  return `\uFEFF${[ASSIGNMENT_CSV_COLUMNS, ...rows].map((row) => row.map(escapeCsvCell).join(",")).join("\r\n")}`;
}
