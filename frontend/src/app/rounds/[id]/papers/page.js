'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { uploadPaper, ApiError } from '@/lib/api';

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
  const { getToken } = useAuth();

  const [paperFile, setPaperFile] = useState(null);
  const [memoFile, setMemoFile] = useState(null);
  const [answerRows, setAnswerRows] = useState([{ question: '1', answer: '' }]);
  const [fieldErrors, setFieldErrors] = useState({});
  const [status, setStatus] = useState('idle'); // idle | submitting | success | error
  const [errorMessage, setErrorMessage] = useState('');
  const [uploadedPaper, setUploadedPaper] = useState(null);

  function updateRow(index, field, value) {
    setAnswerRows((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  }

  function addRow() {
    setAnswerRows((prev) => [...prev, { question: String(prev.length + 1), answer: '' }]);
  }

  function removeRow(index) {
    setAnswerRows((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setErrorMessage('');

    const errors = validateFiles(paperFile, memoFile);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    // Build the answer key from filled-in rows only — empty rows are
    // silently skipped rather than blocking the whole upload.
    const memoAnswers = {};
    answerRows.forEach((row) => {
      if (row.question.trim() && row.answer.trim()) {
        memoAnswers[row.question.trim()] = row.answer.trim().toUpperCase();
      }
    });

    setStatus('submitting');
    try {
      const token = await getToken();
      const paper = await uploadPaper(roundId, { paperFile, memoFile, memoAnswers }, token);
      setUploadedPaper(paper);
      setStatus('success');
    } catch (err) {
      setStatus('error');
      setErrorMessage(
        err instanceof ApiError ? err.message : 'Something went wrong. Please try again.'
      );
    }
  }

  function handleReset() {
    setPaperFile(null);
    setMemoFile(null);
    setAnswerRows([{ question: '1', answer: '' }]);
    setFieldErrors({});
    setStatus('idle');
    setErrorMessage('');
    setUploadedPaper(null);
  }

  if (status === 'success' && uploadedPaper) {
    return (
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-xl px-8 py-12">
        <div
          role="status"
          className="certificate-card rounded-lg border border-lavender/20 bg-surface p-6 shadow-sm"
        >
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-sage" aria-hidden="true" />
            <h1 className="font-display text-xl font-semibold text-ink">Paper uploaded</h1>
          </div>
          <p className="mt-2 text-sm text-ink-soft">
            Uploaded for round <span className="font-mono text-ink">{roundId}</span> at{' '}
            {new Date(uploadedPaper.uploadedAt).toLocaleString()}.
          </p>
          <dl className="mt-4 space-y-1 text-sm">
            <div className="flex gap-2">
              <dt className="font-medium text-ink-soft">Paper</dt>
              <dd className="truncate font-mono text-ink">{uploadedPaper.fileUrl}</dd>
            </div>
            {uploadedPaper.memoUrl && (
              <div className="flex gap-2">
                <dt className="font-medium text-ink-soft">Memo</dt>
                <dd className="truncate font-mono text-ink">{uploadedPaper.memoUrl}</dd>
              </div>
            )}
            {uploadedPaper.memoAnswers && (
              <div className="flex gap-2">
                <dt className="font-medium text-ink-soft">Answer key</dt>
                <dd className="text-ink">
                  {Object.keys(uploadedPaper.memoAnswers).length} question
                  {Object.keys(uploadedPaper.memoAnswers).length === 1 ? '' : 's'} set
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
    <main id="main-content" tabIndex={-1} className="mx-auto max-w-xl px-8 py-12">
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Upload paper</h1>
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
          <p className="mt-1 text-xs text-ink-soft">
            The file for markers to reference — not used for automarking.
          </p>
          {fieldErrors.memo && (
            <p id="memo-error" role="alert" className="mt-1 text-sm text-red-600">
              {fieldErrors.memo}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-ink">
            Answer key <span className="text-ink-soft">(for automarking)</span>
          </label>
          <p className="mt-1 text-xs text-ink-soft">
            The correct option for each question. This is what the portal actually checks
            submissions against.
          </p>

          <div className="mt-3 space-y-2">
            {answerRows.map((row, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  aria-label={`Question number, row ${index + 1}`}
                  type="text"
                  placeholder="Q#"
                  value={row.question}
                  onChange={(e) => updateRow(index, 'question', e.target.value)}
                  className="w-16 rounded-md border border-lavender/30 bg-surface px-2 py-1.5 text-sm text-ink text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-lavender/50"
                />
                <input
                  aria-label={`Correct answer, row ${index + 1}`}
                  type="text"
                  placeholder="Answer (e.g. B)"
                  value={row.answer}
                  onChange={(e) => updateRow(index, 'answer', e.target.value)}
                  className="flex-1 rounded-md border border-lavender/30 bg-surface px-3 py-1.5 text-sm text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-lavender/50"
                />
                {answerRows.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeRow(index)}
                    className="text-sm text-ink-soft hover:text-red-600"
                    aria-label={`Remove question ${row.question}`}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addRow}
            className="mt-3 text-sm font-medium text-lavender-deep hover:opacity-80"
          >
            + Add question
          </button>
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
