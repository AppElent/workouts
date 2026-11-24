# Strength session redesign, round 2

Approved on the Active Workout canvas, page "Ronde 2"
([claude.ai artifact](https://claude.ai/artifact/E7eJRxyAFN2G3LxxfXMEnR)), and built in
APP-619. The canvas is the spec and replaces round 1's set table
([session_redesign_final.html](session_redesign_final.html) stays as history). Where the
two differ, this page wins.

## Boards

| Board | What it shows |
| --- | --- |
| Session with a plan | Done cards (collapsed, ✓ on the thumbnail), the current card with its sets, upcoming cards; a progress strip with one segment per working set and the volume; the Now card at the bottom |
| Rest | The Now card counts down with −15 / +15, the next set under it, and "Log set n" |
| Ad hoc | No plan: the Now card has weight and reps steppers, an "Oefening" button and "Vorige set" from last time |
| Empty | Quick-start tiles of what you trained lately, each with last time's set and when |
| Set editor | Two value cards (weight, reps), four set-type segments, the subtitle "Vorige keer … @ RPE · date", "Log · x"; advanced shows percentage chips, RPE and the 1RM this set gives, with and without a known 1RM |
| Exercise overview | "‹ Sessie", header, Overzicht / Geschiedenis / Records; the 1RM card with its trend and "▲ x kg in n weken", tiles, "Wat je nu aankunt"; level and records under Records |
| Finish | Unchanged recap, plus "Terug naar sessie" top left. The session button says "Afronden" |

## Decisions

- **One next set.** The Now card always names the next set (warm-ups included) and
  logs it with one tap. Rows still log by their check; tap opens the editor.
- **Counts are working sets.** The header, progress strip and "n van m sets" leave
  warm-ups out. Planned sets are working sets, so a logged warm-up never uses one up.
- **The editor has no empty middle** (APP-549). Without advanced details it shows
  last time's sets for this exercise in a "Vorige keer" card.
- **Previous set by kind and position.** "Vorige keer" matches the same set type and
  number in the last session, with its RPE and date.
- **The 1RM says where it comes from.** Gemeten, Handmatige or Geschat, in the
  overview label and the editor's detail lines.
- **Back names where it goes.** The overview and the recap use `BackLink` in a
  `Stack.Toolbar.View`, because a toolbar button with an icon hides its label.

## Bindings

| Concern | Binding |
| --- | --- |
| Session cards | `components/session-exercise-block.tsx`, `session-set-row.tsx`, `session-progress.tsx` |
| Now card and rest | `components/now-card.tsx` in `session-dock.tsx` |
| Empty state | `components/session-quick-start.tsx` |
| Previous performance | `data/previous-session.ts` (`previousSetOf`, `previousSetsOf`) |
| Set editor | `set-editor-screen.tsx`, a formSheet; `Segmented` with `maxSegments={4}` |
| Overview chart | `src/ui/trend-line.tsx`: SVG, scaled to its own range, not from zero |
| Tokens | `surface3`, `dock`, `type.value*`, `type.overline` |

No Convex change: everything ships as an OTA update.

## Deviations from the canvas

- The simple editor shows the "Vorige keer" card where the canvas leaves space, so
  the sheet has no empty middle.
- In light mode the chart line uses `accentInk`; the canvas lime fails contrast on
  white.
- The set type segment reads "Dropset", the existing copy; the canvas says "Drop".
- The editor menu keeps Krachtprofiel, which the canvas does not draw.
- The canvas's note field is not built: notes need a Convex field.

## Limits

- Warm-up singles still count server-side, as in round 1.
- Session references are snapshotted when an exercise is added, so a 1RM saved
  later shows in the overview but not in that session.
