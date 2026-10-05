'use client';

import Image from 'next/image';
import Link from 'next/link';
import { SignUp } from '@clerk/nextjs';
import { useRedirectIfAuthenticated } from '@/hooks/useAuthRedirect';
import '../../auth.css';
import ThemeToggle from '@/components/ThemeToggle';
import { useTheme } from '@/components/ThemeProvider';
import { dark } from '@clerk/themes';

export default function RegisterPage() {
  // If already signed in, bounce to the correct dashboard
  useRedirectIfAuthenticated();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <main id="main-content" tabIndex={-1} className="auth-page auth-page-register">
      <ThemeToggle className="theme-toggle-floating" />
      <aside className="auth-story" aria-label="Olympiad Portal introduction">
        <span className="auth-story-watermark" aria-hidden="true">
          <Image src="/tree-mark.png" alt="" width={360} height={360} />
        </span>
        <Link className="auth-story-brand" href="/" aria-label="Olympiad Portal home">
          <span className="auth-story-mark">
            <Image src="/tree-mark.png" alt="" width={30} height={30} />
          </span>
          <span>
            <strong>Olympiad</strong>
            <em>Portal</em>
          </span>
        </Link>
        <div className="auth-story-copy">
          <p className="auth-story-label">Your next chapter starts here</p>
          <h1>
            Make space for
            <br />
            <span>what&apos;s next.</span>
          </h1>
          <p>
            Build confidence through thoughtful practice, friendly competition, and a community that
            keeps you curious.
          </p>
        </div>
        <div className="auth-story-footer">
          <Image src="/tree-mark.png" alt="" width={46} height={46} />
          <span>
            Small steps become
            <br />
            <strong>big breakthroughs.</strong>
          </span>
        </div>
      </aside>
      <section className="auth-form-side" aria-label="Create an Olympiad Portal account">
        <div className="auth-form-inner">
          <div className="auth-mobile-brand">
            <Image src="/tree-mark.png" alt="" width={27} height={27} />
            <span>
              Olympiad <em>Portal</em>
            </span>
          </div>
          <p className="auth-form-context">A thoughtful place to begin</p>
          <SignUp
            routing="path"
            path="/register"
            signInUrl="/login"
            appearance={{
              baseTheme: isDark ? dark : undefined,
              variables: {
                colorPrimary: isDark ? '#a897f7' : '#6c4fd8',
                colorBackground: isDark ? '#1e1a33' : '#ffffff',
                borderRadius: '10px',
              },
              options: {
                logoImageUrl: '/tree-mark.png',
                socialButtonsPlacement: 'bottom',
              },
              elements: {
                rootBox: 'auth-clerk-root',
                cardBox: 'auth-clerk-cardbox',
                card: 'auth-clerk-card',
                headerTitle: 'auth-clerk-title',
                headerSubtitle: 'auth-clerk-subtitle',
                logoBox: 'auth-clerk-logo',
                formButtonPrimary: 'auth-clerk-primary',
                socialButtonsBlockButton: 'auth-clerk-social',
              },
            }}
          />
        </div>
      </section>
    </main>
  );
}
