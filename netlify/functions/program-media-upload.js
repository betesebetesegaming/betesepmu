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

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return response(200, { ok: true });
  if (event.httpMethod !== 'POST') return response(405, { error: 'Method not allowed' });

  try {
    const body = JSON.parse(event.body || '{}');
    const fileName = String(body?.fileName || '').trim();
    const fileType = String(body?.fileType || 'application/octet-stream');
    const base64Data = String(body?.base64Data || '');

    if (!fileName || !base64Data) {
      return response(400, { error: 'fileName and base64Data are required' });
    }

    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRole) {
      return response(500, { error: 'Missing Supabase server environment variables' });
    }

    const supabase = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } });

    const safeExt = fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : 'jpg';
    const storagePath = `${Date.now()}-${Math.random().toString(36).slice(2)}.${safeExt}`;
    const binary = Buffer.from(base64Data, 'base64');

    const { error: uploadError } = await supabase.storage
      .from('PROGRAMS')
      .upload(storagePath, binary, {
        contentType: fileType,
        upsert: false,
        cacheControl: '3600'
      });

    if (uploadError) {
      return response(500, { error: `Storage upload failed: ${uploadError.message}` });
    }

    const { data } = supabase.storage.from('PROGRAMS').getPublicUrl(storagePath);
    return response(200, { publicUrl: data.publicUrl, path: storagePath });
  } catch (err) {
    return response(500, { error: 'Unexpected upload error', details: String(err?.message || err) });
  }
};
