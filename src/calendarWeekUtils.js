export function getWeekDates(anchorDate, weekStartsOn = "sunday") {
  const anchor = anchorDate instanceof Date && !Number.isNaN(anchorDate.getTime())
    ? new Date(anchorDate.getFullYear(), anchorDate.getMonth(), anchorDate.getDate())
    : new Date();
  const preferredStart = weekStartsOn === "monday" ? 1 : 0;
  const daysSinceStart = (anchor.getDay() - preferredStart + 7) % 7;
  const start = new Date(anchor);
  start.setDate(start.getDate() - daysSinceStart);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

export function shiftCalendarWeek(anchorDate, amount) {
  const result = new Date(anchorDate);
  result.setDate(result.getDate() + amount * 7);
  return result;
}

export function isSameCalendarDay(first, second) {
  return first instanceof Date && second instanceof Date
    && first.getFullYear() === second.getFullYear()
    && first.getMonth() === second.getMonth()
    && first.getDate() === second.getDate();
}

