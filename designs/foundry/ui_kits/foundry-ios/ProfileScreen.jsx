const { AppText, StatBox, InsetList, InsetRow, Segmented } = window.FoundryDesignSystem_397633;

function ProfileScreen({ onOpenLanguage, theme, onTheme }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--section-gap)", padding: "4px 20px 24px" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "8px 0" }}>
        <div style={{ width: 56, height: 56, borderRadius: 9999, background: "var(--surface-2)", display: "grid", placeItems: "center" }}>
          <AppText style={{ fontSize: 17, fontWeight: 600, color: "var(--text-muted)" }}>EJ</AppText>
        </div>
        <AppText variant="heading">Eric Jansen</AppText>
        <AppText variant="footnote">Member since Mar 2025</AppText>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <StatBox value="142" label="Sessions" />
        <StatBox value="312 km" label="Distance" />
        <StatBox value="18" label="PRs" />
      </div>

      <InsetList header="Preferences">
        <InsetRow title="Units" value="kg · km" chevron onPress={() => {}} />
        <InsetRow title="Notifications" value="On" chevron onPress={() => {}} />
        <InsetRow title="Connected apps" value="None" chevron onPress={() => {}} />
        <InsetRow title="Language" value="English" chevron onPress={onOpenLanguage} />
      </InsetList>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <AppText style={{ fontSize: "var(--type-eyebrow-size)", fontWeight: 600, letterSpacing: "var(--type-eyebrow-tracking)", textTransform: "uppercase", color: "var(--text-muted)" }}>Appearance</AppText>
        <Segmented value={theme} onChange={onTheme} options={[{ value: "system", label: "System" }, { value: "light", label: "Light" }, { value: "dark", label: "Dark" }]} />
        <AppText variant="footnote">The app follows iOS by default; this switch is here so both themes can be reviewed.</AppText>
      </div>

      <InsetList>
        <InsetRow title="Sign out" destructive onPress={() => {}} />
      </InsetList>
    </div>
  );
}

Object.assign(window, { ProfileScreen });
