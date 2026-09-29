import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Menu,
  Trophy,
  Users,
} from 'lucide-react';
import AuthRedirect from '@/components/AuthRedirect';
import './landing.css';

const pathways = [
  {
    icon: BookOpen,
    title: 'Explore subjects',
    description:
      'Discover challenges in mathematics, science, coding and more — each with tiered levels for every stage of learning.',
    action: 'View subjects',
    size: 'lg',
  },
  {
    icon: CalendarDays,
    title: 'Find an olympiad',
    description: 'Keep up with registration dates, rounds and upcoming events near you.',
    action: 'See calendar',
    size: 'sm',
  },
  {
    icon: Users,
    title: 'Join the community',
    description: 'Connect with mentors, alumni and fellow olympians nationwide.',
    action: 'Meet the community',
    size: 'sm',
  },
];

function TreeMark({ size = 26, tone = 'ink' }) {
  return (
    <span className={`tree-mark tree-mark-${tone}`} aria-hidden="true">
      <img
        src={tone === 'white' ? '/tree-mark-white.png' : '/tree-mark.png'}
        alt=""
        width={size}
        height={size}
        style={{ width: size, height: size }}
      />
    </span>
  );
}

export default function LandingPage() {
  return (
    <main className="landing">
      <AuthRedirect />
      <div className="grain" aria-hidden="true" />
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Olympiad Portal home">
          <span className="brand-badge">
            <TreeMark size={24} />
          </span>
          <span>
            <strong>Olympiad</strong>
            <em>Portal</em>
          </span>
        </a>
        <nav className="desktop-nav" aria-label="Main navigation">
          <a href="#about">About us</a>
          <a href="#subjects">Subjects</a>
          <a href="#events">Events</a>
          <a href="#resources">Resources</a>
        </nav>
        <div className="header-actions">
          <Link className="login-link" href="/login">
            Log in
          </Link>
          <Link className="button button-small" href="/register">
            Get started <ArrowRight size={16} />
          </Link>
          <button className="menu-button" aria-label="Open navigation">
            <Menu size={21} />
          </button>
        </div>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <h1>
            Where curious minds
            <br />
            grow <span className="highlight">without limits</span>.
          </h1>
          <p className="hero-text">
            A home for learners who love a good challenge. Build confidence, sharpen your thinking
            and take your place among the next generation of problem-solvers.
          </p>
          <div className="hero-actions">
            <Link className="button" href="/register">
              Start your journey <ArrowRight size={18} />
            </Link>
            <a className="text-link" href="#about">
              Discover the portal <ChevronRight size={16} />
            </a>
          </div>
          <ul className="feature-chips">
            <li>
              <CheckCircle2 size={15} /> Free to join
            </li>
            <li>
              <Trophy size={15} /> 500+ competitors
            </li>
            <li>
              <Users size={15} /> Nationwide network
            </li>
          </ul>
        </div>
        <div className="hero-panel-wrap">
          <div className="hero-panel">
            <span className="panel-watermark" aria-hidden="true">
              <TreeMark size={280} tone="white" />
            </span>
            <div className="panel-top">
              <span className="panel-logo">
                <TreeMark size={26} tone="white" />
              </span>
              <span className="panel-tag">Est. for curious minds</span>
            </div>
            <ul className="panel-list">
              <li className="panel-item">
                <span className="panel-icon gold">
                  <Trophy size={17} />
                </span>
                <div>
                  <b>Think bigger</b>
                  <small>Every challenge counts</small>
                </div>
              </li>
              <li className="panel-item">
                <span className="panel-icon mint">
                  <CheckCircle2 size={17} />
                </span>
                <div>
                  <b>Progress unlocked</b>
                  <small>Keep growing every day</small>
                </div>
              </li>
              <li className="panel-item">
                <span className="panel-icon violet">
                  <Users size={17} />
                </span>
                <div>
                  <b>A nationwide network</b>
                  <small>Mentors, alumni and peers</small>
                </div>
              </li>
            </ul>
            <div className="panel-foot">
              <strong>500+</strong>
              <span>
                young minds already
                <br />
                learning beyond the classroom
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="pathways" id="about">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Your next chapter</p>
            <h2>
              Make curiosity
              <br />
              <span>your advantage.</span>
            </h2>
          </div>
          <p className="section-intro">
            The Olympiad Portal brings preparation, opportunity and community together in one place.
          </p>
        </div>
        <div className="bento-grid" id="subjects">
          {pathways.map(({ icon: Icon, title, description, action, size }) => (
            <a className={`pathway-card pathway-${size}`} href="#events" key={title}>
              <span className="pathway-icon">
                <Icon size={23} />
              </span>
              <h3>{title}</h3>
              <p>{description}</p>
              <span className="card-link">
                {action} <ArrowRight size={15} />
              </span>
            </a>
          ))}
        </div>
      </section>

      <section className="quote-band" id="events">
        <span className="quote-mark" aria-hidden="true">
          &ldquo;
        </span>
        <p>
          Every olympian starts as a curious kid asking one more question.{' '}
          <span>We just make room to grow.</span>
        </p>
        <span className="quote-tree">
          <TreeMark size={34} tone="white" />
        </span>
      </section>

      <section className="cta-panel" id="resources">
        <div className="cta-copy">
          <p className="section-kicker">Ready when you are</p>
          <h2>
            Plant the seed. <span>Watch it climb.</span>
          </h2>
          <p className="section-intro cta-intro">
            Registration takes minutes. Growth takes a lifetime.
          </p>
        </div>
        <Link className="button button-light" href="/register">
          Get started <ArrowUpRight size={18} />
        </Link>
      </section>

      <footer className="site-footer">
        <span className="footer-brand">
          <TreeMark size={18} /> Olympiad Portal
        </span>
        <span>Growing bright futures, one challenge at a time.</span>
        <a href="#top">Back to top ↑</a>
      </footer>
    </main>
  );
}
