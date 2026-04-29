import { useMutation } from 'convex/react';
import { useForm } from '@tanstack/react-form';
import { z } from 'zod';
import { api } from '@convex/_generated/api';

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  muscleGroupsRaw: z.string().min(1, 'At least one muscle group required'),
  category: z.enum(['compound', 'isolation']),
  equipment: z.enum([
    'barbell',
    'dumbbell',
    'cable',
    'bodyweight',
    'machine',
    'kettlebell',
    'band',
    'other',
  ]),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const equipmentOptions = [
  'barbell',
  'dumbbell',
  'cable',
  'bodyweight',
  'machine',
  'kettlebell',
  'band',
  'other',
] as const;

export function AddExerciseForm() {
  const createExercise = useMutation(api.exercises.create);

  const form = useForm({
    defaultValues: {
      name: '',
      muscleGroupsRaw: '',
      category: 'compound' as 'compound' | 'isolation',
      equipment: 'barbell' as FormValues['equipment'],
      notes: '',
    },
    onSubmit: async ({ value }) => {
      const parsed = schema.parse(value);
      const muscleGroups = parsed.muscleGroupsRaw
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      await createExercise({
        name: parsed.name,
        muscleGroups,
        category: parsed.category,
        equipment: parsed.equipment,
        notes: parsed.notes || undefined,
      });
      form.reset();
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
      className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-5 flex flex-col gap-4"
    >
      <h2 className="text-sm font-semibold text-white">Add Custom Exercise</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <form.Field name="name">
          {(field) => (
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[var(--text-muted)]">Name</label>
              <input
                className="h-9 rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="e.g. Cable Lateral Raise"
                required
              />
              {field.state.meta.errors.length > 0 && (
                <p className="text-xs text-red-400">{String(field.state.meta.errors[0])}</p>
              )}
            </div>
          )}
        </form.Field>

        <form.Field name="muscleGroupsRaw">
          {(field) => (
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[var(--text-muted)]">
                Muscle Groups (comma-separated)
              </label>
              <input
                className="h-9 rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="e.g. side delts, traps"
                required
              />
            </div>
          )}
        </form.Field>

        <form.Field name="category">
          {(field) => (
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[var(--text-muted)]">Category</label>
              <select
                className="h-9 rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                value={field.state.value}
                onChange={(e) =>
                  field.handleChange(e.target.value as 'compound' | 'isolation')
                }
              >
                <option value="compound">Compound</option>
                <option value="isolation">Isolation</option>
              </select>
            </div>
          )}
        </form.Field>

        <form.Field name="equipment">
          {(field) => (
            <div className="flex flex-col gap-1">
              <label className="text-xs text-[var(--text-muted)]">Equipment</label>
              <select
                className="h-9 rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                value={field.state.value}
                onChange={(e) =>
                  field.handleChange(e.target.value as FormValues['equipment'])
                }
              >
                {equipmentOptions.map((eq) => (
                  <option key={eq} value={eq} className="capitalize">
                    {eq.charAt(0).toUpperCase() + eq.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          )}
        </form.Field>

        <form.Field name="notes">
          {(field) => (
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label className="text-xs text-[var(--text-muted)]">Notes (optional)</label>
              <input
                className="h-9 rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                placeholder="Form cues, tips..."
              />
            </div>
          )}
        </form.Field>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          className="px-5 py-2 rounded-full bg-[var(--accent)] text-black text-sm font-bold hover:bg-[var(--accent-hover)] transition-colors"
        >
          Add Exercise
        </button>
      </div>
    </form>
  );
}
