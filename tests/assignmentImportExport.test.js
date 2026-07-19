import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { ASSIGNMENT_CSV_COLUMNS, createAssignmentsCsv } from "../src/assignmentCsv.js";
import { findMatchingCourse, parsePastedAssignmentRows } from "../src/bulkImportUtils.js";
import { getSyllabusFileKind, MAX_SYLLABUS_FILE_BYTES, validateSyllabusFile } from "../src/syllabusImport.js";

const now = new Date(2026, 6, 19);

test("pasted input supports one-per-line, comma rows, tabs, headings, and spaced dashes", () => {
  const comma = parsePastedAssignmentRows("Course, Assignment, Due Date\nHistory, Chapter 4 Notes, 9/18/2026", ["History"], { now });
  assert.equal(comma.length, 1);
  assert.equal(comma[0].title, "Chapter 4 Notes");
  assert.equal(comma[0].course, "History");
  assert.equal(comma[0].dueMonth, 9);

  const tabs = parsePastedAssignmentRows("Course\tAssignment\tDue Date\nBiology\tLab Report\tSeptember 20", ["Biology"], { now });
  assert.equal(tabs[0].title, "Lab Report");

  const dashes = parsePastedAssignmentRows("Math - Problems 1-25 - Friday", ["Math"], { now });
  assert.equal(dashes[0].title, "Problems 1-25");
  assert.match(dashes[0].importWarnings.join(" "), /next occurrence/i);
});

test("assignment commas and dashes are preserved where structure identifies them", () => {
  const rows = parsePastedAssignmentRows('Course,Assignment,Due Date\nEnglish,"Essay, draft - revised",September 20', ["English"], { now });
  assert.equal(rows[0].title, "Essay, draft - revised");
});

test("ambiguous dates and missing courses are visible review warnings", () => {
  const [row] = parsePastedAssignmentRows("Essay, 8/9/2026", [], { now });
  assert.match(row.importWarnings.join(" "), /Ambiguous numeric date/i);
  assert.match(row.importWarnings.join(" "), /Missing course/i);
});

test("duplicate-looking rows remain separate and courses match case/whitespace", () => {
  const rows = parsePastedAssignmentRows("History, Essay, 9/18/2026\nhistory, Essay, 9/18/2026", ["  History  "], { now });
  assert.equal(rows.length, 2);
  assert.equal(findMatchingCourse(" history ", ["History"]), "History");
});

test("spreadsheet CSV has stable user-facing columns, escaping, BOM, and no private fields", () => {
  const csv = createAssignmentsCsv([{
    id: "private-id", revision: 9, syncMetadata: "private", title: 'Essay, "Final"', course: "English",
    status: "inProgress", dueMonth: "09", dueDay: "18", dueHour: "11:59", dueAmPm: "PM",
    priority: "HIGH", estimatedMinutes: "90", notes: "Line one\nLine two", links: [{ url: "https://example.test" }],
    subtasks: [{ text: "Draft" }, { text: "Proofread" }], isCompleted: false, isArchived: false,
  }]);
  assert.ok(csv.startsWith("\uFEFF"));
  assert.equal(csv.slice(1).split("\r\n")[0], ASSIGNMENT_CSV_COLUMNS.map((value) => `"${value}"`).join(","));
  assert.match(csv, /"Essay, ""Final"""/);
  assert.match(csv, /"Line one\nLine two"/);
  assert.doesNotMatch(csv, /private-id|revision|syncMetadata/);
});

test("legacy DOC, file limits, and friendly file validation are explicit", () => {
  assert.equal(getSyllabusFileKind({ name: "old.doc" }), "legacy-doc");
  assert.throws(() => validateSyllabusFile({ name: "old.doc", size: 10 }), /DOCX, PDF, or TXT/);
  assert.throws(() => validateSyllabusFile({ name: "large.pdf", size: MAX_SYLLABUS_FILE_BYTES + 1 }), /10 MB or smaller/);
  assert.throws(() => validateSyllabusFile({ name: "empty.txt", size: 0 }), /empty/);
});

test("UI retains review-before-save, mobile controls, source, and scanned-PDF guidance", async () => {
  const [app, css, syllabus] = await Promise.all([
    readFile(new URL("../src/App.jsx", import.meta.url), "utf8"),
    readFile(new URL("../src/App.css", import.meta.url), "utf8"),
    readFile(new URL("../src/syllabusImport.js", import.meta.url), "utf8"),
  ]);
  assert.match(app, /Review Assignments/);
  assert.match(app, /Source: \{bulkImportSource\}/);
  assert.match(app, /bulkImportSaving/);
  assert.match(app, /Due time/);
  assert.match(app, /Add Selected to To Do/);
  assert.match(css, /safe-area-inset-bottom/);
  assert.match(syllabus, /scanned PDF with no selectable text/);
  assert.match(syllabus, /password-protected/);
  assert.match(syllabus, /document\?\.destroy/);
});
