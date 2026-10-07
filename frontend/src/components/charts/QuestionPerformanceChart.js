'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts';

/**
 * Question performance chart component
 * Displays average scores per question with difficulty indicators
 */
export default function QuestionPerformanceChart({ questions }) {
  if (!questions || questions.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        No question data available
      </div>
    );
  }

  // Prepare data for chart
  const chartData = questions.map((q) => ({
    number: `Q${q.number}`,
    averageScore: q.averageScore || 0,
    maxMarks: q.maxMarks,
    difficulty: q.difficulty,
    percentage: q.maxMarks > 0 ? ((q.averageScore || 0) / q.maxMarks) * 100 : 0,
  }));

  // Color based on performance (red < 40%, yellow 40-70%, green > 70%)
  const getColor = (percentage) => {
    if (percentage >= 70) return '#10b981'; // green
    if (percentage >= 40) return '#f59e0b'; // yellow
    return '#ef4444'; // red
  };

  return (
    <div className="w-full">
      <h3 className="text-lg font-semibold mb-4 text-gray-900">Question Performance</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="number"
            stroke="#6b7280"
            style={{ fontSize: '12px' }}
            label={{ value: 'Question', position: 'insideBottom', offset: -5 }}
          />
          <YAxis
            stroke="#6b7280"
            style={{ fontSize: '12px' }}
            label={{ value: 'Average Score', angle: -90, position: 'insideLeft' }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '12px',
            }}
            formatter={(value, name, props) => [
              `${value.toFixed(1)} / ${props.payload.maxMarks} (${props.payload.percentage.toFixed(1)}%)`,
              'Average Score',
            ]}
            labelFormatter={(label) => `${label}`}
          />
          <Bar dataKey="averageScore" radius={[8, 8, 0, 0]}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getColor(entry.percentage)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-4 flex justify-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: '#10b981' }}></div>
          <span className="text-gray-600">Easy (≥70%)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: '#f59e0b' }}></div>
          <span className="text-gray-600">Medium (40-70%)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: '#ef4444' }}></div>
          <span className="text-gray-600">Hard (&lt;40%)</span>
        </div>
      </div>
    </div>
  );
}
