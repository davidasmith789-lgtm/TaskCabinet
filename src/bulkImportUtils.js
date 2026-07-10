const BULLET_PREFIX = /^\s*(?:[-*•▪◦]|\d+[.)]|[a-z][.)])\s*/i;

/** Parse pasted bullets or semicolon-separated text into assignment candidates. */
export function preparePastedAssignmentLines(value, maxItems = 50) {
  const normalized = String(value || "").replace(/\r/g, "").trim();
  if (!normalized) return [];

  const rawLines = normalized.includes("\n")
    ? normalized.split("\n")
    : normalized.split(/\s*;\s*/);
  const results = [];
  let courseHint = "";

  for (const rawLine of rawLines) {
    const line = rawLine.replace(BULLET_PREFIX, "").trim();
    if (!line) continue;

    const heading = line.match(/^([^:]{2,60}):$/);
    if (heading) {
      courseHint = heading[1].trim();
      continue;
    }

    if (/^(assignment|title|task)\s*[|,\t]\s*(due|deadline|date)/i.test(line)) continue;
    results.push({ text: line, courseHint });
    if (results.length >= maxItems) break;
  }

  return results;
}
