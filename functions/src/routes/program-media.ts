import type { Request, Response } from 'express';
import { logger } from 'firebase-functions';
import { adminStorage, adminDb } from '../admin';

interface UploadBody {
  filename?: string;
  contentType?: string;
  base64?: string;
  mediaType?: 'image' | 'video';
}

/**
 * POST /api/program-media-upload
 *
 * Accepts a base64-encoded file (image/video) for a race programme.
 * Writes it to Cloud Storage under PROGRAMS/ and returns a publicly readable
 * download URL. The front-end normally uploads directly to Cloud Storage
 * using the Firebase Web SDK; this server-side path exists for the Sunmi
 * terminal flow that prefers HTTP.
 */
export async function programMediaUploadHandler(req: Request, res: Response): Promise<void> {
  const body = (req.body || {}) as UploadBody;
  if (!body.filename || !body.contentType || !body.base64) {
    res.status(400).json({ error: 'filename, contentType and base64 are required' });
    return;
  }

  const buffer = Buffer.from(body.base64, 'base64');
  if (buffer.length === 0) {
    res.status(400).json({ error: 'Empty file' });
    return;
  }
  if (buffer.length > 50 * 1024 * 1024) {
    res.status(413).json({ error: 'File too large (50 MB max)' });
    return;
  }

  const safeName = body.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `PROGRAMS/${Date.now()}-${Math.random().toString(36).slice(2)}-${safeName}`;

  try {
    const bucket = adminStorage.bucket();
    const file = bucket.file(path);
    await file.save(buffer, {
      contentType: body.contentType,
      resumable: false,
      metadata: {
        cacheControl: 'public, max-age=3600',
        contentType: body.contentType,
      },
    });
    await file.makePublic().catch(() => undefined);
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${encodeURI(path)}`;
    res.json({ ok: true, path, url: publicUrl });
  } catch (err) {
    logger.error('program-media-upload failed', err);
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
}

interface InsertBody {
  id?: string;
  type?: string;
  url?: string;
  mediaType?: 'image' | 'video';
}

/**
 * POST /api/program-media-insert
 *
 * Registers an uploaded programme media file in Firestore so the dashboard
 * can list it. The `type` field is the programme category (e.g. "PMU-VINCENNES").
 */
export async function programMediaInsertHandler(req: Request, res: Response): Promise<void> {
  const body = (req.body || {}) as InsertBody;
  if (!body.id || !body.type || !body.url) {
    res.status(400).json({ error: 'id, type and url are required' });
    return;
  }
  try {
    await adminDb.collection('program_images').doc(body.id).set({
      id: body.id,
      type: body.type,
      url: body.url,
      media_type: body.mediaType || 'image',
      created_at: new Date().toISOString(),
    });
    res.json({ ok: true });
  } catch (err) {
    logger.error('program-media-insert failed', err);
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
}
