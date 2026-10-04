import { ClerkProvider } from '@clerk/nextjs';
import { Fraunces, Inter, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';
import './theme.css';
import './responsive.css';
import './accessibility.css';
import SiteHeader from '@/components/SiteHeader';
import { ThemeProvider } from '@/components/ThemeProvider';
import { themeInitScript } from '@/lib/theme';

// Display face — headings only, used with restraint.
const fraunces = Fraunces({
  variable: '--font-fraunces',
  subsets: ['latin'],
  weight: ['500', '600'],
  style: ['normal', 'italic'],
});

// Body/UI face — labels, buttons, paragraph text.
const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
});

// Utility face — round IDs, file paths, timestamps.
const plexMono = IBM_Plex_Mono({
  variable: '--font-plex-mono',
  subsets: ['latin'],
  weight: ['400', '500'],
});

export const metadata = {
  title: 'Olympiad Portal | Where curious minds rise',
  description:
    'A home for learners who love a good challenge. Explore olympiads, prepare with confidence and grow beyond the classroom.',
};

// Without this, mobile browsers lay the page out at ~980px and shrink it.
// Zoom stays enabled (maximumScale 5) so low-vision users can pinch-zoom.
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }) {
  return (
    <ClerkProvider>
      {/* suppressHydrationWarning: the init script sets data-theme and
          color-scheme on <html> before React hydrates. */}
      <html
        lang="en"
        suppressHydrationWarning
        className={`${fraunces.variable} ${inter.variable} ${plexMono.variable} h-full antialiased`}
      >
        <head>
          <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        </head>
        <body className="min-h-full flex flex-col">
          <ThemeProvider>
            <a href="#main-content" className="skip-link">
              Skip to main content
            </a>
            <SiteHeader />
            {children}
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
