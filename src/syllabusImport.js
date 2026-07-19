/* Local syllabus validation, text extraction, and heuristic assignment finding. */
export const MAX_SYLLABUS_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_PDF_PAGES = 150;

export function getSyllabusFileKind(file) {
  const name = String(file?.name || "").toLowerCase();
  if (name.endsWith(".pdf")) return "pdf";
  if (name.endsWith(".docx")) return "docx";
  if (/\.(txt|md|csv)$/.test(name)) return "text";
  if (name.endsWith(".doc")) return "legacy-doc";
  return "unknown";
}

export function validateSyllabusFile(file) {
  if (!file) throw new Error("Choose a syllabus file first.");
  if (file.size <= 0) throw new Error("That syllabus file is empty.");
  if (file.size > MAX_SYLLABUS_FILE_BYTES) throw new Error("This file is too large to process safely. Choose a file that is 10 MB or smaller.");
  const kind = getSyllabusFileKind(file);
  if (kind === "legacy-doc") throw new Error("Older .doc files cannot be read safely in this browser. Save or export the file as DOCX, PDF, or TXT, then try again.");
  if (kind === "unknown") throw new Error("Choose a PDF, DOCX, TXT, Markdown, or CSV syllabus.");
  return kind;
}

async function extractPdfText(file, options = {}) {
  const [{ getDocument, GlobalWorkerOptions }, workerModule] = await Promise.all([
    import("pdfjs-dist/legacy/build/pdf.mjs"),
    import("pdfjs-dist/legacy/build/pdf.worker.mjs?url"),
  ]);
  GlobalWorkerOptions.workerSrc = workerModule.default;
  const loadingTask = getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  let document;
  try {
    document = await loadingTask.promise;
    if (document.numPages > MAX_PDF_PAGES) throw new Error(`This PDF has ${document.numPages} pages. Choose a PDF with ${MAX_PDF_PAGES} pages or fewer.`);
    const pages = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      if (options.signal?.aborted) throw new DOMException("Reading cancelled", "AbortError");
      options.onProgress?.({ pageNumber, pageCount: document.numPages, message: `Reading page ${pageNumber} of ${document.numPages}` });
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
    let line = "";
    let lastY = null;
    const lines = [];
    for (const item of content.items) {
      if (!("str" in item)) continue;
      const y = item.transform?.[5] ?? lastY;
      if (lastY !== null && y !== null && Math.abs(y - lastY) > 3 && line.trim()) {
        lines.push(line.trim());
        line = "";
      }
      line += `${line ? " " : ""}${item.str}`;
      if (item.hasEOL && line.trim()) {
        lines.push(line.trim());
        line = "";
      }
      lastY = y;
    }
    if (line.trim()) lines.push(line.trim());
      pages.push(lines.join("\n"));
      page.cleanup();
    }
    return pages.join("\n\n");
  } catch (error) {
    if (error?.name === "AbortError") throw new Error("PDF reading was cancelled. Choose the file again when you are ready.", { cause: error });
    if (/password/i.test(String(error?.name || "")) || /password/i.test(String(error?.message || ""))) throw new Error("This PDF is password-protected. Remove the password or export an unlocked copy, then try again.", { cause: error });
    if (error instanceof Error && /pages|cancelled|password-protected/.test(error.message)) throw error;
    throw new Error("This PDF appears corrupted or could not be read. Try exporting it again, or use DOCX or TXT.", { cause: error });
  } finally {
    await document?.destroy?.().catch(() => {});
    await loadingTask.destroy?.().catch(() => {});
  }
}

async function extractDocxText(file) {
  const module = await import("mammoth");
  const mammoth = module.default || module;
  const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  return String(result.value || "");
}

export async function extractSyllabusText(file, options = {}) {
  const kind = validateSyllabusFile(file);
  const text = kind === "pdf"
    ? await extractPdfText(file, options)
    : kind === "docx"
      ? await extractDocxText(file)
      : await file.text();
  const cleaned = text.split(String.fromCharCode(0)).join("").replace(/[ \t]+\n/g, "\n").trim();
  if (!cleaned) {
    throw new Error(kind === "pdf"
      ? "This appears to be a scanned PDF with no selectable text. OCR is not available yet; export it as a searchable PDF or TXT and try again."
      : "No readable text was found in that syllabus.");
  }
  return cleaned;
}

export function findLikelySyllabusAssignments(text, maxItems = 50) {
  const datePattern = /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)\b|\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b/i;
  const workPattern = /\b(?:assignment|homework|quiz|exam|test|midterm|final|paper|essay|project|lab|report|presentation|discussion|reading|chapter|worksheet|problem\s*set|draft|portfolio|submit|due|deadline)\b/i;
  const headingPattern = /^.{2,60}:$/;
  const candidates = [];
  for (const rawLine of String(text || "").split(/\r?\n/)) {
    const line = rawLine.replace(/^\s*(?:[-*•▪◦]|\d+[.)])\s*/, "").trim();
    if (!line) continue;
    if (headingPattern.test(line) && !datePattern.test(line)) {
      candidates.push(line);
    } else if (datePattern.test(line) && workPattern.test(line)) {
      candidates.push(line);
    }
    if (candidates.length >= maxItems) break;
  }
  return candidates.join("\n");
}
