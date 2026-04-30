import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from 'convex/react';
import { useState } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { format } from 'date-fns';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { SignedIn, SignedOut, RedirectToSignIn } from '@clerk/clerk-react';

export const Route = createFileRoute('/progress/')({
  component: ProgressPageGuarded,
});

function ProgressPageGuarded() {
  return (
    <>
      <SignedIn>
        <ProgressPage />
      </SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  );
}

function ProgressPage() {
  const exercises = useQuery(api.exercises.list) ?? [];
  const [selectedId, setSelectedId] = useState<Id<'exercises'> | ''>('');

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">Progress</h1>

      <div className="mb-6">
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value as Id<'exercises'>)}
          className="h-10 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-white min-w-[240px] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
        >
          <option value="">Select an exercise…</option>
          {exercises.map((ex) => (
            <option key={ex._id} value={ex._id}>
              {ex.name}
            </option>
          ))}
        </select>
      </div>

      {selectedId ? (
        <ExerciseCharts exerciseId={selectedId as Id<'exercises'>} />
      ) : (
        <div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-10 text-center">
          <p className="text-[var(--text-muted)] text-sm">
            Select an exercise to view your progress charts.
          </p>
        </div>
      )}
    </div>
  );
}

function ExerciseCharts({ exerciseId }: { exerciseId: Id<'exercises'> }) {
  const ormRecords = useQuery(api.oneRepMaxes.listForExercise, { exerciseId }) ?? [];
  const volumeData = useQuery(api.progress.weeklyVolume, { exerciseId }) ?? [];

  const ormChartData = [...ormRecords]
    .sort((a, b) => a.date - b.date)
    .map((r) => ({
      date: format(new Date(r.date), 'MMM d'),
      value: r.value,
      source: r.source,
    }));

  const tooltipStyle = {
    contentStyle: {
      background: '#1a1a1a',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 8,
      color: '#fff',
      fontSize: 12,
    },
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-5">
        <h2 className="text-sm font-semibold text-white mb-1">1RM Over Time</h2>
        <p className="text-xs text-[var(--text-muted)] mb-4">
          Actual + estimated (Epley) records
        </p>
        {ormChartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={ormChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis
                dataKey="date"
                tick={{ fill: '#b3b3b3', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: '#b3b3b3', fontSize: 11 }}
                unit="kg"
                axisLine={false}
                tickLine={false}
                width={48}
              />
              <Tooltip
                {...tooltipStyle}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={((value: number | undefined, _: string, entry: { payload: { source: string } }) => [
                  `${value ?? ''} kg (${entry.payload.source})`,
                  '1RM',
                ]) as any}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#1DB954"
                strokeWidth={2}
                dot={{ fill: '#1DB954', r: 4, strokeWidth: 0 }}
                activeDot={{ r: 6, fill: '#1ed760' }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-[var(--text-muted)] py-8 text-center">
            No 1RM data yet. Log some sets!
          </p>
        )}
      </div>

      <div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-5">
        <h2 className="text-sm font-semibold text-white mb-1">Weekly Volume</h2>
        <p className="text-xs text-[var(--text-muted)] mb-4">
          Total kg lifted per week (weight × reps)
        </p>
        {volumeData.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={volumeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis
                dataKey="week"
                tick={{ fill: '#b3b3b3', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: '#b3b3b3', fontSize: 11 }}
                unit="kg"
                axisLine={false}
                tickLine={false}
                width={52}
              />
              <Tooltip
                {...tooltipStyle}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={((value: number | undefined) => [`${value ?? ''} kg`, 'Volume']) as any}
              />
              <Bar dataKey="volume" fill="#1DB954" radius={[4, 4, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-[var(--text-muted)] py-8 text-center">
            No volume data yet.
          </p>
        )}
      </div>
    </div>
  );
}
