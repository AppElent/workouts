import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery, useMutation } from 'convex/react';
import { useState, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { api } from '@convex/_generated/api';
import type { Doc } from '@convex/_generated/dataModel';
import { Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { AddExerciseForm } from '#/components/exercises/AddExerciseForm';
import { SignedIn, SignedOut, RedirectToSignIn } from '@clerk/clerk-react';

const MUSCLE_GROUPS = [
  'chest', 'back', 'lats', 'traps', 'quads', 'hamstrings', 'glutes', 'calves',
  'biceps', 'triceps', 'shoulders', 'front delts', 'side delts', 'rear delts',
  'core', 'forearms', 'full body',
];
const CATEGORIES = ['compound', 'isolation'] as const;
const EQUIPMENT = [
  'barbell', 'dumbbell', 'cable', 'bodyweight', 'machine', 'kettlebell', 'band', 'other',
] as const;

export const Route = createFileRoute('/exercises/')({
  component: ExercisesPageGuarded,
});

function ExercisesPageGuarded() {
  return (
    <>
      <SignedIn>
        <ExercisesPage />
      </SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  );
}

function ExercisesPage() {
  const exercises = useQuery(api.exercises.list) ?? [];
  const removeExercise = useMutation(api.exercises.remove);

  const [search, setSearch] = useState('');
  const [filterMuscle, setFilterMuscle] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterEquipment, setFilterEquipment] = useState('');
  const [sorting, setSorting] = useState<SortingState>([{ id: 'name', desc: false }]);

  const filtered = useMemo(() => {
    return exercises.filter((ex) => {
      if (search && !ex.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterMuscle && !ex.muscleGroups.includes(filterMuscle)) return false;
      if (filterCategory && ex.category !== filterCategory) return false;
      if (filterEquipment && ex.equipment !== filterEquipment) return false;
      return true;
    });
  }, [exercises, search, filterMuscle, filterCategory, filterEquipment]);

  const columns: ColumnDef<Doc<'exercises'>>[] = [
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => (
        <Link
          to="/exercises/$id"
          params={{ id: row.original._id }}
          className="text-white hover:text-[var(--accent)] font-medium transition-colors"
        >
          {row.original.name}
        </Link>
      ),
    },
    {
      accessorKey: 'muscleGroups',
      header: 'Muscle Groups',
      cell: ({ row }) => (
        <span className="text-[var(--text-muted)] text-xs capitalize">
          {row.original.muscleGroups.join(', ')}
        </span>
      ),
      enableSorting: false,
    },
    {
      accessorKey: 'category',
      header: 'Category',
      cell: ({ row }) => (
        <span className="capitalize text-sm text-[var(--text-muted)]">
          {row.original.category}
        </span>
      ),
    },
    {
      accessorKey: 'equipment',
      header: 'Equipment',
      cell: ({ row }) => (
        <span className="capitalize text-sm text-[var(--text-muted)]">
          {row.original.equipment}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        if (row.original.isDefault) return null;
        return (
          <button
            type="button"
            onClick={() => void removeExercise({ id: row.original._id })}
            className="p-1.5 text-[var(--text-muted)] hover:text-red-400 transition-colors"
            aria-label={`Delete ${row.original.name}`}
          >
            <Trash2 size={14} />
          </button>
        );
      },
      enableSorting: false,
    },
  ];

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">Exercise Library</h1>

      <div className="flex flex-wrap gap-2 mb-4">
        <input
          type="search"
          placeholder="Search exercises…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)] min-w-[180px]"
        />
        <select
          value={filterMuscle}
          onChange={(e) => setFilterMuscle(e.target.value)}
          className="h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
        >
          <option value="">All muscle groups</option>
          {MUSCLE_GROUPS.map((mg) => (
            <option key={mg} value={mg} className="capitalize">
              {mg}
            </option>
          ))}
        </select>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
        >
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c} className="capitalize">
              {c}
            </option>
          ))}
        </select>
        <select
          value={filterEquipment}
          onChange={(e) => setFilterEquipment(e.target.value)}
          className="h-9 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
        >
          <option value="">All equipment</option>
          {EQUIPMENT.map((eq) => (
            <option key={eq} value={eq} className="capitalize">
              {eq}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-xl border border-[var(--border)] overflow-hidden mb-8">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[var(--surface)]">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="text-left px-4 py-3 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider whitespace-nowrap"
                      style={{ cursor: header.column.getCanSort() ? 'pointer' : 'default' }}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <div className="flex items-center gap-1">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getIsSorted() === 'asc' && <ChevronUp size={12} />}
                        {header.column.getIsSorted() === 'desc' && <ChevronDown size={12} />}
                      </div>
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="bg-[var(--bg)] hover:bg-white/[0.02] transition-colors"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
              {table.getRowModel().rows.length === 0 && (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-4 py-8 text-center text-sm text-[var(--text-muted)]"
                  >
                    No exercises match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-[var(--text-muted)] mb-4">
        Showing {filtered.length} of {exercises.length} exercises
      </p>

      <AddExerciseForm />
    </div>
  );
}
