'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
//import { uploadPaper, ApiError } from '@/lib/api';

const MAX_FILE_SIZE_MB = 20;
const ACCEPTED_EXTENSIONS = '.pdf,.doc,.docx';

function validateFiles(paperFile, memoFile) {
  const errors = {};

  if (!paperFile) {
    errors.paper = 'A paper file is required.';
  } else if (paperFile.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
    errors.paper = `Paper file must be smaller than ${MAX_FILE_SIZE_MB}MB.`;
  }

  if (memoFile && memoFile.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
    errors.memo = `Memo file must be smaller than ${MAX_FILE_SIZE_MB}MB.`;
  }

  return errors;
}

export default function PaperUploadPage() {
  const { id: roundId } = useParams();

  const [paperFile, setPaperFile] = useState(null);
  const [memoFile, setMemoFile] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [status, setStatus] = useState('idle'); // idle | submitting | success | error
  const [errorMessage, setErrorMessage] = useState('');
  const [uploadedPaper, setUploadedPaper] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    setErrorMessage('');

    const errors = validateFiles(paperFile, memoFile);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    setStatus('submitting');
    try {
      const paper = await uploadPaper(roundId, { paperFile, memoFile });
      setUploadedPaper(paper);
      setStatus('success');
    } catch (err) {
      setStatus('error');
      setErrorMessage(
        err instanceof ApiError
          ? err.message
          : 'Something went wrong. Please try again.'
      );
    }
  }

  function handleReset() {
    setPaperFile(null);
    setMemoFile(null);
    setFieldErrors({});
    setStatus('idle');
    setErrorMessage('');
    setUploadedPaper(null);
  }

  if (status === 'success' && uploadedPaper) {
    return (
      <main className="mx-auto max-w-xl px-8 py-12">
        <div
          role="status"
          className="certificate-card rounded-lg border border-lavender/20 bg-surface p-6 shadow-sm"
        >
          <div className="flex items-center gap-2">
            <span
              className="h-2 w-2 rounded-full bg-sage"
              aria-hidden="true"
            />
            <h1 className="font-display text-xl font-semibold text-ink">
              Paper uploaded
            </h1>
          </div>
          <p className="mt-2 text-sm text-ink-soft">
            Uploaded for round{' '}
            <span className="font-mono text-ink">{roundId}</span> at{' '}
            {new Date(uploadedPaper.uploadedAt).toLocaleString()}.
          </p>
          <dl className="mt-4 space-y-1 text-sm">
            <div className="flex gap-2">
              <dt className="font-medium text-ink-soft">Paper</dt>
              <dd className="truncate font-mono text-ink">
                {uploadedPaper.fileUrl}
              </dd>
            </div>
            {uploadedPaper.memoUrl && (
              <div className="flex gap-2">
                <dt className="font-medium text-ink-soft">Memo</dt>
                <dd className="truncate font-mono text-ink">
                  {uploadedPaper.memoUrl}
                </dd>
              </div>
            )}
          </dl>
        </div>
        <button
          type="button"
          onClick={handleReset}
          className="mt-4 rounded-md border border-lavender/40 px-4 py-2 text-sm font-medium text-lavender-deep transition-colors hover:bg-lavender/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-lavender/50"
        >
          Upload another paper
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-xl px-8 py-12">
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">
        Upload paper
      </h1>
      <div className="mt-3 h-px w-12 bg-lavender" aria-hidden="true" />
      <p className="mt-3 text-sm text-ink-soft">
        Round <span className="font-mono text-ink">{roundId}</span>
      </p>

      <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-5">
        <div>
          <label htmlFor="paper" className="block text-sm font-medium text-ink">
            Paper file <span className="text-gold">*</span>
          </label>
          <input
            id="paper"
            type="file"
            accept={ACCEPTED_EXTENSIONS}
            onChange={(e) => setPaperFile(e.target.files?.[0] ?? null)}
            aria-invalid={Boolean(fieldErrors.paper)}
            aria-describedby={fieldErrors.paper ? 'paper-error' : undefined}
            className="mt-2 block w-full rounded-md text-sm text-ink-soft file:mr-4 file:rounded-md file:border-0 file:bg-lavender/10 file:px-4 file:py-2 file:text-sm file:font-medium file:text-lavender-deep hover:file:bg-lavender/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-lavender/50"
          />
          {fieldErrors.paper && (
            <p id="paper-error" role="alert" className="mt-1 text-sm text-red-600">
              {fieldErrors.paper}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="memo" className="block text-sm font-medium text-ink">
            Marking memo <span className="text-ink-soft">(optional)</span>
          </label>
          <input
            id="memo"
            type="file"
            accept={ACCEPTED_EXTENSIONS}
            onChange={(e) => setMemoFile(e.target.files?.[0] ?? null)}
            aria-invalid={Boolean(fieldErrors.memo)}
            aria-describedby={fieldErrors.memo ? 'memo-error' : undefined}
            className="mt-2 block w-full rounded-md text-sm text-ink-soft file:mr-4 file:rounded-md file:border-0 file:bg-lavender/10 file:px-4 file:py-2 file:text-sm file:font-medium file:text-lavender-deep hover:file:bg-lavender/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-lavender/50"
          />
          {fieldErrors.memo && (
            <p id="memo-error" role="alert" className="mt-1 text-sm text-red-600">
              {fieldErrors.memo}
            </p>
          )}
        </div>

        {status === 'error' && (
          <div
            role="alert"
            className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"
          >
            {errorMessage}
          </div>
        )}

        <button
          type="submit"
          disabled={status === 'submitting'}
          className="rounded-md bg-lavender-deep px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-lavender/50 focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
        >
          {status === 'submitting' ? 'Uploading…' : 'Upload paper'}
        </button>
      </form>
    </main>
  );
}