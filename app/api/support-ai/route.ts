import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

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
  const compact = {
    keyCount: keyList.length,
    keys: keyList.slice(0, 40),
    data: safeSnapshot,
  };

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

  try {
    const parsed = JSON.parse(text);
    const summary = String(parsed?.summary || 'AI diagnosis complete.');
    const actions = Array.isArray(parsed?.actions)
      ? parsed.actions.map((x: unknown) => String(x)).slice(0, 8)
      : ['No structured actions returned.'];
    return { summary, actions };
  } catch {
    const lines = String(text)
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    return {
      summary: lines[0] || 'AI diagnosis complete.',
      actions: lines.slice(1, 7).map((line) => line.replace(/^[-*\d.)\s]+/, '')),
    };
  }
}

interface SupportBody {
  issueDescription?: string;
  systemData?: Record<string, unknown>;
}

export async function POST(request: Request) {
  let body: SupportBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const issueDescription = String(body?.issueDescription || '').trim();
  const systemData = body?.systemData || {};

  if (!issueDescription) {
    return NextResponse.json({ error: 'issueDescription is required' }, { status: 400 });
  }

  const openAiApiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  if (!openAiApiKey) {
    return NextResponse.json(
      {
        error: 'AI provider not configured',
        summary: 'AI webhook is reachable but OPENAI_API_KEY is missing on server.',
      },
      { status: 503 }
    );
  }

  const compactData = compactSnapshot(systemData);

  const prompt = {
    issueDescription,
    systemData: compactData,
    expectedOutput: {
      summary: 'short diagnosis summary',
      actions: ['clear next action 1', 'clear next action 2', 'clear next action 3'],
    },
  };

  try {
    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openAiApiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'You are a PMU backoffice support assistant. Return strict JSON with keys: summary (string) and actions (array of strings). Keep actions practical and safe for cashiers/admins.',
          },
          { role: 'user', content: JSON.stringify(prompt) },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      return NextResponse.json(
        { error: 'AI provider request failed', details: errorText.slice(0, 800) },
        { status: 502 }
      );
    }

    const payload = await aiResponse.json();
    const content = payload?.choices?.[0]?.message?.content || '';
    const parsed = parseAssistantOutput(content);

    return NextResponse.json({ summary: parsed.summary, actions: parsed.actions });
  } catch (err) {
    return NextResponse.json(
      {
        error: 'Unexpected support-ai error',
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
