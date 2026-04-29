import { useMutation } from 'convex/react';
import { api } from '@convex/_generated/api';
import type { Doc } from '@convex/_generated/dataModel';
import { Check, Trash2 } from 'lucide-react';
import { calculateOneRepMax } from '#/lib/oneRepMax';

interface Props {
  set: Doc<'sets'>;
  completed: boolean;
  onComplete: (setId: string) => void;
}

export function SetCard({ set, completed, onComplete }: Props) {
  const removeSet = useMutation(api.sets.remove);
  const orm = calculateOneRepMax(set.weight, set.reps);

  return (
    <div
      className={[
        'rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3 flex items-center justify-between gap-3',
        completed ? 'opacity-60' : '',
      ].join(' ')}
    >
      <div className="flex items-center gap-3">
        <span className="text-xs text-[var(--text-muted)] w-5">#{set.setNumber}</span>
        <span className="text-xs text-[var(--text-muted)] capitalize">{set.setType}</span>
        <span className="text-sm text-white font-medium">
          {set.weight}
          <span className="text-xs text-[var(--text-muted)] ml-0.5">{set.unit}</span>
        </span>
        <span className="text-sm text-white">×{set.reps}</span>
        {set.rpe && (
          <span className="text-xs text-[var(--text-muted)]">RPE {set.rpe}</span>
        )}
        {completed && (
          <span className="text-xs text-[var(--text-muted)]">
            {orm.value}{orm.source === 'calculated' ? ' est.' : ''}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {!completed && (
          <button
            type="button"
            onClick={() => onComplete(set._id)}
            className="w-7 h-7 rounded-full border border-[var(--accent)]/40 flex items-center justify-center text-[var(--accent)] hover:bg-[var(--accent)] hover:text-black transition-colors"
            aria-label="Complete set"
          >
            <Check size={13} />
          </button>
        )}
        {completed && <Check size={14} className="text-[var(--accent)]" />}
        <button
          type="button"
          onClick={() => void removeSet({ id: set._id })}
          className="p-1 text-[var(--text-muted)] hover:text-red-400 transition-colors"
          aria-label="Delete set"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}
