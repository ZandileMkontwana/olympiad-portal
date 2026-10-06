import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  barChart: vi.fn(),
  tooltip: vi.fn(),
}));

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }) => <div data-testid="responsive-container">{children}</div>,
  BarChart: (props) => {
    mocks.barChart(props);
    return <div data-testid="bar-chart">{props.children}</div>;
  },
  Bar: (props) => <div data-testid="bar">{props.children}</div>,
  Cell: (props) => <span data-testid="cell" data-fill={props.fill} />,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: (props) => {
    mocks.tooltip(props);
    return null;
  },
}));

import ScoreDistributionChart from './ScoreDistributionChart';

describe('ScoreDistributionChart', () => {
  beforeEach(() => {
    mocks.barChart.mockClear();
    mocks.tooltip.mockClear();
  });

  const sampleData = [
    { range: '0-10', percentage: 0, count: 2 },
    { range: '10-20', percentage: 10, count: 5 },
    { range: '20-30', percentage: 20, count: 1 },
  ];

  it('shows a fallback message when there is no data', () => {
    render(<ScoreDistributionChart data={[]} maxScore={30} />);
    expect(screen.getByText('No score data available')).toBeInTheDocument();
  });

  it('shows the fallback message when data is not provided', () => {
    render(<ScoreDistributionChart maxScore={30} />);
    expect(screen.getByText('No score data available')).toBeInTheDocument();
  });

  it('passes the distribution straight through to the bar chart', () => {
    render(<ScoreDistributionChart data={sampleData} maxScore={30} />);

    const barChartProps = mocks.barChart.mock.calls.at(-1)[0];
    expect(barChartProps.data).toEqual(sampleData);
  });

  it('colors each bar along a red-to-green gradient by index', () => {
    render(<ScoreDistributionChart data={sampleData} maxScore={30} />);

    const fills = screen.getAllByTestId('cell').map((cell) => cell.dataset.fill);
    // getColor(index, total) = hsl((index / total) * 120, 70%, 50%)
    expect(fills).toEqual(['hsl(0, 70%, 50%)', 'hsl(40, 70%, 50%)', 'hsl(80, 70%, 50%)']);
  });

  it('shows the maximum possible score when provided', () => {
    render(<ScoreDistributionChart data={sampleData} maxScore={30} />);
    expect(screen.getByText('Maximum possible score: 30')).toBeInTheDocument();
  });

  it('omits the maximum-score line when maxScore is not provided', () => {
    render(<ScoreDistributionChart data={sampleData} />);
    expect(screen.queryByText(/Maximum possible score/)).not.toBeInTheDocument();
  });

  it('formats the tooltip with a singular/plural student count and the score range', () => {
    render(<ScoreDistributionChart data={sampleData} maxScore={30} />);

    const { formatter } = mocks.tooltip.mock.calls.at(-1)[0];
    expect(formatter(1, 'count', { payload: { range: '0-10' } })).toEqual([
      '1 student',
      'Score: 0-10',
    ]);
    expect(formatter(5, 'count', { payload: { range: '10-20' } })).toEqual([
      '5 students',
      'Score: 10-20',
    ]);
    expect(formatter(0, 'count', { payload: { range: '20-30' } })).toEqual([
      '0 students',
      'Score: 20-30',
    ]);
  });
});
