import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SignalDetailModal from './SignalDetailModal';

describe('SignalDetailModal', () => {
  const mockSignals = [
    {
      type: 'speed_anomaly',
      severity: 'high',
      details: { durationMinutes: 15, cohortAverageMinutes: 45 },
      entrants: [{ id: 'entrant-1', name: 'Alice Smith' }],
    },
  ];

  it('renders nothing when signals is null', () => {
    const { container } = render(
      <SignalDetailModal signals={null} entrantName="Alice" onClose={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when signals is empty', () => {
    const { container } = render(
      <SignalDetailModal signals={[]} entrantName="Alice" onClose={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders the modal with dialog role', () => {
    render(<SignalDetailModal signals={mockSignals} entrantName="Alice" onClose={vi.fn()} />);
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('displays the entrant name', () => {
    render(<SignalDetailModal signals={mockSignals} entrantName="Alice Smith" onClose={vi.fn()} />);
    expect(screen.getByText('Alice Smith')).toBeTruthy();
  });

  it('displays the signal type', () => {
    render(<SignalDetailModal signals={mockSignals} entrantName="Alice" onClose={vi.fn()} />);
    expect(screen.getByText(/speed anomaly/i)).toBeTruthy();
  });

  it('displays the severity label', () => {
    render(<SignalDetailModal signals={mockSignals} entrantName="Alice" onClose={vi.fn()} />);
    expect(screen.getByText(/high severity/i)).toBeTruthy();
  });

  it('displays the signal description', () => {
    render(<SignalDetailModal signals={mockSignals} entrantName="Alice" onClose={vi.fn()} />);
    expect(screen.getByText(/completed the sitting significantly faster/i)).toBeTruthy();
  });

  it('displays signal details', () => {
    render(<SignalDetailModal signals={mockSignals} entrantName="Alice" onClose={vi.fn()} />);
    expect(screen.getByText(/15 min/i)).toBeTruthy();
    expect(screen.getByText(/45 min/i)).toBeTruthy();
  });

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn();
    render(<SignalDetailModal signals={mockSignals} entrantName="Alice" onClose={onClose} />);
    const closeButton = screen.getByLabelText(/close/i);
    fireEvent.click(closeButton);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the bottom close button is clicked', () => {
    const onClose = vi.fn();
    render(<SignalDetailModal signals={mockSignals} entrantName="Alice" onClose={onClose} />);
    const closeButtons = screen.getAllByRole('button', { name: /close/i });
    // The second close button is the one at the bottom with text "Close"
    fireEvent.click(closeButtons[1]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn();
    render(<SignalDetailModal signals={mockSignals} entrantName="Alice" onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when clicking the overlay', () => {
    const onClose = vi.fn();
    render(<SignalDetailModal signals={mockSignals} entrantName="Alice" onClose={onClose} />);
    const overlay = screen.getByRole('dialog');
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose when clicking inside the modal content', () => {
    const onClose = vi.fn();
    render(<SignalDetailModal signals={mockSignals} entrantName="Alice" onClose={onClose} />);
    const content = screen.getByText(/signal details/i).closest('.card');
    fireEvent.click(content);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('renders multiple signals', () => {
    const multipleSignals = [
      ...mockSignals,
      {
        type: 'identical_answers',
        severity: 'medium',
        details: { matchPercent: 95 },
        entrants: [
          { id: 'entrant-1', name: 'Alice Smith' },
          { id: 'entrant-2', name: 'Bob Jones' },
        ],
      },
    ];
    render(
      <SignalDetailModal signals={multipleSignals} entrantName="Alice" onClose={vi.fn()} />
    );
    expect(screen.getByText(/speed anomaly/i)).toBeTruthy();
    expect(screen.getByText(/identical answers/i)).toBeTruthy();
  });

  it('displays other entrants involved in the signal', () => {
    const signalWithOthers = [
      {
        type: 'identical_answers',
        severity: 'high',
        details: {},
        entrants: [
          { id: 'entrant-1', name: 'Alice Smith' },
          { id: 'entrant-2', name: 'Bob Jones' },
        ],
      },
    ];
    render(
      <SignalDetailModal signals={signalWithOthers} entrantName="Alice" onClose={vi.fn()} />
    );
    expect(screen.getByText(/also involves/i)).toBeTruthy();
    expect(screen.getByText(/Bob Jones/i)).toBeTruthy();
  });
});
