import Link from 'next/link';

const STEPS = [
  {
    n: '01',
    title: 'Register school',
    body: 'Educators create an account and get their school set up.',
  },
  { n: '02', title: 'Submit papers', body: "Upload papers ahead of each round's deadline." },
  {
    n: '03',
    title: 'Track results',
    body: 'Watch rounds move from open to closed, and see results land.',
  },
];

export default function LandingPage() {
  return (
    <main className="relative overflow-hidden">
      <div className="relative mx-auto flex min-h-[70vh] max-w-2xl flex-col items-center justify-center px-8 py-24 text-center">
        <img
          src="/tree-mark.png"
          alt=""
          aria-hidden="true"
          className="watermark pointer-events-none absolute left-1/2 top-1/2 w-[700px] max-w-none -translate-x-1/2 -translate-y-1/2 object-contain"
        />

        <h1 className="relative font-display text-4xl font-light tracking-tight text-ink sm:text-5xl fade-in-delayed">
          Where papers become <em className="font-semibold not-italic sm:italic">results</em>
        </h1>

        <p className="relative mt-4 max-w-md text-ink-soft fade-in-delayed">
          Register schools, upload papers, and track results — all in one place.
        </p>

        <div className="relative mt-10 flex items-center gap-4 fade-in-delayed">
          <Link
            href="/login"
            className="rounded-md bg-lavender-deep px-6 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lavender/50"
          >
            Log in
          </Link>
          <Link
            href="/register"
            className="rounded-md border border-lavender/40 px-6 py-3 text-sm font-medium text-ink transition-colors hover:border-lavender-deep hover:text-lavender-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lavender/50"
          >
            Create an account
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-8 pb-24">
        <div className="grid gap-8 border-t border-lavender/15 pt-12 sm:grid-cols-3">
          {STEPS.map((step) => (
            <div key={step.n} className="step-card">
              <span className="font-mono text-xs text-gold">{step.n}</span>
              <h2 className="mt-2 font-display text-lg font-semibold text-ink">{step.title}</h2>
              <p className="mt-1 text-sm text-ink-soft">{step.body}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="cta-band">
        <div className="cta-fade" aria-hidden="true" />
        <div className="mx-auto max-w-xl px-8 py-24 text-center">
          <h2 className="font-display text-3xl font-semibold text-white sm:text-4xl">
            Ready to run your next round?
          </h2>
          <p className="mt-4 text-lavender/80">
            Set up rounds, collect papers, and track results — built for the way olympiads actually
            run.
          </p>
          <Link
            href="/register"
            className="mt-8 inline-block rounded-md bg-white px-6 py-3 text-sm font-medium text-lavender-deep transition-opacity hover:opacity-90"
          >
            Create an account
          </Link>
        </div>
      </div>
    </main>
  );
}
