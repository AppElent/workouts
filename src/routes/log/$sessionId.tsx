import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useQuery, useMutation } from 'convex/react';
import { useState } from 'react';
import { api } from '@convex/_generated/api';
import type { Id } from '@convex/_generated/dataModel';
import { format } from 'date-fns';
import { Plus, CheckCircle, XCircle } from 'lucide-react';
import { AddExerciseModal } from '#/components/session/AddExerciseModal';
import { ExerciseSection } from '#/components/session/ExerciseSection';
import { SignedIn, SignedOut, RedirectToSignIn } from '@clerk/clerk-react';

export const Route = createFileRoute('/log/$sessionId')({
  component: ActiveSessionPageGuarded,
});

function ActiveSessionPageGuarded() {
  return (
    <>
      <SignedIn>
        <ActiveSessionPage />
      </SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  );
}

function ActiveSessionPage() {
  const { sessionId } = Route.useParams();
  const navigate = useNavigate();

  const session = useQuery(api.workoutSessions.getById, {
    id: sessionId as Id<'workoutSessions'>,
  });
  const sets = useQuery(api.sets.listForSession, {
    sessionId: sessionId as Id<'workoutSessions'>,
  }) ?? [];

  const finishSession = useMutation(api.workoutSessions.finish);
  const cancelSession = useMutation(api.workoutSessions.cancel);

  const [showAddExercise, setShowAddExercise] = useState(false);
  const [exerciseOrder, setExerciseOrder] = useState<Id<'exercises'>[]>([]);

  const exerciseIds: Id<'exercises'>[] = [];
  for (const set of sets) {
    if (!exerciseIds.includes(set.exerciseId)) {
      exerciseIds.push(set.exerciseId);
    }
  }
  for (const id of exerciseOrder) {
    if (!exerciseIds.includes(id)) exerciseIds.push(id);
  }

  const exercises = useQuery(api.exercises.list) ?? [];
  const exerciseMap = new Map(exercises.map((ex) => [ex._id as string, ex]));

  function handleExerciseSelect(exerciseId: Id<'exercises'>) {
    setExerciseOrder((prev) => [...prev, exerciseId]);
    setShowAddExercise(false);
  }

  async function handleFinish() {
    await finishSession({ id: sessionId as Id<'workoutSessions'> });
    void navigate({ to: '/dashboard' });
  }

  async function handleCancel() {
    if (!confirm('Cancel this workout? All logged sets will be kept.')) return;
    await cancelSession({ id: sessionId as Id<'workoutSessions'> });
    void navigate({ to: '/log' });
  }

  if (session === undefined) {
    return <div className="p-6 text-[var(--text-muted)] text-sm">Loading…</div>;
  }
  if (session === null) {
    return <div className="p-6 text-red-400 text-sm">Session not found.</div>;
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">
          {session.name ?? `Session ${format(new Date(session.startTime), 'MMM d')}`}
        </h1>
        <p className="text-xs text-[var(--text-muted)] mt-1">
          Started {format(new Date(session.startTime), 'h:mm a · MMM d')}
        </p>
        <div className="flex items-center gap-2 mt-4">
          <button
            type="button"
            onClick={() => void handleFinish()}
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-[var(--accent)] text-black text-sm font-bold hover:bg-[var(--accent-hover)] transition-colors"
          >
            <CheckCircle size={15} />
            Finish Workout
          </button>
          <button
            type="button"
            onClick={() => void handleCancel()}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg border border-[var(--border)] text-[var(--text-muted)] text-sm hover:text-red-400 hover:border-red-400/30 transition-colors"
          >
            <XCircle size={15} />
            Cancel
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-4 mb-6">
        {exerciseIds.map((exerciseId) => {
          const exercise = exerciseMap.get(exerciseId as string);
          if (!exercise) return null;
          const exerciseSets = sets.filter((s) => s.exerciseId === exerciseId);
          return (
            <ExerciseSection
              key={exerciseId}
              exerciseId={exerciseId}
              exerciseName={exercise.name}
              sessionId={sessionId as Id<'workoutSessions'>}
              sets={exerciseSets}
            />
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => setShowAddExercise(true)}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-[var(--border)] text-[var(--text-muted)] text-sm hover:border-[var(--accent)]/40 hover:text-[var(--accent)] transition-colors"
      >
        <Plus size={16} />
        Add Exercise
      </button>

      {showAddExercise && (
        <AddExerciseModal
          onSelect={handleExerciseSelect}
          onClose={() => setShowAddExercise(false)}
        />
      )}
    </div>
  );
}
