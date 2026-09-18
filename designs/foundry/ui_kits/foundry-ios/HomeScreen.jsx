const { AppText, Card, HeroCard, InsetList, InsetRow, ProgressRing, SportIcon, PrimaryButton, TextAction, MediaThumb } = window.FoundryDesignSystem_397633;

function SportRow({ onPick }) {
  const sports = [["strength", "Strength"], ["running", "Running"], ["cycling", "Cycling"], ["wod", "WOD"]];
  return (
    <div style={{ display: "flex", gap: 8 }}>
      {sports.map(([key, label]) => (
        <button key={key} type="button" onClick={onPick}
          style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5, padding: "10px 0 8px", borderRadius: 13, border: "none", background: "var(--sport-" + key + "-dim)", cursor: "pointer" }}>
          <SportIcon sport={key} size={30} />
          <span style={{ fontFamily: "var(--font-system)", fontSize: 11, fontWeight: 600, color: "var(--text-muted)" }}>{label}</span>
        </button>
      ))}
    </div>
  );
}

function HomeScreen({ active, onStart, onResume, onOpenSession }) {
  const data = window.FOUNDRY_DATA;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--section-gap)", padding: "4px 20px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <AppText style={{ fontSize: "var(--type-eyebrow-size)", fontWeight: 600, letterSpacing: "var(--type-eyebrow-tracking)", textTransform: "uppercase", color: "var(--text-muted)" }}>Wednesday, 17 Sep</AppText>
          <AppText as="h1" style={{ display: "block", marginTop: 2, fontSize: "var(--type-screen-title-size)", fontWeight: 700, letterSpacing: "var(--type-screen-title-tracking)" }}>Ready to move</AppText>
        </div>
        <div style={{ width: 36, height: 36, borderRadius: 18, background: "var(--surface-2)", display: "grid", placeItems: "center" }}>
          <AppText style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)" }}>EJ</AppText>
        </div>
      </div>

      <Card style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <ProgressRing value={3} target={8} size={56} label="3 of 8 sessions this week" />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 1 }}>
          <AppText variant="row">This week</AppText>
          <AppText variant="footnote">3 sessions logged · 2h 41m</AppText>
        </div>
        <span aria-hidden="true" style={{ color: "var(--text-faint)", fontSize: 17 }}>›</span>
      </Card>

      {active ? (
        <Card tone="accent" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 7, height: 7, borderRadius: 9999, background: "var(--accent-ink)" }} />
            <AppText style={{ fontSize: "var(--type-eyebrow-size)", fontWeight: 600, letterSpacing: "var(--type-eyebrow-tracking)", textTransform: "uppercase", color: "var(--accent-ink)" }}>In progress</AppText>
          </div>
          <AppText variant="heading">{active.name}</AppText>
          <PrimaryButton label="Resume" onClick={onResume} />
        </Card>
      ) : (
        <HeroCard
          eyebrow="Today's workout"
          title="Push day"
          subtitle="Chest, shoulders, triceps"
          meta="4 exercises · about 45 min"
          alt="Push day"
          action={<PrimaryButton label="Start activity" onClick={onStart} />}
        />
      )}

      <SportRow onPick={onStart} />

      <InsetList header="Recent" action={<TextAction label="See all" style={{ minHeight: 0, padding: 0 }} />}>
        {data.recent.slice(0, 3).map((item) => (
          <InsetRow key={item.id} leading={<MediaThumb alt={item.name} size={36} radius={9} />}
            title={item.name} secondary={item.when} value={item.duration} chevron onPress={onOpenSession} />
        ))}
      </InsetList>
    </div>
  );
}

Object.assign(window, { HomeScreen, SportRow });
