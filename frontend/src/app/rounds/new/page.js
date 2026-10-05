'use client';

import { useMemo, useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@clerk/nextjs';
import { createOlympiad, createRound, ApiError } from '@/lib/api';

// Best-effort list of IANA timezones for the datalist. Falls back to a
// short manual list on browsers without Intl.supportedValuesOf (older
// Safari) — the field still accepts free text either way.
function getTimezoneOptions() {
  try {
    return Intl.supportedValuesOf('timeZone');
  } catch {
    return ['Africa/Johannesburg', 'Europe/London', 'America/New_York', 'Asia/Tokyo', 'UTC'];
  }
}

function validateOlympiad(name, timezone) {
  const errors = {};
  if (!name.trim()) errors.name = 'Olympiad name is required.';
  if (!timezone.trim()) errors.timezone = 'Timezone is required.';
  return errors;
}

function validateExistingId(olympiadId) {
  const errors = {};
  if (!olympiadId.trim()) errors.olympiadId = 'Olympiad ID is required.';
  return errors;
}

function validateRound(name, openTime, closeTime, qualifyingThreshold) {
  const errors = {};
  if (!name.trim()) errors.name = 'Round name is required.';
  if (!openTime) errors.openTime = 'Open time is required.';
  if (!closeTime) errors.closeTime = 'Close time is required.';
  if (openTime && closeTime && new Date(closeTime) <= new Date(openTime)) {
    errors.closeTime = 'Close time must be after open time.';
  }
  if (qualifyingThreshold.trim()) {
    const n = Number(qualifyingThreshold);
    if (Number.isNaN(n) || n < 0 || n > 100) {
      errors.qualifyingThreshold = 'Threshold must be a number between 0 and 100.';
    }
  }
  return errors;
}

function NewRoundForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { getToken } = useAuth();
  const presetOlympiadId = searchParams.get('olympiadId');
  const presetOlympiadName = searchParams.get('olympiadName');

  const timezoneOptions = useMemo(() => getTimezoneOptions(), []);

  // If an olympiad ID was passed via query params, skip step 1
  const hasPresetOlympiad = Boolean(presetOlympiadId);
  const [step, setStep] = useState(hasPresetOlympiad ? 2 : 1); // 1 = olympiad, 2 = round
  const [olympiadMode, setOlympiadMode] = useState('create'); // 'create' | 'existing'

  // Step 1 fields
  const [olympiadName, setOlympiadName] = useState('');
  const [timezone, setTimezone] = useState('');
  const [existingOlympiadId, setExistingOlympiadId] = useState('');
  const [olympiadErrors, setOlympiadErrors] = useState({});
  const [olympiadStatus, setOlympiadStatus] = useState('idle');
  const [olympiadErrorMessage, setOlympiadErrorMessage] = useState('');

  // Resolved olympiad (from creation response, the manually entered ID, or the query param)
  const [olympiad, setOlympiad] = useState(
    hasPresetOlympiad ? { id: presetOlympiadId, name: presetOlympiadName } : null
  );

  // Step 2 fields
  const [roundName, setRoundName] = useState('');
  const [openTime, setOpenTime] = useState('');
  const [closeTime, setCloseTime] = useState('');
  const [qualifyingThreshold, setQualifyingThreshold] = useState('');
  const [roundErrors, setRoundErrors] = useState({});
  const [roundStatus, setRoundStatus] = useState('idle');
  const [roundErrorMessage, setRoundErrorMessage] = useState('');
  const [createdRound, setCreatedRound] = useState(null);

  async function handleOlympiadSubmit(event) {
    event.preventDefault();
    setOlympiadErrorMessage('');

    if (olympiadMode === 'create') {
      const errors = validateOlympiad(olympiadName, timezone);
      setOlympiadErrors(errors);
      if (Object.keys(errors).length > 0) return;

      setOlympiadStatus('submitting');
      try {
        // Organiser-only endpoint: the token both authorises the request
        // and makes this organiser the olympiad's owner.
        const token = await getToken();
        const created = await createOlympiad(
          {
            name: olympiadName.trim(),
            timezone: timezone.trim(),
          },
          token
        );
        setOlympiad(created);
        setOlympiadStatus('success');
        setStep(2);
      } catch (err) {
        setOlympiadStatus('error');
        setOlympiadErrorMessage(err instanceof ApiError ? err.message : 'Something went wrong.');
      }
    } else {
      const errors = validateExistingId(existingOlympiadId);
      setOlympiadErrors(errors);
      if (Object.keys(errors).length > 0) return;

      // No GET /olympiads/:id exists yet to verify this — we optimistically
      // trust the pasted ID and let the round-creation step surface a 404
      // if it's wrong (the backend validates the FK on POST /rounds).
      setOlympiad({ id: existingOlympiadId.trim(), name: null });
      setStep(2);
    }
  }

  async function handleRoundSubmit(event) {
    event.preventDefault();
    setRoundErrorMessage('');

    const errors = validateRound(roundName, openTime, closeTime, qualifyingThreshold);
    setRoundErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setRoundStatus('submitting');
    try {
      const token = await getToken();
      const round = await createRound(
        {
          olympiadId: olympiad.id,
          name: roundName.trim(),
          openTime: new Date(openTime).toISOString(),
          closeTime: new Date(closeTime).toISOString(),
          qualifyingThreshold: qualifyingThreshold.trim() ? Number(qualifyingThreshold) : null,
        },
        token
      );
      setCreatedRound(round);
      setRoundStatus('success');
    } catch (err) {
      setRoundStatus('error');
      setRoundErrorMessage(err instanceof ApiError ? err.message : 'Something went wrong.');
    }
  }

  function handleCreateAnotherRound() {
    setRoundName('');
    setOpenTime('');
    setCloseTime('');
    setQualifyingThreshold('');
    setRoundErrors({});
    setRoundStatus('idle');
    setRoundErrorMessage('');
    setCreatedRound(null);
  }

  function handleStartOver() {
    // If the user came from the organiser dashboard with a preset olympiad,
    // "start over" means go back to the dashboard
    if (hasPresetOlympiad) {
      router.push('/organiser');
      return;
    }
    setStep(1);
    setOlympiadMode('create');
    setOlympiadName('');
    setTimezone('');
    setExistingOlympiadId('');
    setOlympiadErrors({});
    setOlympiadStatus('idle');
    setOlympiadErrorMessage('');
    setOlympiad(null);
    handleCreateAnotherRound();
  }

  return (
    <main id="main-content" tabIndex={-1} className="mx-auto max-w-xl px-8 py-12">
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">
        Set up a round
      </h1>
      <div className="mt-3 h-px w-12 bg-lavender" aria-hidden="true" />

      {/* Step indicator */}
      <ol className="mt-6 flex items-center gap-3 text-sm">
        <li className="flex items-center gap-2">
          <span
            className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-medium ${
              step === 1 ? 'bg-lavender-deep text-white' : 'bg-lavender/20 text-lavender-deep'
            }`}
          >
            1
          </span>
          <span className={step === 1 ? 'text-ink' : 'text-ink-soft'}>Olympiad</span>
        </li>
        <li aria-hidden="true" className="h-px w-6 bg-lavender/30" />
        <li className="flex items-center gap-2">
          <span
            className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-medium ${
              step === 2 ? 'bg-lavender-deep text-white' : 'bg-lavender/20 text-lavender-deep'
            }`}
          >
            2
          </span>
          <span className={step === 2 ? 'text-ink' : 'text-ink-soft'}>Round details</span>
        </li>
      </ol>

      {step === 1 && (
        <form onSubmit={handleOlympiadSubmit} noValidate className="mt-8 space-y-5">
          {/* Mode toggle */}
          <div
            role="radiogroup"
            aria-label="Olympiad source"
            className="inline-flex rounded-md border border-lavender/30 p-0.5"
          >
            <button
              type="button"
              role="radio"
              aria-checked={olympiadMode === 'create'}
              onClick={() => setOlympiadMode('create')}
              className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                olympiadMode === 'create'
                  ? 'bg-lavender-deep text-white'
                  : 'text-ink-soft hover:text-ink'
              }`}
            >
              Create new
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={olympiadMode === 'existing'}
              onClick={() => setOlympiadMode('existing')}
              className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                olympiadMode === 'existing'
                  ? 'bg-lavender-deep text-white'
                  : 'text-ink-soft hover:text-ink'
              }`}
            >
              Use existing ID
            </button>
          </div>

          {olympiadMode === 'create' ? (
            <>
              <div>
                <label htmlFor="olympiad-name" className="block text-sm font-medium text-ink">
                  Olympiad name <span className="text-gold">*</span>
                </label>
                <input
                  id="olympiad-name"
                  type="text"
                  value={olympiadName}
                  onChange={(e) => setOlympiadName(e.target.value)}
                  placeholder="e.g. Wits Computing Olympiad 2026"
                  aria-invalid={Boolean(olympiadErrors.name)}
                  aria-describedby={olympiadErrors.name ? 'olympiad-name-error' : undefined}
                  className="mt-2 block w-full rounded-md border border-lavender/30 bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-soft/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-lavender/50"
                />
                {olympiadErrors.name && (
                  <p id="olympiad-name-error" role="alert" className="mt-1 text-sm text-red-600">
                    {olympiadErrors.name}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="timezone" className="block text-sm font-medium text-ink">
                  Timezone <span className="text-gold">*</span>
                </label>
                <input
                  id="timezone"
                  list="timezone-options"
                  type="text"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  placeholder="e.g. Africa/Johannesburg"
                  aria-invalid={Boolean(olympiadErrors.timezone)}
                  aria-describedby={olympiadErrors.timezone ? 'timezone-error' : undefined}
                  className="mt-2 block w-full rounded-md border border-lavender/30 bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-soft/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-lavender/50"
                />
                <datalist id="timezone-options">
                  {timezoneOptions.map((tz) => (
                    <option key={tz} value={tz} />
                  ))}
                </datalist>
                {olympiadErrors.timezone && (
                  <p id="timezone-error" role="alert" className="mt-1 text-sm text-red-600">
                    {olympiadErrors.timezone}
                  </p>
                )}
              </div>
            </>
          ) : (
            <div>
              <label htmlFor="existing-olympiad-id" className="block text-sm font-medium text-ink">
                Olympiad ID <span className="text-gold">*</span>
              </label>
              <input
                id="existing-olympiad-id"
                type="text"
                value={existingOlympiadId}
                onChange={(e) => setExistingOlympiadId(e.target.value)}
                placeholder="Paste an existing olympiad's ID"
                aria-invalid={Boolean(olympiadErrors.olympiadId)}
                aria-describedby={olympiadErrors.olympiadId ? 'existing-id-error' : undefined}
                className="mt-2 block w-full rounded-md border border-lavender/30 bg-surface px-3 py-2 font-mono text-sm text-ink placeholder:font-sans placeholder:text-ink-soft/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-lavender/50"
              />
              <p className="mt-1 text-xs text-ink-soft">
                There&apos;s no olympiad picker yet — paste the ID directly. It&apos;ll be verified
                when you create the round.
              </p>
              {olympiadErrors.olympiadId && (
                <p id="existing-id-error" role="alert" className="mt-1 text-sm text-red-600">
                  {olympiadErrors.olympiadId}
                </p>
              )}
            </div>
          )}

          {olympiadStatus === 'error' && (
            <div
              role="alert"
              className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"
            >
              {olympiadErrorMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={olympiadStatus === 'submitting'}
            className="rounded-md bg-lavender-deep px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-lavender/50 focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
          >
            {olympiadStatus === 'submitting'
              ? 'Creating…'
              : olympiadMode === 'create'
                ? 'Create olympiad and continue'
                : 'Continue'}
          </button>
        </form>
      )}

      {step === 2 && olympiad && !createdRound && (
        <form onSubmit={handleRoundSubmit} noValidate className="mt-8 space-y-5">
          <p className="text-sm text-ink-soft">
            Olympiad:{' '}
            {olympiad.name ? (
              <span className="font-medium text-ink">{olympiad.name}</span>
            ) : (
              <span className="font-mono text-ink">{olympiad.id}</span>
            )}
            {!hasPresetOlympiad && (
              <button
                type="button"
                onClick={handleStartOver}
                className="ml-2 text-lavender-deep underline underline-offset-2 hover:opacity-80"
              >
                change
              </button>
            )}
            {hasPresetOlympiad && (
              <Link
                href="/organiser"
                className="ml-2 text-lavender-deep underline underline-offset-2 hover:opacity-80"
              >
                back
              </Link>
            )}
          </p>

          <div>
            <label htmlFor="round-name" className="block text-sm font-medium text-ink">
              Round name <span className="text-gold">*</span>
            </label>
            <input
              id="round-name"
              type="text"
              value={roundName}
              onChange={(e) => setRoundName(e.target.value)}
              placeholder="e.g. Round 1 — Qualifying"
              aria-invalid={Boolean(roundErrors.name)}
              aria-describedby={roundErrors.name ? 'round-name-error' : undefined}
              className="mt-2 block w-full rounded-md border border-lavender/30 bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-soft/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-lavender/50"
            />
            {roundErrors.name && (
              <p id="round-name-error" role="alert" className="mt-1 text-sm text-red-600">
                {roundErrors.name}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="open-time" className="block text-sm font-medium text-ink">
                Opens <span className="text-gold">*</span>
              </label>
              <input
                id="open-time"
                type="datetime-local"
                value={openTime}
                onChange={(e) => setOpenTime(e.target.value)}
                aria-invalid={Boolean(roundErrors.openTime)}
                aria-describedby={roundErrors.openTime ? 'open-time-error' : undefined}
                className="mt-2 block w-full rounded-md border border-lavender/30 bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-lavender/50"
              />
              {roundErrors.openTime && (
                <p id="open-time-error" role="alert" className="mt-1 text-sm text-red-600">
                  {roundErrors.openTime}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="close-time" className="block text-sm font-medium text-ink">
                Closes <span className="text-gold">*</span>
              </label>
              <input
                id="close-time"
                type="datetime-local"
                value={closeTime}
                onChange={(e) => setCloseTime(e.target.value)}
                aria-invalid={Boolean(roundErrors.closeTime)}
                aria-describedby={roundErrors.closeTime ? 'close-time-error' : undefined}
                className="mt-2 block w-full rounded-md border border-lavender/30 bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-lavender/50"
              />
              {roundErrors.closeTime && (
                <p id="close-time-error" role="alert" className="mt-1 text-sm text-red-600">
                  {roundErrors.closeTime}
                </p>
              )}
            </div>
          </div>

          <div>
            <label htmlFor="qualifying-threshold" className="block text-sm font-medium text-ink">
              Qualifying threshold <span className="text-ink-soft font-normal">(optional)</span>
            </label>
            <input
              id="qualifying-threshold"
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={qualifyingThreshold}
              onChange={(e) => setQualifyingThreshold(e.target.value)}
              placeholder="e.g. 70"
              aria-invalid={Boolean(roundErrors.qualifyingThreshold)}
              aria-describedby={
                roundErrors.qualifyingThreshold
                  ? 'qualifying-threshold-error'
                  : 'qualifying-threshold-hint'
              }
              className="mt-2 block w-full rounded-md border border-lavender/30 bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-soft/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-lavender/50"
            />
            <p id="qualifying-threshold-hint" className="mt-1 text-xs text-ink-soft">
              Entrants scoring at or above this percentage will be automatically registered for the
              next round when this one closes. Leave blank if this round doesn&apos;t feed into
              another.
            </p>
            {roundErrors.qualifyingThreshold && (
              <p id="qualifying-threshold-error" role="alert" className="mt-1 text-sm text-red-600">
                {roundErrors.qualifyingThreshold}
              </p>
            )}
          </div>

          {roundStatus === 'error' && (
            <div
              role="alert"
              className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"
            >
              {roundErrorMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={roundStatus === 'submitting'}
            className="rounded-md bg-lavender-deep px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-lavender/50 focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
          >
            {roundStatus === 'submitting' ? 'Creating…' : 'Create round'}
          </button>
        </form>
      )}

      {createdRound && (
        <div className="mt-8">
          <div
            role="status"
            className="rounded-lg border border-lavender/20 bg-surface p-6 shadow-sm"
          >
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-sage" aria-hidden="true" />
              <h2 className="font-display text-xl font-semibold text-ink">Round created</h2>
            </div>
            <dl className="mt-4 space-y-1 text-sm">
              <div className="flex gap-2">
                <dt className="font-medium text-ink-soft">Name</dt>
                <dd className="text-ink">{createdRound.name}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="font-medium text-ink-soft">Opens</dt>
                <dd className="text-ink">{new Date(createdRound.openTime).toLocaleString()}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="font-medium text-ink-soft">Closes</dt>
                <dd className="text-ink">{new Date(createdRound.closeTime).toLocaleString()}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="font-medium text-ink-soft">State</dt>
                <dd className="text-ink">{createdRound.state}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="font-medium text-ink-soft">Round ID</dt>
                <dd className="truncate font-mono text-ink">{createdRound.id}</dd>
              </div>
            </dl>
          </div>
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={handleCreateAnotherRound}
              className="rounded-md border border-lavender/40 px-4 py-2 text-sm font-medium text-lavender-deep transition-colors hover:bg-lavender/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-lavender/50"
            >
              Add another round
            </button>
            <button
              type="button"
              onClick={handleStartOver}
              className="rounded-md px-4 py-2 text-sm font-medium text-ink-soft transition-colors hover:text-ink"
            >
              Start over
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

export default function NewRoundPage() {
  return (
    <Suspense
      fallback={
        <main id="main-content" tabIndex={-1} className="mx-auto max-w-xl px-8 py-12">
          <p>Loading...</p>
        </main>
      }
    >
      <NewRoundForm />
    </Suspense>
  );
}
