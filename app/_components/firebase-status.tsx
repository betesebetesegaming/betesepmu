'use client';

import { useEffect, useState } from 'react';
import { firebaseApp } from '@/lib/firebase/client';

export function FirebaseStatus() {
  const [status, setStatus] = useState<'checking' | 'ok' | 'error'>('checking');
  const [projectId, setProjectId] = useState<string | undefined>();

  useEffect(() => {
    try {
      const id = firebaseApp.options.projectId;
      setProjectId(id);
      setStatus(id ? 'ok' : 'error');
    } catch {
      setStatus('error');
    }
  }, []);

  if (status === 'checking') {
    return <p className="text-sm text-gray-500">Checking Firebase…</p>;
  }
  if (status === 'error') {
    return (
      <p className="text-sm text-red-600">
        Firebase not initialised — check NEXT_PUBLIC_FIREBASE_* env vars.
      </p>
    );
  }
  return (
    <p className="text-sm text-green-700">
      Firebase initialised — project <code className="font-mono">{projectId}</code>
    </p>
  );
}
