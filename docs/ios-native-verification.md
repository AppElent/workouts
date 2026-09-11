# iOS interaction verification

The native UI changes are implemented. A physical iPhone pass remains required:
Windows cannot verify UIKit layout, interactive transitions or gesture conflicts.
The app still uses its existing dark appearance.

Run `pnpm --filter @workouts/mobile start` and open the project in Expo Go on the
iPhone, or use the existing development client. No native dependencies were added.

| Flow | Verify on the iPhone |
| --- | --- |
| All five tabs | Native header and tabs remain visible. Scroll to the last control; it must clear the tab bar and home indicator. Repeat with larger text. |
| Train → Exercises → exercise | Native Back and edge-swipe each return one level. Cancel an edge-swipe halfway; the screen stays usable. Long-press Back to inspect the system navigation history. |
| Exercise library | Long press shows an anchored system menu. Swipe exposes actions; Delete still asks. A visible Delete tap must not also open the exercise. |
| Routine cards and logged sets | Horizontal swipe reveals actions, vertical drag scrolls. Long press opens system options. Tapping a set still opens its editor. |
| Running workout | Log a set to start the rest timer. The timer occupies its own space; it must not cover Log set or the last row. Pause, adjust and dismiss it. |
| Leave an active workout | On iOS 26+, Resume appears in the native tab accessory. Earlier iOS uses an inline bar above the tabs. Resume opens the running session. |
| Nutrition → food → serving | The serving sheet can be dragged down. Open the keyboard; quantity and Log remain reachable. Dismiss, reopen and log a serving. |
| Personal Food editing | Open the editor from serving options. It stays in the same native sheet. Cancel returns to serving options; save updates them. A failed save preserves input. |
| Barcode scanner | Full-screen camera has a Close control inside the safe area. Refusing camera access still leaves a Close control. |
| Nutrition diary rows | Long press opens an anchored native menu. Edit opens the addressed entry once; Delete opens a native confirmation. Cancel deletes nothing. Also exercise VoiceOver actions. |
| Nutrition → Combo library → Combo | Back returns to the library, then the diary. Logging returns directly to the diary. The chosen day is preserved. |
| Add exercise / routine / WOD | Native sheet drag-to-dismiss works. With the keyboard open, scroll to Save/Create. Dismissal is disabled while a save is pending. |
| Edit a logged set | A clean sheet dismisses by dragging. After editing, drag cannot discard changes. Close asks whether to discard; Keep editing preserves values. |
| Finish workout | Summary cannot navigate back into the finished workout. Its Done action returns home. |
| Offline | The offline notice takes layout space; it must not cover the native header or controls. |

Repeat key transitions with Reduce Motion enabled. Screenshots can establish
layout; a short recording is needed to assess edge-back cancellation, sheet
dismissal and keyboard movement. Automated tests and the iOS export do not
establish that these device checks passed.

Android uses the existing menu fallback and native back navigation; it has not
been visually verified as part of this iOS work.
