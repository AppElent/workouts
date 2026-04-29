import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from 'convex/react';
import { api } from '@convex/_generated/api';
import { RoutineCard } from '#/components/routines/RoutineCard';
import { CreateRoutineForm } from '#/components/routines/CreateRoutineForm';
import { SignedIn, RedirectToSignIn } from '@clerk/clerk-react';

export const Route = createFileRoute('/routines/')({
  component: RoutinesPageGuarded,
});

function RoutinesPageGuarded() {
  return (
    <>
      <SignedIn>
        <RoutinesPage />
      </SignedIn>
      <RedirectToSignIn />
    </>
  );
}

function RoutinesPage() {
  const routines = useQuery(api.routines.list) ?? [];

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">Routines</h1>

      {routines.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {routines.map((routine) => (
            <RoutineCard key={routine._id} routine={routine} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-8 text-center mb-8">
          <p className="text-[var(--text-muted)] text-sm">
            No routines yet. Create your first template below.
          </p>
        </div>
      )}

      <CreateRoutineForm />
    </div>
  );
}
