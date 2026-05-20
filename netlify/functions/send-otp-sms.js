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

const parseAfricellXmlResponse = (xmlText) => {
  const statusMatch = String(xmlText || '').match(/<Status>(.*?)<\/Status>/i);
  const messageMatch = String(xmlText || '').match(/<Message>(.*?)<\/Message>/i);
  return {
    statusCode: String(statusMatch?.[1] || '').trim(),
    statusMessage: String(messageMatch?.[1] || '').trim()
  };
};

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return response(200, { ok: true });
  }

  if (event.httpMethod !== 'POST') {
    return response(405, { error: 'Method not allowed' });
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const provider = String(body.provider || '').trim().toLowerCase();
    const sender = String(body.sender || '').trim();
    const msisdn = String(body.msisdn || '').trim();
    const message = String(body.message || '').trim();

    if (provider !== 'africell') {
      return response(400, { error: 'Unsupported OTP SMS provider' });
    }
    if (!sender || !msisdn || !message) {
      return response(400, { error: 'sender, msisdn, and message are required' });
    }

    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
    const smsBaseUrl = process.env.VITE_AFRICELL_SMS_BASE_URL || process.env.VITE_SMS_API_BASE_URL || '';

    if (!supabaseUrl || !supabaseAnonKey) {
      return response(503, { error: 'Supabase env is missing on Netlify function runtime' });
    }
    if (!smsBaseUrl.trim()) {
      return response(503, { error: 'Africell SMS base URL is not configured on Netlify' });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data: config, error: configError } = await supabase
      .from('otp_config')
      .select('provider, api_key, api_secret, phone_from_number, is_enabled')
      .eq('provider', 'africell')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (configError) {
      return response(502, { error: configError.message || 'Unable to load OTP config' });
    }
    if (!config?.is_enabled) {
      return response(400, { error: 'OTP is disabled in otp_config' });
    }

    const username = String(config.api_key || '').trim();
    const password = String(config.api_secret || '').trim();
    if (!username || !password) {
      return response(400, { error: 'Africell username/password missing in otp_config' });
    }

    const endpoint = `${smsBaseUrl.replace(/\/+$/, '')}/api/sendsms?sender=${encodeURIComponent(sender)}&msisdn=${encodeURIComponent(msisdn)}`;
    const auth = Buffer.from(`${username}:${password}`).toString('base64');

    const upstream = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'text/plain; charset=utf-8'
      },
      body: message
    });

    const xml = await upstream.text();
    const parsed = parseAfricellXmlResponse(xml);
    const statusCode = parsed.statusCode || String(upstream.status || '');
    const statusMessage = parsed.statusMessage || upstream.statusText || 'Unknown response';

    if (statusCode !== '200') {
      return response(502, { error: `Africell SMS failed (${statusCode}): ${statusMessage}` });
    }

    return response(200, { ok: true, message: 'OTP SMS sent successfully' });
  } catch (err) {
    return response(500, { error: String(err?.message || err) });
  }
};
