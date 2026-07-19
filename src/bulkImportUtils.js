const BULLET_PREFIX = /^\s*(?:[-*•▪◦]|\d+[.)]|[a-z][.)])\s*/i;
const HEADER_WORDS = /^(?:course|class|subject|assignment(?: name)?|title|task|due(?: date)?|deadline|date|due time|time|priority|estimated (?:minutes|duration)|minutes|notes?)$/i;
const DATE_WORDS = "january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec";
const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

export function normalizeCourseName(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

export function findMatchingCourse(value, courses = []) {
  const key = normalizeCourseName(value).toLocaleLowerCase();
  return courses.find((course) => normalizeCourseName(course).toLocaleLowerCase() === key) || "";
}

function parseDelimitedLine(line, delimiter) {
  if (delimiter === "\t") return line.split("\t").map((value) => value.trim());
  const cells = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"' && quoted && line[index + 1] === '"') { cell += '"'; index += 1; }
    else if (character === '"') quoted = !quoted;
    else if (character === delimiter && !quoted) { cells.push(cell.trim()); cell = ""; }
    else cell += character;
  }
  if (quoted) throw new Error("Invalid CSV: a quoted field is not closed. Fix that row and try again.");
  cells.push(cell.trim());
  return cells;
}

function looksLikeHeader(cells) {
  const recognized = cells.filter((cell) => HEADER_WORDS.test(cell.trim())).length;
  return recognized >= 2 || (recognized === 1 && cells.length <= 2);
}

function headerKey(value) {
  const key = value.trim().toLowerCase();
  if (/course|class|subject/.test(key)) return "course";
  if (/assignment|title|task/.test(key)) return "title";
  if (/due.*time|^time$/.test(key)) return "dueTime";
  if (/due|deadline|date/.test(key)) return "dueDate";
  if (/priority/.test(key)) return "priority";
  if (/estimate|duration|minutes/.test(key)) return "estimatedMinutes";
  if (/notes?/.test(key)) return "notes";
  return "";
}

function parseDate(value, now = new Date()) {
  const text = String(value || "").trim();
  if (!text) return { warnings: ["Missing due date"] };
  const warnings = [];
  let date = null;
  let explicitYear = false;
  const numeric = text.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
  const named = text.match(new RegExp(`\\b(${DATE_WORDS})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?\\b`, "i"));
  const weekday = text.match(new RegExp(`\\b(${WEEKDAYS.join("|")})\\b`, "i"));
  if (numeric) {
    let year = numeric[3] ? Number(numeric[3]) : now.getFullYear();
    if (year < 100) year += 2000;
    explicitYear = Boolean(numeric[3]);
    date = new Date(year, Number(numeric[1]) - 1, Number(numeric[2]));
    if (Number(numeric[1]) <= 12 && Number(numeric[2]) <= 12) warnings.push("Ambiguous numeric date; review the month and day");
  } else if (named) {
    const monthNames = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
    explicitYear = Boolean(named[3]);
    date = new Date(Number(named[3]) || now.getFullYear(), monthNames.indexOf(named[1].slice(0, 3).toLowerCase()), Number(named[2]));
  } else if (weekday) {
    date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let offset = (WEEKDAYS.indexOf(weekday[1].toLowerCase()) - date.getDay() + 7) % 7;
    if (offset === 0) offset = 7;
    date.setDate(date.getDate() + offset);
    warnings.push("Weekday interpreted as the next occurrence; review the date");
  }
  if (!date || Number.isNaN(date.getTime())) return { warnings: ["Missing or unrecognized due date"] };
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (date < today) warnings.push(explicitYear ? "Date appears to be in the past" : "Date has no year and appears to be in the past; review the school year");
  const time = text.match(/\b(\d{1,2})(?::(\d{2}))\s*(a\.?m\.?|p\.?m\.?)?\b/i);
  return {
    dueYear: date.getFullYear(), dueMonth: date.getMonth() + 1, dueDay: date.getDate(),
    dueHour: time ? `${Number(time[1])}:${time[2]}` : null,
    dueAmPm: time?.[3] ? (time[3].toLowerCase().startsWith("a") ? "AM" : "PM") : null,
    warnings,
  };
}

/** Parse pasted lists, CSV, and copied spreadsheet rows without saving anything. */
export function parsePastedAssignmentRows(value, courses = [], options = {}) {
  const normalized = String(value || "").replace(/\r/g, "").trim();
  if (!normalized) return [];
  const rawLines = normalized.includes("\n") ? normalized.split("\n") : normalized.split(/\s*;\s*/);
  const lines = rawLines.map((line) => line.replace(BULLET_PREFIX, "").trim()).filter(Boolean);
  let courseHint = "";
  let headers = null;
  return lines.flatMap((line, index) => {
    const heading = line.match(/^([^:]{2,60}):$/);
    if (heading) { courseHint = normalizeCourseName(heading[1]); return []; }
    const delimiter = line.includes("\t") ? "\t" : line.includes(",") ? "," : null;
    let cells = delimiter ? parseDelimitedLine(line, delimiter) : null;
    if (cells && looksLikeHeader(cells)) { headers = cells.map(headerKey); return []; }
    let fields = {};
    let structured = false;
    if (cells && headers) { structured = true; headers.forEach((key, cellIndex) => { if (key) fields[key] = cells[cellIndex] || ""; }); }
    else if (cells && cells.length >= 3) { structured = true; fields = { course: cells[0], title: cells.slice(1, -1).join(", "), dueDate: cells.at(-1) }; }
    else {
      const dashCells = line.split(/\s+(?:--+|[–—-])\s+/).map((cell) => cell.trim()).filter(Boolean);
      if (dashCells.length >= 3) { structured = true; fields = { course: dashCells[0], title: dashCells.slice(1, -1).join(" - "), dueDate: dashCells.at(-1) }; }
      else fields = { title: line, course: courseHint };
    }
    const parsedDate = parseDate(`${fields.dueDate || fields.title || ""} ${fields.dueTime || ""}`, options.now);
    const rawCourse = normalizeCourseName(fields.course || courseHint);
    const matchedCourse = findMatchingCourse(rawCourse, courses);
    const warnings = [...parsedDate.warnings];
    if (!rawCourse) warnings.push("Missing course");
    const title = String(fields.title || "").trim();
    if (!title) warnings.push("Missing assignment name");
    return [{
      text: line, title: structured ? title : null, courseHint: matchedCourse || rawCourse, course: matchedCourse || rawCourse || "Other",
      notes: fields.notes || "", priority: fields.priority || null, estimatedMinutes: fields.estimatedMinutes || null,
      ...parsedDate, importWarnings: warnings, sourceRow: index + 1,
    }];
  }).slice(0, options.maxItems || 50);
}

/** Backward-compatible basic preparation used by older callers/tests. */
export function preparePastedAssignmentLines(value, maxItems = 50) {
  return parsePastedAssignmentRows(value, [], { maxItems }).map(({ text, courseHint }) => ({ text, courseHint }));
}
