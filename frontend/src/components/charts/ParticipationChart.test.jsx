import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// recharts' real components need layout/ResizeObserver that jsdom doesn't
// provide, so we stub them with minimal pass-throughs and spy on the props
// ParticipationChart hands them — that's where the component's own logic
// (participation math, color assignment, label formatting) actually lives.
const mocks = vi.hoisted(() => ({
  pie: vi.fn(),
}));

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }) => <div data-testid="responsive-container">{children}</div>,
  PieChart: ({ children }) => <div data-testid="pie-chart">{children}</div>,
  Pie: (props) => {
    mocks.pie(props);
    return <div data-testid="pie">{props.children}</div>;
  },
  Cell: (props) => <span data-testid="cell" data-fill={props.fill} />,
  Tooltip: () => null,
  Legend: () => <div data-testid="legend" />,
}));

import ParticipationChart from './ParticipationChart';

describe('ParticipationChart', () => {
  beforeEach(() => {
    mocks.pie.mockClear();
  });

  it('shows a fallback message when there are no entrants', () => {
    render(<ParticipationChart totalEntrants={0} completedSubmissions={0} />);
    expect(screen.getByText('No participation data available')).toBeInTheDocument();
  });

  it('shows the fallback message when totalEntrants is not provided', () => {
    render(<ParticipationChart completedSubmissions={0} />);
    expect(screen.getByText('No participation data available')).toBeInTheDocument();
  });

  it('renders total, completed and completion-rate stats', () => {
    render(<ParticipationChart totalEntrants={10} completedSubmissions={7} />);

    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('70.0%')).toBeInTheDocument();
    expect(screen.getByText('Total Entrants')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('Completion Rate')).toBeInTheDocument();
  });

  it('passes the completed/incomplete split to the pie with the expected colors', () => {
    render(<ParticipationChart totalEntrants={10} completedSubmissions={7} />);

    const pieProps = mocks.pie.mock.calls.at(-1)[0];
    expect(pieProps.data).toEqual([
      { name: 'Completed', value: 7, color: '#10b981' },
      { name: 'Incomplete', value: 3, color: '#e5e7eb' },
    ]);

    const fills = screen.getAllByTestId('cell').map((cell) => cell.dataset.fill);
    expect(fills).toEqual(['#10b981', '#e5e7eb']);
  });

  it('formats the pie label as "<name> <percent>%"', () => {
    render(<ParticipationChart totalEntrants={10} completedSubmissions={7} />);

    const { label } = mocks.pie.mock.calls.at(-1)[0];
    expect(label({ name: 'Completed', percent: 0.7 })).toBe('Completed 70%');
    expect(label({ name: 'Incomplete', percent: 0.3 })).toBe('Incomplete 30%');
  });

  it('rounds a non-whole completion rate to one decimal place', () => {
    render(<ParticipationChart totalEntrants={3} completedSubmissions={1} />);
    // 1 / 3 * 100 = 33.333... -> toFixed(1) = "33.3"
    expect(screen.getByText('33.3%')).toBeInTheDocument();
  });

  it('treats every non-completed entrant as incomplete, including zero completions', () => {
    render(<ParticipationChart totalEntrants={5} completedSubmissions={0} />);

    const pieProps = mocks.pie.mock.calls.at(-1)[0];
    expect(pieProps.data).toEqual([
      { name: 'Completed', value: 0, color: '#10b981' },
      { name: 'Incomplete', value: 5, color: '#e5e7eb' },
    ]);
    expect(screen.getByText('0.0%')).toBeInTheDocument();
  });
});
