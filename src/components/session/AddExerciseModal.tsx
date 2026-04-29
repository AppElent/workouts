import { useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { X } from 'lucide-react';

interface Props {
  onSelect: (exerciseId: Id<'exercises'>) => void;
  onClose: () => void;
}

export function AddExerciseModal({ onSelect, onClose }: Props) {
  const exercises = useQuery(api.exercises.list) ?? [];
  const [search, setSearch] = useState('');

  const filtered = exercises.filter((ex) =>
    ex.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 px-4 pb-4 sm:pb-0">
      <div className="w-full max-w-md rounded-xl bg-[var(--surface)] border border-[var(--border)] overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
          <h2 className="text-sm font-semibold text-white">Add Exercise</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-[var(--text-muted)] hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-3 border-b border-[var(--border)]">
          <input
            autoFocus
            type="search"
            placeholder="Search exercises…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
          />
        </div>

        <div className="max-h-72 overflow-y-auto divide-y divide-[var(--border)]">
          {filtered.map((ex) => (
            <button
              key={ex._id}
              type="button"
              onClick={() => onSelect(ex._id)}
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/5 transition-colors"
            >
              <span className="text-sm text-white">{ex.name}</span>
              <span className="text-xs text-[var(--text-muted)] capitalize ml-2">
                {ex.equipment}
              </span>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="px-4 py-6 text-sm text-[var(--text-muted)] text-center">
              No exercises found.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
