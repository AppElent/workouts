# Workouts design decisions

The web uses the existing dark theme and green accent from `src/styles.css`, with
Tailwind/CVA and Base UI components in `src/components/`. `AppShell.tsx` owns the
desktop sidebar and narrow-screen bottom navigation. Reuse its navigation spacing
rather than introducing another shell. Active sessions are resumed through the
existing session affordance; the root layout does not force an active-session redirect.

Use `Button`'s `loading` prop, `useToast()`, `useConfirm()`, `Skeleton`, and
`EmptyState` from the existing component owners. The router uses
`RouteErrorFallback`. Apply shared state/feedback rules through these interfaces;
never introduce a parallel toast, confirmation, or modal system.

Mobile has its own Foundry visual identity and native component interfaces. Read
[the mobile design system](mobile-design.md) for its tokens, forms,
platform adapters, and acceptance requirements. [Foundry design assets](../../../designs/foundry/readme.md)
are supporting references; runtime tokens and the mobile design system own shipped
implementation choices. Preserve the current web/mobile visual difference until
an explicit design migration.

Design studies live in `designs/<area>/` as self-contained HTML:
`<screen>_round<n>.html` per iteration and `<screen>_final.html` for the approved
design with implementation notes. A final file is a reference for the next
implementation, not a runtime contract. Run new studies with the
`design-session` skill. For mobile, mockups use the token values from
`apps/mobile/src/theme/tokens.ts`; Dutch copy by default.

Application UI copy supports English and Dutch. Translate accessible names,
validation, empty/error states, and navigation labels with the existing i18n seam.
