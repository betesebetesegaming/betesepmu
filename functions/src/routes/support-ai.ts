import type { Request, Response } from 'express';
import { logger } from 'firebase-functions';
import { VertexAI, type GenerativeModel } from '@google-cloud/vertexai';

const SECRET_KEY_RE = /(pass|password|secret|token|api[_-]?key|authorization)/i;

function redactSensitive(value: unknown): unknown {
  const walk = (input: unknown, path = ''): unknown => {
    if (input === null || input === undefined) return input;
    if (typeof input === 'string') {
      return input.length > 800 ? `${input.slice(0, 800)}...` : input;
    }
    if (typeof input !== 'object') return input;
    if (Array.isArray(input)) {
      return input.slice(0, 50).map((item, idx) => walk(item, `${path}[${idx}]`));
    }
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(input as Record<string, unknown>)) {
      const nodePath = `${path}.${key}`;
      if (SECRET_KEY_RE.test(key) || SECRET_KEY_RE.test(nodePath)) {
        out[key] = '[REDACTED]';
      } else {
        out[key] = walk(val, nodePath);
      }
    }
    return out;
  };
  return walk(value);
}

function compactSnapshot(snapshot: Record<string, unknown>) {
  const safeSnapshot = redactSensitive(snapshot || {}) as Record<string, unknown>;
  const keyList = Object.keys(safeSnapshot);
  const compact = { keyCount: keyList.length, keys: keyList.slice(0, 40), data: safeSnapshot };
  const raw = JSON.stringify(compact);
  if (raw.length <= 12000) return compact;
  return {
    keyCount: keyList.length,
    keys: keyList.slice(0, 40),
    dataPreview: 'Snapshot too large; trimmed for AI analysis.',
  };
}

function parseAssistantOutput(text: string) {
  if (!text) {
    return {
      summary: 'No analysis text returned by AI service.',
      actions: ['Use the generated support package for manual investigation.'],
    };
  }
  // Gemini sometimes wraps JSON in ```json fences; strip them before parsing.
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  try {
    const parsed = JSON.parse(cleaned);
    const summary = String(parsed?.summary || 'AI diagnosis complete.');
    const actions = Array.isArray(parsed?.actions)
      ? parsed.actions.map((x: unknown) => String(x)).slice(0, 8)
      : ['No structured actions returned.'];
    return { summary, actions };
  } catch {
    const lines = cleaned
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    return {
      summary: lines[0] || 'AI diagnosis complete.',
      actions: lines.slice(1, 7).map((line) => line.replace(/^[-*\d.)\s]+/, '')),
    };
  }
}

// -----------------------------------------------------------------------------
// Vertex AI client
// -----------------------------------------------------------------------------
//
// The Cloud Functions runtime provides Application Default Credentials via the
// attached service account, so no API key is needed — Vertex AI authenticates
// against the project automatically. We lazy-create the model once per cold
// start so warm invocations skip the initialisation cost.

let cachedModel: GenerativeModel | null = null;
let cachedProjectKey = '';

function getModel(): GenerativeModel {
  const project = process.env.GCLOUD_PROJECT
    || process.env.GOOGLE_CLOUD_PROJECT
    || process.env.FIREBASE_PROJECT_ID;
  if (!project) {
    throw new Error('Missing GCLOUD_PROJECT for Vertex AI support handler.');
  }
  const location = process.env.VERTEX_AI_LOCATION || 'us-central1';
  const modelName = process.env.VERTEX_AI_MODEL || 'gemini-2.0-flash-001';
  const cacheKey = `${project}|${location}|${modelName}`;

  if (cachedModel && cachedProjectKey === cacheKey) return cachedModel;

  const vertex = new VertexAI({ project, location });
  cachedModel = vertex.getGenerativeModel({
    model: modelName,
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 1024,
      responseMimeType: 'application/json',
    },
    systemInstruction: {
      role: 'system',
      parts: [
        {
          text:
            'You are a PMU backoffice support assistant for the Betese horse-betting platform. ' +
            'You receive a redacted snapshot of local data and a free-text issue description from a cashier or admin. ' +
            'Return STRICT JSON with exactly two keys: "summary" (a single short sentence diagnosing the problem) ' +
            'and "actions" (an array of 3-5 short, practical, safe next steps a non-technical operator can take). ' +
            'Never invent passwords, tokens, or customer PII. If unsure, recommend exporting the support package and contacting an admin.',
        },
      ],
    },
  });
  cachedProjectKey = cacheKey;
  return cachedModel;
}

export async function supportAiHandler(req: Request, res: Response): Promise<void> {
  const body = (req.body || {}) as { issueDescription?: string; systemData?: Record<string, unknown> };
  const issueDescription = String(body?.issueDescription || '').trim();
  const systemData = body?.systemData || {};

  if (!issueDescription) {
    res.status(400).json({ error: 'issueDescription is required' });
    return;
  }

  const compactData = compactSnapshot(systemData);
  const userPrompt = JSON.stringify({
    issueDescription,
    systemData: compactData,
    expectedOutput: {
      summary: 'short diagnosis summary',
      actions: ['clear next action 1', 'clear next action 2', 'clear next action 3'],
    },
  });

  try {
    const model = getModel();
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    });

    const candidate = result?.response?.candidates?.[0];
    const text = candidate?.content?.parts?.map((p) => p.text || '').join('').trim() || '';
    if (!text) {
      logger.warn('Vertex AI returned no text', { finishReason: candidate?.finishReason });
      res.status(502).json({
        error: 'Vertex AI returned no content',
        details: candidate?.finishReason || 'unknown',
      });
      return;
    }

    const parsed = parseAssistantOutput(text);
    res.json({ summary: parsed.summary, actions: parsed.actions, model: 'vertex-ai/gemini' });
  } catch (err) {
    logger.error('support-ai (vertex) failed', err);
    res.status(500).json({
      error: 'Unexpected support-ai error',
      details: err instanceof Error ? err.message : String(err),
    });
  }
}
