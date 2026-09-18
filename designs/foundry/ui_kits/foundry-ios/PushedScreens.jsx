const { AppText, Chip, Eyebrow, SportIcon, EmptyState, SwipeableRow, Segmented, PrimaryButton, TextAction, SearchField, MediaThumb, InsetList, InsetRow, FormSection, FormTextField } = window.FoundryDesignSystem_397633;

const CHIP_FILTERS = ["All", "Chest", "Back", "Legs", "Shoulders", "Arms", "Core"];
const EQUIPMENT = ["compound", "isolation", "barbell", "dumbbell", "cable", "bodyweight", "machine"];

function ExercisesScreen({ onDelete }) {
  const data = window.FOUNDRY_DATA;
  const [search, setSearch] = React.useState("");
  const [chip, setChip] = React.useState("All");
  const [eq, setEq] = React.useState(null);
  const list = data.exercises.filter((e) => e.name.toLowerCase().includes(search.trim().toLowerCase()) && (!eq || e.category === eq || e.equipment === eq));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "8px 0 40px" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "0 16px" }}>
        <SearchField value={search} onChange={setSearch} placeholder="Search exercises" onCancel={() => setSearch("")} />
        <div style={{ display: "flex", gap: 6, overflowX: "auto" }}>
          {CHIP_FILTERS.map((c) => <Chip key={c} label={c} active={c === chip} onClick={() => setChip(c)} />)}
        </div>
        <div style={{ display: "flex", gap: 6, overflowX: "auto" }}>
          {EQUIPMENT.map((c) => <Chip key={c} label={c} active={c === eq} onClick={() => setEq(eq === c ? null : c)} />)}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "8px 16px 0" }}>
        {list.length === 0 ? (
          <EmptyState appearance="search" title="Nothing matches" body="Try clearing a filter or two." />
        ) : list.map((item) => (
          <SwipeableRow key={item.id} menuTitle={item.name} style={{ borderRadius: "var(--r-lg)" }}
            actions={[{ key: "open", label: "View" }, ...(item.isDefault ? [] : [{ key: "delete", label: "Delete", destructive: true, onPress: () => onDelete(item) }])]}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 16px", minHeight: "var(--row-min-height)" }}>
              <MediaThumb alt={item.name} size={40} />
              <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}>
                <AppText variant="row" numberOfLines={1}>{item.name}</AppText>
                <AppText variant="footnote" style={{ textTransform: "capitalize" }}>{item.category} · {item.equipment}</AppText>
              </span>
              {item.isDefault ? null : <TextAction label="Delete" tone="destructive" onClick={() => onDelete(item)} style={{ minHeight: 0, padding: 0, fontSize: 15 }} />}
            </div>
          </SwipeableRow>
        ))}
      </div>
    </div>
  );
}

function StartActivityScreen({ onStartFree }) {
  const data = window.FOUNDRY_DATA;
  const [stub, setStub] = React.useState(null);
  const [name, setName] = React.useState("");
  const sports = [["strength", "Strength", "Log sets & reps"], ["running", "Running", "Distance & pace"], ["cycling", "Cycling", "Distance & pace"], ["wod", "WOD", "Distance & pace"]];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "12px 20px 80px" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {sports.map(([key, label, sub]) => (
          <button key={key} type="button" onClick={() => (key === "strength" ? onStartFree() : setStub(label))}
            style={{ width: "48%", borderRadius: 14, border: "none", padding: 12, display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start", background: "var(--sport-" + key + "-dim)", cursor: "pointer" }}>
            <SportIcon sport={key} size={32} />
            <AppText style={{ fontSize: 15, fontWeight: 800 }}>{label}</AppText>
            <AppText style={{ fontSize: 10, color: "var(--text-muted)" }}>{sub}</AppText>
          </button>
        ))}
      </div>
      {stub ? (
        <div style={{ background: "var(--surface-2)", borderRadius: 12, padding: 12 }}>
          <AppText style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.42 }}>
            {stub} logging doesn't exist yet — strength is the only activity type with a backend so far (ADR-0002). The picker is built for four so adding one is a screen, not a redesign.
          </AppText>
        </div>
      ) : null}
      <FormSection title="Name this session (optional)">
        <FormTextField label="Name" value={name} onChange={setName} placeholder="Push day" />
      </FormSection>
      <Eyebrow>Routines</Eyebrow>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {data.routines.map((r) => (
          <button key={r.id} type="button" onClick={onStartFree}
            style={{ display: "flex", alignItems: "center", gap: 12, background: "var(--surface)", borderRadius: 14, border: "none", padding: 10, cursor: "pointer", textAlign: "left" }}>
            <SportIcon sport="strength" size={40} />
            <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
              <AppText style={{ fontSize: 14, fontWeight: 700 }}>{r.name}</AppText>
              <AppText style={{ fontSize: 11, color: "var(--text-muted)" }}>{r.exercises.length} exercises</AppText>
            </span>
            <span style={{ fontSize: 18, color: "var(--text-faint)", fontFamily: "var(--font-system)" }}>›</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function LanguageScreen() {
  const [locale, setLocale] = React.useState("en");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "12px 20px 24px" }}>
      <AppText variant="caption">Foundry follows your device language unless you choose one here.</AppText>
      <Segmented value={locale} onChange={setLocale} options={[{ value: "en", label: "English" }, { value: "nl", label: "Nederlands" }]} />
    </div>
  );
}

function SummaryScreen({ onDone }) {
  const { StatBox } = window.FoundryDesignSystem_397633;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "12px 20px 24px" }}>
      <AppText style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.5 }}>Push day</AppText>
      <AppText variant="caption">Wednesday 17 September · 48 min</AppText>
      <div style={{ display: "flex", gap: 8 }}>
        <StatBox value="14" label="Sets" />
        <StatBox value="3 120" unit="kg" label="Volume" />
        <StatBox value="1" label="PRs" />
      </div>
      <Eyebrow>Exercises</Eyebrow>
      {[["Bench press", "4 sets · 60–70 kg"], ["Incline DB press", "3 sets · 22.5 kg"], ["Lateral raise", "3 sets · 10 kg"]].map(([n, s]) => (
        <div key={n} style={{ background: "var(--surface)", borderRadius: 14, padding: 12, display: "flex", flexDirection: "column", gap: 2 }}>
          <AppText style={{ fontSize: 14, fontWeight: 700 }}>{n}</AppText>
          <AppText variant="caption">{s}</AppText>
        </div>
      ))}
      <PrimaryButton label="Done" onClick={onDone} />
    </div>
  );
}

Object.assign(window, { ExercisesScreen, StartActivityScreen, LanguageScreen, SummaryScreen });
