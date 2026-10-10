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
  ReferenceLine: () => null,
  Tooltip: (props) => {
    mocks.tooltip(props);
    return null;
  },
}));

import QuestionPerformanceChart from './QuestionPerformanceChart';

describe('QuestionPerformanceChart', () => {
  beforeEach(() => {
    mocks.barChart.mockClear();
    mocks.tooltip.mockClear();
  });

  const questions = [
    { id: 'q1', number: 1, maxMarks: 10, averageScore: 8, difficulty: 0.8 }, // 80% -> green
    { id: 'q2', number: 2, maxMarks: 10, averageScore: 5, difficulty: 0.5 }, // 50% -> yellow
    { id: 'q3', number: 3, maxMarks: 10, averageScore: 3, difficulty: 0.3 }, // 30% -> red
  ];

  it('shows a fallback message when there are no questions', () => {
    render(<QuestionPerformanceChart questions={[]} />);
    expect(screen.getByText('No question data available')).toBeInTheDocument();
  });

  it('shows the fallback message when questions is not provided', () => {
    render(<QuestionPerformanceChart />);
    expect(screen.getByText('No question data available')).toBeInTheDocument();
  });

  it('maps each question to a "Q<number>" label and percentage', () => {
    render(<QuestionPerformanceChart questions={questions} />);

    const barChartProps = mocks.barChart.mock.calls.at(-1)[0];
    expect(barChartProps.data).toEqual([
      { number: 'Q1', averageScore: 8, maxMarks: 10, difficulty: 0.8, percentage: 80 },
      { number: 'Q2', averageScore: 5, maxMarks: 10, difficulty: 0.5, percentage: 50 },
      { number: 'Q3', averageScore: 3, maxMarks: 10, difficulty: 0.3, percentage: 30 },
    ]);
  });

  it('defaults a missing averageScore to 0', () => {
    render(
      <QuestionPerformanceChart
        questions={[{ id: 'q1', number: 1, maxMarks: 10, difficulty: 0.5 }]}
      />
    );

    const barChartProps = mocks.barChart.mock.calls.at(-1)[0];
    expect(barChartProps.data[0]).toMatchObject({ averageScore: 0, percentage: 0 });
  });

  it('guards against dividing by a zero (or missing) maxMarks', () => {
    render(
      <QuestionPerformanceChart
        questions={[{ id: 'q1', number: 1, maxMarks: 0, averageScore: 5, difficulty: 0.5 }]}
      />
    );

    const barChartProps = mocks.barChart.mock.calls.at(-1)[0];
    expect(barChartProps.data[0].percentage).toBe(0);
  });

  it('colors bars green at >=70%, yellow at 40-70%, and red below 40%', () => {
    render(<QuestionPerformanceChart questions={questions} />);

    const fills = screen.getAllByTestId('cell').map((cell) => cell.dataset.fill);
    expect(fills).toEqual(['#10b981', '#f59e0b', '#ef4444']);
  });

  it('treats the 70% and 40% boundaries as inclusive', () => {
    render(
      <QuestionPerformanceChart
        questions={[
          { id: 'q1', number: 1, maxMarks: 10, averageScore: 7, difficulty: 0.7 }, // exactly 70%
          { id: 'q2', number: 2, maxMarks: 10, averageScore: 4, difficulty: 0.4 }, // exactly 40%
        ]}
      />
    );

    const fills = screen.getAllByTestId('cell').map((cell) => cell.dataset.fill);
    expect(fills).toEqual(['#10b981', '#f59e0b']);
  });

  it('renders the difficulty legend', () => {
    render(<QuestionPerformanceChart questions={questions} />);

    expect(screen.getByText('Easy (≥70%)')).toBeInTheDocument();
    expect(screen.getByText('Medium (40-70%)')).toBeInTheDocument();
    expect(screen.getByText('Hard (<40%)')).toBeInTheDocument();
  });

  it('formats the tooltip as "<score> / <max> (<percentage>%)"', () => {
    render(<QuestionPerformanceChart questions={questions} />);

    const { formatter } = mocks.tooltip.mock.calls.at(-1)[0];
    const [text, label] = formatter(8, 'averageScore', {
      payload: { maxMarks: 10, percentage: 80 },
    });
    expect(text).toBe('8.0 / 10 (80.0%)');
    expect(label).toBe('Average Score');
  });
});
