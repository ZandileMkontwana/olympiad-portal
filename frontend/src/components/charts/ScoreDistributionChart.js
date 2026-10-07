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
} from 'recharts';

/**
 * Score distribution chart component
 * Displays a histogram of score ranges with counts
 */
export default function ScoreDistributionChart({ data, maxScore }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        No score data available
      </div>
    );
  }

  // Color gradient from red (low) to green (high)
  const getColor = (index, total) => {
    const hue = (index / total) * 120; // 0 = red, 120 = green
    return `hsl(${hue}, 70%, 50%)`;
  };

  return (
    <div className="w-full">
      <h3 className="text-lg font-semibold mb-4 text-gray-900">Score Distribution</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="range"
            stroke="#6b7280"
            style={{ fontSize: '12px' }}
            label={{ value: 'Score Range', position: 'insideBottom', offset: -5 }}
          />
          <YAxis
            stroke="#6b7280"
            style={{ fontSize: '12px' }}
            label={{ value: 'Number of Students', angle: -90, position: 'insideLeft' }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '12px',
            }}
            formatter={(value, name, props) => [
              `${value} student${value !== 1 ? 's' : ''}`,
              `Score: ${props.payload.range}`,
            ]}
          />
          <Bar dataKey="count" radius={[8, 8, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getColor(index, data.length)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {maxScore && (
        <div className="mt-4 text-sm text-gray-600 text-center">
          Maximum possible score: {maxScore}
        </div>
      )}
    </div>
  );
}
