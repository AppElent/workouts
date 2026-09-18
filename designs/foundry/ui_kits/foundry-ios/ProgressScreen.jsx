const { AppText, Chip, Eyebrow, StatBox, TrendChart, BucketChart } = window.FoundryDesignSystem_397633;

function ProgressScreen() {
  const [tab, setTab] = React.useState("Exercises");
  const [exercise, setExercise] = React.useState("Bench press");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "12px 20px 24px" }}>
      <div style={{ display: "flex", gap: 7 }}>
        {["Exercises", "Body"].map((t) => (
          <span key={t} style={{ flex: 1, display: "flex" }}><Chip label={t} active={t === tab} onClick={() => setTab(t)} style={{ flex: 1 }} /></span>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <StatBox value="24" label="Sessions" />
        <StatBox value="18h 40m" label="Active" />
      </div>
      {tab === "Exercises" ? (
        <>
          <Eyebrow>Exercise</Eyebrow>
          <div style={{ display: "flex", gap: 7, overflowX: "auto" }}>
            {["Bench press", "Back squat", "Deadlift"].map((n) => <Chip key={n} label={n} active={n === exercise} onClick={() => setExercise(n)} />)}
          </div>
          <TrendChart title="1RM over time" points={[{ value: 92, label: "3 Mar" }, { value: 96, label: "18 Mar" }, { value: 95, label: "1 Apr" }, { value: 101, label: "20 Apr" }]} />
          <BucketChart title="Weekly volume" note="Every set type, warmups included." points={[{ value: 4200, label: "W12" }, { value: 5100, label: "W13" }, { value: 3900, label: "W14" }, { value: 5600, label: "W15" }, { value: 6100, label: "W16" }]} />
        </>
      ) : (
        <>
          <Eyebrow>Body</Eyebrow>
          <TrendChart title="Weight" points={[{ value: 84.2, label: "Jun" }, { value: 83.4, label: "Jul" }, { value: 82.9, label: "Aug" }, { value: 82.5, label: "Sep" }]} />
          <AppText variant="caption">Logged from the Body tab; a measurement is one row per day.</AppText>
        </>
      )}
    </div>
  );
}

Object.assign(window, { ProgressScreen });
