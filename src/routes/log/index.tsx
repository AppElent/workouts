import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useQuery, useMutation } from 'convex/react';
import { useState } from 'react';
import { api } from '@convex/_generated/api';
import { format } from 'date-fns';
import { Dumbbell, Play, Clock } from 'lucide-react';
import { SignedIn, RedirectToSignIn } from '@clerk/clerk-react';

export const Route = createFileRoute('/log/')({
  component: LogPageGuarded,
});

function LogPageGuarded() {
  return (
    <>
      <SignedIn>
        <LogPage />
      </SignedIn>
      <RedirectToSignIn />
    </>
  );
}

function LogPage() {
  const navigate = useNavigate();
  const activeSession = useQuery(api.workoutSessions.getActive);
  const routines = useQuery(api.routines.list) ?? [];
  const createSession = useMutation(api.workoutSessions.create);

  const [sessionName, setSessionName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  async function handleStartFreeForm(e: React.FormEvent) {
    e.preventDefault();
    if (creating) return;
    setCreating(true);
    setError('');
    try {
      const sessionId = await createSession({ name: sessionName.trim() || undefined });
      void navigate({ to: '/log/$sessionId', params: { sessionId } });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start session');
      setCreating(false);
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">Log Workout</h1>

      {activeSession && (
        <div className="mb-6 rounded-xl bg-[var(--accent-dim)] border border-[var(--accent)]/20 p-4 flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Clock size={14} className="text-[var(--accent)]" />
              <p className="text-sm font-semibold text-[var(--accent)]">
                Session in progress
              </p>
            </div>
            <p className="text-xs text-[var(--text-muted)]">
              {activeSession.name ?? 'Untitled session'} · started{' '}
              {format(new Date(activeSession.startTime), 'h:mm a')}
            </p>
          </div>
          <Link
            to="/log/$sessionId"
            params={{ sessionId: activeSession._id }}
            className="shrink-0 px-4 py-2 rounded-lg bg-[var(--accent)] text-black text-sm font-bold hover:bg-[var(--accent-hover)] transition-colors"
          >
            Resume →
          </Link>
        </div>
      )}

      {!activeSession && (
        <form
          onSubmit={(e) => void handleStartFreeForm(e)}
          className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-5 mb-6"
        >
          <h2 className="text-sm font-semibold text-white mb-4">Start New Session</h2>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Session name (optional)"
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              className="flex-1 h-10 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            />
            <button
              type="submit"
              disabled={creating}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-[var(--accent)] text-black text-sm font-bold disabled:opacity-50 hover:bg-[var(--accent-hover)] transition-colors"
            >
              <Dumbbell size={15} />
              {creating ? 'Starting…' : 'Start'}
            </button>
          </div>
          {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
        </form>
      )}

      {!activeSession && routines.length > 0 && (
        <div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-5">
          <h2 className="text-sm font-semibold text-white mb-4">Start from Routine</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {routines.map((routine) => (
              <StartFromRoutineButton key={routine._id} routine={routine} />
            ))}
          </div>
        </div>
      )}

      {!activeSession && routines.length === 0 && (
        <div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-5 text-center">
          <p className="text-[var(--text-muted)] text-sm mb-3">
            No routines yet.
          </p>
          <Link
            to="/routines"
            className="text-sm text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors"
          >
            Create a routine →
          </Link>
        </div>
      )}
    </div>
  );
}

function StartFromRoutineButton({
  routine,
}: {
  routine: { _id: string; name: string; exercises: unknown[] };
}) {
  const navigate = useNavigate();
  const startSession = useMutation(api.routines.startSession);
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (loading) return;
    setLoading(true);
    try {
      const sessionId = await startSession({ routineId: routine._id as any });
      void navigate({ to: '/log/$sessionId', params: { sessionId } });
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      disabled={loading}
      className="flex items-center justify-between gap-2 p-4 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] hover:border-[var(--accent)]/30 transition-colors text-left disabled:opacity-50"
    >
      <div>
        <p className="text-sm font-medium text-white">{routine.name}</p>
        <p className="text-xs text-[var(--text-muted)] mt-0.5">
          {(routine.exercises as unknown[]).length} exercises
        </p>
      </div>
      <Play size={16} className="text-[var(--accent)] shrink-0" />
    </button>
  );
}
