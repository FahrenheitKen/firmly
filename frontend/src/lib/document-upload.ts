import { api } from './api';

interface PresignResponse {
  uploads: Array<{
    url: string;
    fields: Record<string, string>;
    key: string;
    original_name: string;
  }>;
}

interface RegisterResponse {
  documents: unknown[];
}

interface UploadOptions {
  caseId: number | string;
  files: File[];
  displayNames?: (string | undefined)[];
  documentDate?: string;
  token: string;
  onProgress?: (loaded: number, total: number) => void;
}

/**
 * Upload one or more files to a case using the direct browser → S3 path:
 *   1. POST /cases/{id}/documents/presign  → get presigned POST URLs
 *   2. POST each file directly to S3      (no php-fpm hop)
 *   3. POST /cases/{id}/documents/register → create DB rows + queue conversion
 *
 * Falls back to the legacy multipart endpoint on the same `caseId` if presign
 * is unavailable (e.g. local-disk dev environment).
 */
export async function uploadDocuments({
  caseId,
  files,
  displayNames,
  documentDate,
  token,
  onProgress,
}: UploadOptions): Promise<RegisterResponse> {
  // ----- 1. Presign -----
  const presignReq = files.map((f) => ({ name: f.name, size: f.size, type: f.type || 'application/octet-stream' }));
  let presign: PresignResponse;
  try {
    presign = await api.post<PresignResponse>(`/cases/${caseId}/documents/presign`, { files: presignReq }, token);
  } catch (err: unknown) {
    const status = (err as { status?: number }).status;
    if (status === 422 || status === 404) {
      return uploadDocumentsLegacy({ caseId, files, displayNames, documentDate, token });
    }
    throw err;
  }

  // ----- 2. Upload each file to S3 -----
  const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
  let cumulative = 0;

  try {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const slot = presign.uploads[i];
      if (!slot) throw new Error('presign/file count mismatch');

      const fd = new FormData();
      Object.entries(slot.fields).forEach(([k, v]) => fd.append(k, v));
      fd.append('Content-Type', file.type || 'application/octet-stream');
      fd.append('file', file);

      await xhrUpload(slot.url, fd, (loaded) => {
        onProgress?.(cumulative + loaded, totalBytes);
      });
      cumulative += file.size;
      onProgress?.(cumulative, totalBytes);
    }
  } catch (err) {
    // Most likely cause is missing S3 bucket CORS. Fall back to the multipart
    // path so the upload still succeeds (just via php-fpm, slower).
    console.warn('Direct S3 upload failed, falling back to server-proxied upload:', err);
    return uploadDocumentsLegacy({ caseId, files, displayNames, documentDate, token });
  }

  // ----- 3. Register all -----
  const documents = files.map((file, i) => ({
    key: presign.uploads[i].key,
    original_name: file.name,
    display_name: displayNames?.[i] ?? undefined,
  }));

  return await api.post<RegisterResponse>(
    `/cases/${caseId}/documents/register`,
    { documents, document_date: documentDate },
    token,
  );
}

// Fallback: upload via the original multipart endpoint that proxies through php-fpm.
async function uploadDocumentsLegacy({
  caseId,
  files,
  displayNames,
  documentDate,
  token,
}: Omit<UploadOptions, 'onProgress'>): Promise<RegisterResponse> {
  const fd = new FormData();
  files.forEach((f) => fd.append('documents[]', f));
  (displayNames ?? []).forEach((n) => fd.append('document_names[]', n ?? ''));
  if (documentDate) fd.append('document_date', documentDate);
  return await api.post<RegisterResponse>(`/cases/${caseId}/documents`, fd, token);
}

// XHR gives us progress events — fetch() doesn't (yet).
function xhrUpload(url: string, fd: FormData, onProgress: (loaded: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) onProgress(e.loaded);
    });
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`S3 upload failed (${xhr.status}): ${xhr.responseText.slice(0, 200)}`));
    });
    xhr.addEventListener('error', () => reject(new Error('Network error during S3 upload')));
    xhr.addEventListener('abort', () => reject(new Error('Upload aborted')));
    xhr.send(fd);
  });
}
