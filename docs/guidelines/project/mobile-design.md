# Workouts mobile design system

The app is an iOS-first fitness utility: energetic when progress matters, calm
while entering data, and dense enough for repeated daily use. The lime accent
identifies the primary action, selection, and progress. Neutral surfaces carry
everything else.

## Shared behavior

Read the root [design system](../../../DESIGN_SYSTEM.md) and its general/mobile/
iOS/Android links for the screen contract, states, navigation, and verification
rules. The sections below define Workouts' visual identity and component seams.

## Layers

### Functional chrome

On iOS, navigation and transient controls use the operating system: native tab
bars, stack headers and toolbars, menus, form sheets, context menus, pickers,
and SF Symbols. iOS 26 supplies Liquid Glass to this layer. Let the system own
its material and motion instead of imitating it in React Native.

### Content

Content uses opaque semantic surfaces from `apps/mobile/src/theme/tokens.ts`. Group related
rows with separators. Cards represent actual objects or summaries; they are not
containers for arbitrary form fields. A repeated object is a compact summary
row and opens focused editing when necessary.

## Interfaces

`apps/mobile/src/ui/form.tsx` is the design-system seam for data entry and grouped content:

| Interface | Use |
| --- | --- |
| `FormScreen` | Keyboard-aware scrolling plus one safe-area primary action |
| `FormSection` | Related rows with a heading, separators, and optional help |
| `GroupedSurface` | A composed summary that must remain one visual object |
| `FormTextField` | Labeled text entry with semantic error placement |
| `InlineNumberFieldRow` | Compact numerical entry with unit and accessory |
| `DisclosureRow` | Progressive disclosure or navigation to more detail |
| `EditableValueRow` | A saved repeated value summarized in one row |
| `AddRow` | Add an item inside the section it affects |
| `StepperField` | Small bounded numeric adjustment with a 44-point hit area |
| `TextAction` | Cancel, neutral, or destructive secondary action |

Primary actions use `PrimaryButton`. `GhostButton` remains a compatibility
primitive for unmigrated screens, not the default for disclosures, additions,
cancellation, deletion, or navigation.

## Visual grammar

- Use the system font and the named type ramp in `apps/mobile/src/theme/tokens.ts`.
- Use one lime accent. Destructive actions use the semantic danger color.
- Use the 4-point spacing scale. Space between sections is larger than space
  between related rows.
- Use continuous corners. Pills are reserved for the principal action and
  compact chips, not every tappable element.
- Keep visible controls compact while maintaining at least 44-point iOS and
  48dp shared hit regions.
- Prefer short action labels whose context comes from the screen title.

## Device acceptance

Verify each affected supported platform with the development build. A simulator
can verify layout and navigation; final iOS feel/haptics acceptance requires a
physical iPhone. Follow [the project verification guide](../../../.claude/skills/verify/SKILL.md)
and state unavailable platforms explicitly. For visual changes capture the populated
screen and verify:

- Dutch and English copy;
- Dynamic Type XL;
- keyboard open and interactive dismissal;
- safe areas, native header, tab bar, and sheet grabber;
- disabled, pending, validation-error, and storage/network-error states;
- a short recording when navigation, sheets, gestures, or motion changed.

Automated tests protect behavior; they do not approve hierarchy or device feel.
