import { ClerkProvider } from '@clerk/nextjs';
import { Fraunces, Inter, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';
import './responsive.css';
import './accessibility.css';
import SiteHeader from '@/components/SiteHeader';

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
      <html
        lang="en"
        className={`${fraunces.variable} ${inter.variable} ${plexMono.variable} h-full antialiased`}
      >
        <body className="min-h-full flex flex-col">
          <a href="#main-content" className="skip-link">
            Skip to main content
          </a>
          <SiteHeader />
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
