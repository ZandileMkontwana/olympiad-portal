'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

/**
 * Participation chart component
 * Displays completion rate as a pie chart
 */
export default function ParticipationChart({ totalEntrants, completedSubmissions }) {
  if (!totalEntrants || totalEntrants === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        No participation data available
      </div>
    );
  }

  const incomplete = totalEntrants - completedSubmissions;
  const completionRate = ((completedSubmissions / totalEntrants) * 100).toFixed(1);

  const data = [
    { name: 'Completed', value: completedSubmissions, color: '#10b981' },
    { name: 'Incomplete', value: incomplete, color: '#e5e7eb' },
  ];

  return (
    <div className="w-full">
      <h3 className="text-lg font-semibold mb-4 text-gray-900">Participation Rate</h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={2}
            dataKey="value"
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '12px',
            }}
            formatter={(value, name) => [`${value} students`, name]}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
      <div className="mt-4 grid grid-cols-3 gap-4 text-center">
        <div>
          <div className="text-2xl font-bold text-gray-900">{totalEntrants}</div>
          <div className="text-sm text-gray-600">Total Entrants</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-green-600">{completedSubmissions}</div>
          <div className="text-sm text-gray-600">Completed</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-violet-600">{completionRate}%</div>
          <div className="text-sm text-gray-600">Completion Rate</div>
        </div>
      </div>
    </div>
  );
}
