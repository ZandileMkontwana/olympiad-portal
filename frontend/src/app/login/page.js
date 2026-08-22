'use client';

import { SignIn } from '@clerk/nextjs';

function Watermark() {
  return (
    <img
      src="/tree-mark.png"
      alt=""
      aria-hidden="true"
      className="watermark pointer-events-none absolute left-1/2 top-1/2 w-[700px] max-w-none -translate-x-1/2 -translate-y-1/2 object-contain"
    />
  );
}

export default function LoginPage() {
  return (
    <main className="relative mx-auto max-w-md px-8 py-24 overflow-hidden">
      <Watermark />
      <div className="relative flex justify-center">
        <SignIn routing="hash" signUpUrl="/register" />
      </div>
    </main>
  );
}