const { NavBar, TabBar, ActiveSessionBar, RestTimerBar, ConfirmDialog, Toast, OfflineBanner } = window.FoundryDesignSystem_397633;

const TABS = [
  { key: "home", label: "Home", icon: "house.fill" },
  { key: "train", label: "Train", icon: "play.fill" },
  { key: "nutrition", label: "Nutrition", icon: "fork.knife" },
  { key: "progress", label: "Progress", icon: "chart.bar.fill" },
  { key: "profile", label: "Profile", icon: "person.fill" },
];

const TAB_TITLES = { home: "Home", train: "Train", nutrition: "Nutrition", progress: "Progress", profile: "Profile" };

/** Stand-in for the app's RestTimerProvider — start()/stop() and a derived remainder. */
function useRestTimerMock() {
  const [endsAt, setEndsAt] = React.useState(null);
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (endsAt === null) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [endsAt]);
  const seconds = endsAt === null ? 0 : Math.ceil((endsAt - now) / 1000);
  return {
    running: endsAt !== null,
    done: endsAt !== null && seconds <= 0,
    label: Math.floor(Math.max(0, seconds) / 60) + ":" + String(Math.max(0, seconds) % 60).padStart(2, "0"),
    start: (s) => { setEndsAt(Date.now() + (s || 90) * 1000); setNow(Date.now()); },
    stop: () => setEndsAt(null),
    adjust: (d) => setEndsAt((p) => (p === null ? p : p + d * 1000)),
  };
}
window.useRestTimerMock = useRestTimerMock;

function App() {
  const [tab, setTab] = React.useState("home");
  const [stack, setStack] = React.useState([]);
  const [active, setActive] = React.useState(null);
  const [confirm, setConfirm] = React.useState(null);
  const [toast, setToast] = React.useState(null);
  const [offline, setOffline] = React.useState(false);
  // "system" lets prefers-color-scheme decide, as the app does; the other two
  // force a mode so both themes can be reviewed here.
  const [theme, setTheme] = React.useState("system");
  const rest = useRestTimerMock();

  React.useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(id);
  }, [toast]);

  const push = (screen) => setStack((s) => [...s, screen]);
  const pop = () => setStack((s) => s.slice(0, -1));
  const top = stack[stack.length - 1];

  const startFree = () => { setActive({ name: "Push day" }); setStack([{ kind: "session", title: "Push day" }]); };

  let body = null;
  let header = null;

  if (!top) {
    header = <NavBar title={TAB_TITLES[tab]} largeTitle />;
    body =
      tab === "home" ? <HomeScreen active={active} onStart={() => push({ kind: "start", title: "Start activity" })} onResume={() => push({ kind: "session", title: active ? active.name : "Workout" })} onOpenSession={() => push({ kind: "summary", title: "Summary" })} />
      : tab === "train" ? <TrainScreen onStart={() => push({ kind: "start", title: "Start activity" })} onOpenExercises={() => push({ kind: "exercises", title: "Exercises" })} onDeleteRoutine={(r) => setConfirm({ title: "Delete " + r.name + "?", message: "Sessions you already logged from it are kept.", confirmLabel: "Delete routine", destructive: true })} />
      : tab === "nutrition" ? <NutritionScreen onAdd={() => push({ kind: "exercises", title: "Add food" })} />
      : tab === "progress" ? <ProgressScreen />
      : <ProfileScreen onOpenLanguage={() => push({ kind: "language", title: "Language" })} theme={theme} onTheme={setTheme} />;
  } else if (top.kind === "session") {
    header = <NavBar title={top.title} onBack={pop} action={{ label: "Finish", onPress: () => { setActive(null); setStack([{ kind: "summary", title: "Summary" }]); rest.stop(); } }} />;
    body = <SessionScreen onCancelRequest={() => setConfirm({ title: "Cancel this workout?", message: "Sets you already logged are kept.", confirmLabel: "Cancel workout", cancelLabel: "Keep going", destructive: true, onConfirm: () => { setActive(null); setStack([]); rest.stop(); } })} />;
  } else if (top.kind === "exercises") {
    header = <NavBar title={top.title} onBack={pop} action={{ label: "Add" }} />;
    body = <ExercisesScreen onDelete={(item) => setConfirm({ title: "Delete " + item.name + "?", message: "Every set and 1RM logged against it goes too.", confirmLabel: "Delete exercise", destructive: true, onConfirm: () => setToast({ kind: "error", message: "Default exercises cannot be deleted." }) })} />;
  } else if (top.kind === "start") {
    header = <NavBar title={top.title} onBack={pop} />;
    body = <StartActivityScreen onStartFree={startFree} />;
  } else if (top.kind === "language") {
    header = <NavBar title={top.title} onBack={pop} />;
    body = <LanguageScreen />;
  } else {
    header = <NavBar title="Summary" />;
    body = <SummaryScreen onDone={() => setStack([])} />;
  }

  const onSession = top && top.kind === "session";

  return (
    <div className={theme === "system" ? undefined : "theme-" + theme}
      style={{ position: "relative", width: 390, minHeight: 844, margin: "0 auto", background: "var(--bg)", color: "var(--text)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {offline ? <OfflineBanner /> : null}
      {header}
      <main style={{ flex: 1, overflowY: "auto" }}>{body}</main>
      {onSession && rest.running ? (
        <RestTimerBar remaining={rest.label} done={rest.done} defaultSeconds={90} onAdjust={rest.adjust} onDismiss={rest.stop} />
      ) : null}
      {!onSession ? (
        <TabBar tabs={TABS} value={tab} onChange={(k) => { setTab(k); setStack([]); }}
          accessory={active ? <ActiveSessionBar name={active.name} elapsed="12:04" onPress={() => setStack([{ kind: "session", title: active.name }])} /> : null} />
      ) : null}
      {toast ? (
        <div style={{ position: "absolute", top: 62, left: 16, right: 16, zIndex: 50 }}>
          <Toast kind={toast.kind} message={toast.message} onDismiss={() => setToast(null)} />
        </div>
      ) : null}
      {confirm ? (
        <ConfirmDialog {...confirm} onConfirm={() => { if (confirm.onConfirm) confirm.onConfirm(); setConfirm(null); }} onCancel={() => setConfirm(null)} />
      ) : null}
      <button type="button" onClick={() => setOffline(!offline)}
        style={{ position: "absolute", top: 8, right: 8, zIndex: 60, border: "1px solid var(--border-strong)", borderRadius: 9999, background: "var(--surface-2)", color: "var(--text-faint)", fontFamily: "var(--font-system)", fontSize: 9, padding: "3px 8px", cursor: "pointer" }}>
        {offline ? "online" : "offline"}
      </button>
      <button type="button" onClick={() => setTheme(theme === "light" ? "dark" : "light")}
        style={{ position: "absolute", top: 8, left: 8, zIndex: 60, border: "1px solid var(--border-strong)", borderRadius: 9999, background: "var(--surface-2)", color: "var(--text-faint)", fontFamily: "var(--font-system)", fontSize: 9, padding: "3px 8px", cursor: "pointer" }}>
        {theme === "light" ? "dark" : "light"}
      </button>
    </div>
  );
}

Object.assign(window, { App, TABS });
