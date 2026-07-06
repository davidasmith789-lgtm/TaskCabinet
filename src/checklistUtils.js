export function getChecklistDeadline(item) {
  if (!item?.dueDate) return null;

  const time = /^\d{2}:\d{2}$/.test(item.dueTime || "")
    ? item.dueTime
    : "23:59";
  const deadline = new Date(`${item.dueDate}T${time}:00`);
  return Number.isNaN(deadline.getTime()) ? null : deadline;
}

export function formatChecklistCountdown(item, now = new Date()) {
  const deadline = getChecklistDeadline(item);
  if (!deadline) return "";

  const difference = deadline.getTime() - now.getTime();
  if (difference < -60000) return "Overdue";
  if (difference <= 60000) return "Due now";

  const totalMinutes = Math.ceil(difference / 60000);
  if (totalMinutes >= 1440) {
    const days = Math.ceil(totalMinutes / 1440);
    return `${days} day${days === 1 ? "" : "s"} left`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m left` : `${minutes}m left`;
}

export function formatChecklistDeadline(item) {
  const deadline = getChecklistDeadline(item);
  if (!deadline) return "";

  const dateLabel = deadline.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: deadline.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
  });
  if (!item.dueTime) return dateLabel;
  return `${dateLabel} · ${deadline.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
}

