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

export function SetRow({ set, completed, onComplete }: Props) {
  const removeSet = useMutation(api.sets.remove);
  const orm = calculateOneRepMax(set.weight, set.reps);

  return (
    <tr className={['border-b border-[var(--border)] last:border-0 text-sm', completed ? 'opacity-60' : ''].join(' ')}>
      <td className="py-2 pl-2 pr-3 text-[var(--text-muted)] w-8">{set.setNumber}</td>
      <td className="py-2 pr-3 w-24">
        <span className="text-xs capitalize text-[var(--text-muted)]">{set.setType}</span>
      </td>
      <td className="py-2 pr-3 w-24">
        <span className="text-white font-medium">{set.weight}</span>
        <span className="text-xs text-[var(--text-muted)] ml-0.5">{set.unit}</span>
      </td>
      <td className="py-2 pr-3 w-16">
        <span className="text-white">{set.reps}</span>
      </td>
      <td className="py-2 pr-3 w-16">
        <span className="text-[var(--text-muted)]">{set.rpe ?? '—'}</span>
      </td>
      <td className="py-2 pr-3 w-24">
        {completed ? (
          <span className="text-xs text-[var(--text-muted)]">
            {orm.value} {orm.source === 'calculated' ? 'est.' : 'actual'}
          </span>
        ) : null}
      </td>
      <td className="py-2 pr-2 w-16">
        <div className="flex items-center gap-2 justify-end">
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
          {completed && (
            <Check size={14} className="text-[var(--accent)]" />
          )}
          <button
            type="button"
            onClick={() => void removeSet({ id: set._id })}
            className="p-1 text-[var(--text-muted)] hover:text-red-400 transition-colors"
            aria-label="Delete set"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </td>
    </tr>
  );
}
