import { createClient } from '@supabase/supabase-js';

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const resp = (code, body) => ({ statusCode: code, headers, body: JSON.stringify(body) });

// Mirrors utils.ts normalizeGambiaPhone
const normalizePhone = (input) => {
  const digits = String(input || '').replace(/\D/g, '');
  if (digits.startsWith('220') && digits.length === 10) return `+220${digits.slice(3)}`;
  if (digits.length === 7) return `+220${digits}`;
  if (digits.startsWith('221') && digits.length === 12) return `+221${digits.slice(3)}`;
  return null;
};

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return resp(200, { ok: true });
  if (event.httpMethod !== 'POST') return resp(405, { error: 'Method not allowed' });

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  // Prefer service role key (bypasses RLS + grant issues); fall back to anon key
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return resp(503, { error: 'Database not configured' });
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return resp(400, { error: 'Invalid JSON' }); }

  const username = String(body.username || '').trim();
  const password = String(body.password || '').trim();
  if (!username || !password) return resp(400, { error: 'username and password required' });

  const normalizedPhone = normalizePhone(username);
  let orFilter = `name.ilike.${username},id.ilike.${username}`;
  if (normalizedPhone) orFilter += `,phone.eq.${normalizedPhone},id.eq.${normalizedPhone}`;

  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

  const { data, error } = await supabase.from('users').select('*').or(orFilter).limit(5);

  if (error) return resp(403, { error: error.message });
  if (!data || data.length === 0) return resp(200, { user: null });

  const match = data.find(u => (u.password || '').trim() === password);
  if (!match) return resp(200, { user: null });

  return resp(200, { user: match });
};
