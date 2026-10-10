import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SignalBadge from './SignalBadge';

describe('SignalBadge', () => {
  it('renders the signal type label', () => {
    render(<SignalBadge type="speed_anomaly" severity="high" />);
    expect(screen.getByText('Speed')).toBeTruthy();
  });

  it('renders the raw type when no label mapping exists', () => {
    render(<SignalBadge type="unknown_type" severity="low" />);
    expect(screen.getByText('unknown_type')).toBeTruthy();
  });

  it('applies high severity colors', () => {
    const { container } = render(<SignalBadge type="speed_anomaly" severity="high" />);
    const badge = container.firstChild;
    expect(badge.style.backgroundColor).toBe('rgb(254, 226, 226)'); // #fee2e2
    expect(badge.style.color).toBe('rgb(153, 27, 27)'); // #991b1b
  });

  it('applies medium severity colors', () => {
    const { container } = render(<SignalBadge type="identical_answers" severity="medium" />);
    const badge = container.firstChild;
    expect(badge.style.backgroundColor).toBe('rgb(255, 247, 237)'); // #fff7ed
    expect(badge.style.color).toBe('rgb(154, 52, 18)'); // #9a3412
  });

  it('applies low severity colors', () => {
    const { container } = render(<SignalBadge type="rapid_submit" severity="low" />);
    const badge = container.firstChild;
    expect(badge.style.backgroundColor).toBe('rgb(254, 252, 232)'); // #fefce8
    expect(badge.style.color).toBe('rgb(133, 77, 14)'); // #854d0e
  });

  it('falls back to low severity colors when severity is invalid', () => {
    const { container } = render(<SignalBadge type="speed_anomaly" severity="invalid" />);
    const badge = container.firstChild;
    expect(badge.style.backgroundColor).toBe('rgb(254, 252, 232)'); // #fefce8 (low)
  });

  it('shows a title attribute with signal details', () => {
    render(<SignalBadge type="speed_anomaly" severity="high" />);
    const badge = screen.getByTitle(/cheating signal/i);
    expect(badge).toBeTruthy();
    expect(badge.title).toContain('speed_anomaly');
    expect(badge.title).toContain('high');
  });

  it('renders as a button when onClick is provided', () => {
    const onClick = vi.fn();
    render(<SignalBadge type="speed_anomaly" severity="high" onClick={onClick} />);
    const badge = screen.getByRole('button');
    expect(badge).toBeTruthy();
    expect(badge.style.cursor).toBe('pointer');
  });

  it('renders as a span when onClick is not provided', () => {
    render(<SignalBadge type="speed_anomaly" severity="high" />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    render(<SignalBadge type="speed_anomaly" severity="high" onClick={onClick} />);
    const badge = screen.getByRole('button');
    fireEvent.click(badge);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('calls onClick when Enter is pressed', () => {
    const onClick = vi.fn();
    render(<SignalBadge type="speed_anomaly" severity="high" onClick={onClick} />);
    const badge = screen.getByRole('button');
    fireEvent.keyDown(badge, { key: 'Enter' });
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('calls onClick when Space is pressed', () => {
    const onClick = vi.fn();
    render(<SignalBadge type="speed_anomaly" severity="high" onClick={onClick} />);
    const badge = screen.getByRole('button');
    fireEvent.keyDown(badge, { key: ' ' });
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('has tabIndex 0 when clickable for keyboard accessibility', () => {
    const onClick = vi.fn();
    render(<SignalBadge type="speed_anomaly" severity="high" onClick={onClick} />);
    const badge = screen.getByRole('button');
    expect(badge.tabIndex).toBe(0);
  });
});
