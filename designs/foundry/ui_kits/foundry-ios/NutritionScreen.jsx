const { AppText, Eyebrow, GroupedSurface, DateStepper, NutritionCalendar, EmptyState, SwipeableRow, TextAction } = window.FoundryDesignSystem_397633;

const MEALS = [["breakfast", "Breakfast"], ["lunch", "Lunch"], ["dinner", "Dinner"], ["snacks", "Snacks"]];

function Track({ fraction, color = "var(--accent)" }) {
  return (
    <div style={{ height: 8, borderRadius: "var(--r-pill)", background: "var(--surface-2)", overflow: "hidden" }}>
      <div style={{ height: 8, width: Math.max(0, Math.min(100, fraction * 100)) + "%", borderRadius: "var(--r-pill)", background: color }} />
    </div>
  );
}

function MacroCell({ name, value, goal }) {
  return (
    <div style={{ flexGrow: 1, flexBasis: 80, minWidth: 80, display: "flex", flexDirection: "column", gap: 4 }}>
      <AppText variant="caption">{name}</AppText>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <AppText style={{ fontWeight: 700 }}>{value} g</AppText>
        <AppText variant="caption">≥ {goal} g</AppText>
      </div>
    </div>
  );
}

function MealSection({ label, entries, onAdd }) {
  const kcal = entries.reduce((s, e) => s + e.kcal, 0);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ flex: 1 }}>
          <AppText variant="heading">{label}</AppText>
          {entries.length ? <div><AppText variant="caption">{kcal} kcal</AppText></div> : null}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <button type="button" aria-label={label + ": actions"} style={{ minWidth: 44, minHeight: 44, border: "none", background: "transparent", color: "var(--text-muted)", cursor: "pointer", fontFamily: "var(--font-system)" }}>···</button>
          <button type="button" aria-label={"Add to " + label} onClick={onAdd}
            style={{ minWidth: 44, minHeight: 44, borderRadius: "var(--r-pill)", border: "none", background: "var(--accent)", color: "var(--on-accent)", fontFamily: "var(--font-system)", fontSize: 18, fontWeight: 700, cursor: "pointer" }}>+</button>
        </div>
      </div>
      <GroupedSurface style={{ padding: "0 var(--space-md)" }}>
        {entries.length === 0 ? (
          <div style={{ padding: "var(--space-md) 0" }}><EmptyState body="Nothing logged here yet." /></div>
        ) : entries.map((entry, i) => (
          <SwipeableRow key={entry.id} menuTitle={"Actions for " + entry.name} style={{ borderRadius: 0 }}
            actions={[{ key: "edit", label: "Edit" }, { key: "copy", label: "Copy", swipe: false }, { key: "move", label: "Move", swipe: false }, { key: "delete", label: "Delete", destructive: true }]}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 0", minHeight: 56, borderBottom: i === entries.length - 1 ? "none" : "1px solid var(--border)" }}>
              <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                <AppText style={{ fontWeight: 700 }}>{entry.name}</AppText>
                <AppText variant="caption">{entry.serving}</AppText>
              </span>
              <AppText style={{ fontWeight: 700 }}>{entry.kcal} kcal</AppText>
            </div>
          </SwipeableRow>
        ))}
      </GroupedSurface>
    </div>
  );
}

function NutritionScreen({ onAdd }) {
  const diary = window.FOUNDRY_DATA.diary;
  const [calendar, setCalendar] = React.useState(false);
  const logged = MEALS.reduce((s, [k]) => s + diary[k].reduce((a, e) => a + e.kcal, 0), 0);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "12px 20px 40px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <DateStepper label="Today" secondaryLabel="17 Sep" onChooseDate={() => setCalendar(!calendar)} />
        </div>
        <button type="button" aria-label="Weekly review" style={{ minWidth: 44, minHeight: 44, border: "none", background: "transparent", display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 3, cursor: "pointer" }}>
          {[10, 19, 15].map((h) => <span key={h} style={{ width: 4, height: h, borderRadius: 2, background: "var(--accent)" }} />)}
        </button>
      </div>

      {calendar ? <NutritionCalendar monthLabel="September 2026" offset={1} days={30} selected={17} today={17} /> : null}

      <div style={{ display: "flex", alignItems: "center", gap: 4, minHeight: 44 }}>
        <span style={{ color: "var(--accent)", fontSize: 8, fontFamily: "var(--font-system)" }}>●</span>
        <AppText variant="caption">Trained today</AppText>
      </div>

      <GroupedSurface style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <AppText variant="caption">Goals</AppText>
          <TextAction label="Edit goals" style={{ minHeight: 44, padding: 0, fontSize: 12 }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2, paddingBottom: 4 }}>
          <AppText variant="title">{2400 - logged} kcal left</AppText>
          <AppText variant="caption">{logged} logged of 2 400 kcal</AppText>
        </div>
        <Track fraction={logged / 2400} />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, paddingTop: 8 }}>
          <MacroCell name="Protein" value={96} goal={150} />
          <MacroCell name="Carbs" value={121} goal={250} />
          <MacroCell name="Fat" value={38} goal={70} />
        </div>
      </GroupedSurface>

      {MEALS.map(([key, label]) => <MealSection key={key} label={label} entries={diary[key]} onAdd={onAdd} />)}
    </div>
  );
}

Object.assign(window, { NutritionScreen, MealSection, Track, MacroCell });
