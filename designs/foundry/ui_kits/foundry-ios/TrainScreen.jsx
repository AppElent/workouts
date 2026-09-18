const { AppText, Chip, Eyebrow, SportIcon, PrimaryButton, GhostButton, TextAction, SwipeableRow, InsetList, InsetRow } = window.FoundryDesignSystem_397633;

const FILTERS = ["All", "Strength", "Running", "Cycling", "WOD"];

function RoutineCard({ routine, onStart, onEdit, onDelete }) {
  const [open, setOpen] = React.useState(false);
  return (
    <SwipeableRow
      menuTitle={routine.name}
      open={open}
      onToggle={() => setOpen(!open)}
      actions={[{ key: "edit", label: "Edit", onPress: onEdit }, { key: "delete", label: "Delete", destructive: true, onPress: onDelete }]}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <SportIcon sport="strength" size={40} />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
            <AppText style={{ fontSize: 14, fontWeight: 700 }}>{routine.name}</AppText>
            <AppText style={{ fontSize: 11, color: "var(--text-muted)" }}>{routine.exercises.length} exercises</AppText>
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {routine.exercises.slice(0, 3).map((e) => <Chip key={e.name} label={e.name + " " + e.sets + "×" + e.reps} />)}
          {routine.exercises.length > 3 ? <Chip label={"+" + (routine.exercises.length - 3) + " more"} /> : null}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <PrimaryButton label="Start" onClick={onStart} fullWidth={false} style={{ flex: 1, padding: "12px 16px", fontSize: 13 }} />
          <GhostButton label="Edit" onClick={onEdit} />
          <GhostButton label="Delete" tone="destructive" onClick={onDelete} />
        </div>
      </div>
    </SwipeableRow>
  );
}

function LibraryRow({ sport, title, subtitle, onPress }) {
  return (
    <button type="button" onClick={onPress}
      style={{ display: "flex", alignItems: "center", gap: 12, background: "var(--surface)", borderRadius: 14, border: "none", padding: 12, cursor: "pointer", textAlign: "left" }}>
      <SportIcon sport={sport} size={40} />
      <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
        <AppText style={{ fontSize: 14, fontWeight: 700 }}>{title}</AppText>
        <AppText style={{ fontSize: 11, color: "var(--text-muted)" }}>{subtitle}</AppText>
      </span>
      <span style={{ fontSize: 18, color: "var(--text-faint)", fontFamily: "var(--font-system)" }}>›</span>
    </button>
  );
}

function TrainScreen({ onStart, onOpenExercises, onDeleteRoutine }) {
  const data = window.FOUNDRY_DATA;
  const [filter, setFilter] = React.useState("All");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "12px 20px 24px" }}>
      <div style={{ display: "flex", gap: 7, overflowX: "auto" }}>
        {FILTERS.map((x) => <Chip key={x} label={x} active={x === filter} onClick={() => setFilter(x)} />)}
      </div>
      <PrimaryButton label="Start activity" size="md" onClick={onStart} style={{ padding: "15px 24px" }} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Eyebrow>Routines</Eyebrow>
        <TextAction label="New" style={{ minHeight: 0, padding: 0, fontSize: 13, fontWeight: 800 }} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {data.routines.map((r) => (
          <RoutineCard key={r.id} routine={r} onStart={onStart} onEdit={() => {}} onDelete={() => onDeleteRoutine(r)} />
        ))}
      </div>
      <InsetList header="Library">
        <InsetRow leading={<SportIcon sport="strength" size={30} />} title="Exercises" secondary={data.exercises.length + " exercises"} chevron onPress={onOpenExercises} />
        <InsetRow leading={<SportIcon sport="wod" size={30} />} title="WODs" secondary="Benchmarks and your own, with scores" chevron onPress={() => {}} />
        <InsetRow leading={<SportIcon sport="wod" size={30} />} title="Hosted workouts" secondary="Join with a code, or run one" chevron onPress={() => {}} />
      </InsetList>
    </div>
  );
}

Object.assign(window, { TrainScreen, RoutineCard, LibraryRow });
