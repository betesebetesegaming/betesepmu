import { createClient } from '@supabase/supabase-js';

const response = (statusCode, body) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  },
  body: JSON.stringify(body)
});

const normalizeType = (raw) => {
  const value = String(raw || '').trim().toLowerCase();
  if (value === 'program' || value.includes('prog')) return 'program';
  return 'advertisement';
};

const normalizeMediaType = (raw) => {
  const value = String(raw || '').trim().toLowerCase();
  return value === 'video' ? 'video' : 'image';
};

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return response(200, { ok: true });
  if (event.httpMethod !== 'POST') return response(405, { error: 'Method not allowed' });

  try {
    const body = JSON.parse(event.body || '{}');
    const id = String(body?.id || '').trim();
    const type = normalizeType(body?.type);
    const url = String(body?.url || '').trim();
    const mediaType = normalizeMediaType(body?.mediaType);

    if (!id || !url) {
      return response(400, { error: 'id and url are required' });
    }

    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRole) {
      return response(500, { error: 'Missing Supabase server environment variables' });
    }

    const supabase = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } });

    const { error } = await supabase.from('program_images').insert({
      id,
      type,
      url,
      media_type: mediaType
    });

    if (error) {
      return response(500, { error: `Program media insert failed: ${error.message}` });
    }

    return response(200, { ok: true });
  } catch (err) {
    return response(500, { error: 'Unexpected insert error', details: String(err?.message || err) });
  }
};
