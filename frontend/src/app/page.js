import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col items-center px-8 py-24 text-center">
      <h1 className="font-display text-4xl font-semibold tracking-tight text-ink">
        Olympiad Portal
      </h1>
      <p className="mt-4 text-ink-soft">
        Register schools, upload papers, and track results — all in one place.
      </p>
      <Link
        href="/login"
        className="mt-8 rounded-md bg-lavender-deep px-6 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
      >
        Log In
      </Link>
    </main>
  );
}