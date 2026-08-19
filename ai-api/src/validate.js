/* ============================================================
   EmTech AI API — response validation (server-side safety layer)

   Never trust model output (§17/§35/§47). Every turn is checked against
   the bundled EmTech knowledge base before it can reach a user:
     * status / message / platform / confidence must be well-formed
     * question.id must be an approved EmTech question (or "free")
     * recommended_fix.fix_id must exist in tips-data.js AND match the
       session's platform (§14/§16) — invented ids are rejected, never
       rendered; a Mac session can't receive a Windows fix and vice versa

   The browser re-validates with its own copy of these rules (ai-engine.js);
   two runtimes, same contract — defense in depth.
   ============================================================ */
import { getFixBySlug, isMacTip, approvedQuestionIds } from "./knowledge.js";

const STATUSES = ["question", "recommendation", "resolved", "insufficient_information", "unsupported", "safety_warning"];
const CONFIDENCES = ["low", "medium", "high"];
const PLATFORMS = ["windows", "mac"];

/* Find the first balanced {...} block in free text and parse it — models
   occasionally wrap JSON in prose or fences despite instructions. */
function extractJson(text) {
  if (typeof text !== "string") return null;
  const start = text.indexOf("{");
  if (start === -1) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) { try { return JSON.parse(text.slice(start, i + 1)); } catch (err) { return null; } }
    }
  }
  return null;
}

/* The session platform is embedded in the system prompt by ai-prompt.js:
   "Platform: windows (…)" or "Platform: unknown — ask …". */
export function platformFromMessages(messages) {
  const sys = Array.isArray(messages) && messages[0] && typeof messages[0].content === "string" ? messages[0].content : "";
  const m = /^Platform:\s*(windows|mac)\b/m.exec(sys);
  return m ? m[1] : null;
}

function cleanStr(v, max) {
  if (typeof v !== "string") return null;
  const t = v.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  return t.length <= max ? t : t.slice(0, max);
}

/* Validate a parsed model response. Returns { ok, errors }. */
export function validateModelJson(raw, opts) {
  const o = opts || {};
  const errors = [];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, errors: ["response is not a JSON object"] };

  if (STATUSES.indexOf(raw.status) === -1) errors.push(`status must be one of ${STATUSES.join(", ")}`);

  const message = cleanStr(raw.message, 800);
  if (!message) errors.push("message is required and must be a non-empty string");

  if (raw.platform !== undefined && raw.platform !== null && PLATFORMS.indexOf(raw.platform) === -1) {
    errors.push('platform must be "windows", "mac" or null');
  }
  if (raw.confidence !== undefined && raw.confidence !== null && CONFIDENCES.indexOf(raw.confidence) === -1) {
    errors.push('confidence must be "low", "medium", "high" or null');
  }

  /* question — approved id only, never an invented one (§22/§47). */
  let hasQuestion = false;
  if (raw.question !== undefined && raw.question !== null) {
    const q = raw.question;
    if (!q || typeof q !== "object") errors.push("question must be an object");
    else {
      const text = cleanStr(q.text, 300);
      if (!text) errors.push("question.text is required");
      const id = typeof q.id === "string" ? q.id.trim() : "";
      const approved = approvedQuestionIds();
      if (id && !approved.has(id) && id !== "free") {
        errors.push(`question.id "${id}" is not an approved EmTech question and not "free"`);
      } else if (id === "free") {
        const opts2 = Array.isArray(q.options) ? q.options.map((x) => cleanStr(x, 80)).filter(Boolean) : [];
        if (opts2.length < 2) errors.push("question.options needs at least 2 short labels");
      }
      hasQuestion = true;
    }
  }

  /* recommended_fix — must exist in the knowledge base + platform guard. */
  let hasFix = false;
  if (raw.recommended_fix !== undefined && raw.recommended_fix !== null) {
    const rf = raw.recommended_fix;
    if (!rf || typeof rf !== "object") errors.push("recommended_fix must be an object");
    else {
      const slug = String(rf.fix_id || "");
      const tip = getFixBySlug(slug);
      if (!tip) errors.push(`recommended_fix.fix_id "${slug}" does not exist in the EmTech knowledge base`);
      else {
        // Platform guard (§16): never recommend the other OS's fix.
        if (o.platform === "mac" && !isMacTip(tip)) errors.push("recommended a Windows fix for a Mac session");
        else if (o.platform === "windows" && isMacTip(tip)) errors.push("recommended a Mac fix for a Windows session");
        else hasFix = true;
      }
    }
  }

  /* related_fixes — unknown slugs are dropped, not fatal. */
  if (raw.related_fixes !== undefined) {
    if (!Array.isArray(raw.related_fixes)) errors.push("related_fixes must be an array");
  }

  /* Cross-status rules. */
  if (!errors.length) {
    if (raw.status === "question" && !hasQuestion) errors.push('status "question" requires a question object');
    if (raw.status === "recommendation" && !hasFix) errors.push('status "recommendation" requires recommended_fix with a valid fix_id');
  }

  return { ok: errors.length === 0, errors };
}

/* Entry point for raw model text → { ok, errors }. */
export function validateModelText(text, opts) {
  const parsed = extractJson(text);
  if (!parsed) return { ok: false, errors: ["response was not valid JSON"] };
  return validateModelJson(parsed, opts);
}
