const { AppText, Chip, StepperField, PrimaryButton, GhostButton, Sheet, SwipeableRow, Eyebrow, TextAction } = window.FoundryDesignSystem_397633;

const SET_TYPES = ["warmup", "working", "drop", "failure"];

function SetTable({ sets, onEdit }) {
  const th = { fontFamily: "var(--font-system)", fontSize: 9, fontWeight: 800, letterSpacing: 0.5, textTransform: "uppercase", color: "var(--text-faint)" };
  const td = { fontFamily: "var(--font-system)", fontSize: 12, fontWeight: 800, color: "var(--text)", fontVariantNumeric: "tabular-nums" };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <div style={{ display: "flex", gap: 6, padding: "0 2px 4px" }}>
        <span style={{ ...th, width: 26 }}>Set</span>
        <span style={{ ...th, flex: 1 }}>Type</span>
        <span style={{ ...th, width: 60, textAlign: "center" }}>kg</span>
        <span style={{ ...th, width: 44, textAlign: "center" }}>Reps</span>
      </div>
      {sets.length === 0 ? (
        <AppText variant="caption">Nothing logged yet.</AppText>
      ) : sets.map((s) => (
        <SwipeableRow key={s.n} menuTitle={"Set " + s.n} actions={[{ key: "edit", label: "Edit set", onPress: () => onEdit(s) }]} style={{ borderRadius: 0 }}>
          <button type="button" onClick={() => onEdit(s)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 6, height: 34, border: "none", background: "transparent", cursor: "pointer" }}>
            <span style={{ ...td, width: 26, textAlign: "left" }}>{s.n}</span>
            <span style={{ fontFamily: "var(--font-system)", fontSize: 12, color: "var(--text-muted)", flex: 1, textAlign: "left" }}>{s.type}</span>
            <span style={{ ...td, width: 60, textAlign: "center" }}>{s.weight}</span>
            <span style={{ ...td, width: 44, textAlign: "center" }}>{s.reps}</span>
          </button>
        </SwipeableRow>
      ))}
    </div>
  );
}

function SessionScreen({ onCancelRequest }) {
  const [sets, setSets] = React.useState(window.FOUNDRY_DATA.sets);
  const [weight, setWeight] = React.useState(60);
  const [reps, setReps] = React.useState(8);
  const [type, setType] = React.useState("working");
  const [editing, setEditing] = React.useState(null);
  const [plates, setPlates] = React.useState(false);
  const rest = window.useRestTimerMock();

  const log = () => {
    setSets((prev) => [...prev, { n: prev.length + 1, type, weight, reps }]);
    if (type !== "warmup") rest.start();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "12px 20px 40px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ width: 6, height: 6, borderRadius: 9999, background: "var(--accent)" }} />
        <AppText style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>12:04</AppText>
      </div>

      <div style={{ display: "flex", gap: 6, overflowX: "auto" }}>
        <Chip label="Bench press" active />
        <Chip label="Incline DB press" />
        <Chip label="Lateral raise" />
      </div>

      <GhostButton label="+ Add exercise" fullWidth />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <AppText style={{ fontSize: 17, fontWeight: 800 }}>Bench press</AppText>
        <AppText style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)" }}>{sets.length} sets</AppText>
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <Chip label="Last: 60 × 8" />
        <Chip label="Plates" onClick={() => setPlates(true)} />
      </div>

      <SetTable sets={sets} onEdit={setEditing} />

      <div style={{ display: "flex", gap: 6 }}>
        {SET_TYPES.map((t) => <span key={t} style={{ flex: 1, display: "flex" }}><Chip label={t} active={t === type} onClick={() => setType(t)} style={{ flex: 1 }} /></span>)}
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
        <StepperField label="kg" value={weight} step={2.5} height={56} onChange={setWeight} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14 }} />
        <StepperField label="reps" value={reps} step={1} min={1} height={56} onChange={setReps} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14 }} />
      </div>

      <PrimaryButton label={"Log set " + (sets.length + 1)} onClick={log} />
      <div style={{ display: "flex", justifyContent: "center", marginTop: 8 }}>
        <TextAction label="Cancel workout" tone="destructive" onClick={onCancelRequest} />
      </div>

      {plates ? (
        <Sheet title={weight + " kg"} doneLabel="Done" onDone={() => setPlates(false)} detent="medium">
          <Eyebrow>Per side</Eyebrow>
          <div style={{ display: "flex", gap: 3, alignItems: "center", padding: "8px 0" }}>
            {[20, 20].map((p, i) => (
              <span key={i} style={{ width: 26, height: Math.max(18, Math.min(56, 18 + p * 1.5)), borderRadius: "var(--r-xs)", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-system)", fontSize: 9, fontWeight: 800, color: "var(--on-accent)" }}>{p}</span>
            ))}
          </div>
          <AppText variant="caption">20 + 20 per side, plus the 20 kg bar.</AppText>
          <Eyebrow>Warm-up</Eyebrow>
          {[[20, 8, "empty bar"], [40, 5, "60%"], [50, 3, "80%"]].map(([w, r, p]) => (
            <div key={w} style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--surface-2)", borderRadius: "var(--r-md)", padding: 8 }}>
              <AppText style={{ fontWeight: 800, width: 72 }}>{w} kg</AppText>
              <AppText variant="caption" style={{ flex: 1 }}>× {r}</AppText>
              <AppText variant="caption">{p}</AppText>
            </div>
          ))}
        </Sheet>
      ) : null}

      {editing ? (
        <Sheet title={"Set " + editing.n} subtitle="Bench press" doneLabel="Close" onDone={() => setEditing(null)} detent="large">
          <div style={{ display: "flex", gap: 6 }}>
            {SET_TYPES.map((t) => <span key={t} style={{ flex: 1, display: "flex" }}><Chip label={t} active={t === editing.type} style={{ flex: 1 }} /></span>)}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <StepperField label="kg" value={editing.weight} step={2.5} height={56} />
            <StepperField label="reps" value={editing.reps} step={1} height={56} />
          </div>
          <PrimaryButton label="No changes" disabled />
          <div style={{ display: "flex", gap: 8 }}>
            <GhostButton label="Duplicate" fullWidth style={{ flex: 1 }} />
            <GhostButton label="Delete" tone="destructive" fullWidth style={{ flex: 1 }} />
          </div>
        </Sheet>
      ) : null}
    </div>
  );
}

Object.assign(window, { SessionScreen, SetTable });
