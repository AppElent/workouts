import { useState } from 'react';
import { useMutation } from 'convex/react';
import { api } from '@convex/_generated/api';
import type { Doc, Id } from '@convex/_generated/dataModel';
import { Plus } from 'lucide-react';
import { SetRow } from './SetRow';
import { SetCard } from './SetCard';

interface Props {
  exerciseId: Id<'exercises'>;
  exerciseName: string;
  sessionId: Id<'workoutSessions'>;
  sets: Doc<'sets'>[];
}

const SET_TYPES = ['warmup', 'working', 'drop', 'failure'] as const;

export function ExerciseSection({ exerciseId, exerciseName, sessionId, sets }: Props) {
  const addSet = useMutation(api.sets.add);

  const [completedSetIds, setCompletedSetIds] = useState<Set<string>>(new Set());
  const [newWeight, setNewWeight] = useState('');
  const [newReps, setNewReps] = useState('');
  const [newRpe, setNewRpe] = useState('');
  const [newSetType, setNewSetType] = useState<'warmup' | 'working' | 'drop' | 'failure'>('working');

  function handleComplete(setId: string) {
    setCompletedSetIds((prev) => new Set([...prev, setId]));
  }

  async function handleAddSet(e: React.FormEvent) {
    e.preventDefault();
    const weight = parseFloat(newWeight);
    const reps = parseInt(newReps, 10);
    if (!weight || !reps) return;

    await addSet({
      sessionId,
      exerciseId,
      setNumber: sets.length + 1,
      reps,
      weight,
      unit: 'kg',
      rpe: newRpe ? parseFloat(newRpe) : undefined,
      setType: newSetType,
    });
    setNewWeight('');
    setNewReps('');
    setNewRpe('');
  }

  return (
    <div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-4 sm:p-5">
      <h3 className="text-base font-semibold text-white mb-4">{exerciseName}</h3>

      {sets.length > 0 && (
        <div className="hidden sm:block mb-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)]">
                {['#', 'Type', 'Weight', 'Reps', 'RPE', 'Est. 1RM', ''].map((h) => (
                  <th
                    key={h}
                    className="text-left pb-2 text-xs text-[var(--text-muted)] font-medium pr-3 first:pl-2 whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sets.map((set) => (
                <SetRow
                  key={set._id}
                  set={set}
                  completed={completedSetIds.has(set._id)}
                  onComplete={handleComplete}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {sets.length > 0 && (
        <div className="flex sm:hidden flex-col gap-2 mb-4">
          {sets.map((set) => (
            <SetCard
              key={set._id}
              set={set}
              completed={completedSetIds.has(set._id)}
              onComplete={handleComplete}
            />
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => void handleAddSet(e)}
        className="flex flex-wrap items-end gap-2"
      >
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-[var(--text-muted)] uppercase">Type</label>
          <select
            value={newSetType}
            onChange={(e) => setNewSetType(e.target.value as typeof newSetType)}
            className="h-8 rounded border border-[var(--border)] bg-[var(--surface-2)] px-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
          >
            {SET_TYPES.map((t) => (
              <option key={t} value={t} className="capitalize">
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-[var(--text-muted)] uppercase">kg</label>
          <input
            type="number"
            min="0"
            step="0.5"
            placeholder="0"
            value={newWeight}
            onChange={(e) => setNewWeight(e.target.value)}
            className="w-16 h-8 rounded border border-[var(--border)] bg-[var(--surface-2)] px-2 text-xs text-white text-center focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            required
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-[var(--text-muted)] uppercase">Reps</label>
          <input
            type="number"
            min="1"
            placeholder="0"
            value={newReps}
            onChange={(e) => setNewReps(e.target.value)}
            className="w-14 h-8 rounded border border-[var(--border)] bg-[var(--surface-2)] px-2 text-xs text-white text-center focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            required
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-[var(--text-muted)] uppercase">RPE</label>
          <input
            type="number"
            min="1"
            max="10"
            step="0.5"
            placeholder="—"
            value={newRpe}
            onChange={(e) => setNewRpe(e.target.value)}
            className="w-14 h-8 rounded border border-[var(--border)] bg-[var(--surface-2)] px-2 text-xs text-white text-center focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
          />
        </div>
        <button
          type="submit"
          className="h-8 flex items-center gap-1 px-3 rounded border border-[var(--accent)]/40 text-[var(--accent)] text-xs font-medium hover:bg-[var(--accent-dim)] transition-colors"
        >
          <Plus size={13} />
          Add set
        </button>
      </form>
    </div>
  );
}
