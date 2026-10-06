---
name: design-session
description: Iterate on a screen design together with the user in self-contained HTML rounds, explore its states, finalize it with implementation notes, then fold the decisions into the project's design system and guidelines. Use when the user wants to review, iterate on, or finalize UI designs or mockups.
---

# Design session

A session iterates on one screen at a time while the user watches. The user makes the decisions. You bring the critique, the options, and the states they haven't seen yet.

## Orient

Before the first round, read:

1. The project's design guidance: `DESIGN_SYSTEM.md` or equivalent, platform-specific design docs, and token files. Follow the links they give for the target platform.
2. The existing design artifacts for the area. Default location: `designs/<area>/`; use the project's location if it has one.
3. The shipped implementation of the screen. Its actions, menus, gestures, and states are the **inventory**. A redesign keeps every item unless the user drops it, so list them before proposing anything.
4. The installed UI stack and versions (package manifest) and existing component seams. Implementation notes must name real components, not invented ones.

Match the app's language for copy and use realistic sample data.

## Show it together

The user must see the design before choosing anything.

- Serve the design folder over HTTP and give the user a URL. The user may be on a different machine than the agent, where `localhost` does not resolve. Bind to all interfaces and use the LAN address:
  ```sh
  python3 -m http.server 8765 --bind 0.0.0.0 --directory <designs-dir>
  ipconfig getifaddr en0   # macOS; Linux: hostname -I
  ```
- Open it in the available preview/browser tool. If that fails, take headless screenshots yourself (Chrome/Edge `--headless=new --screenshot=<png> --window-size=<w>,<h> <url>`) to check the work, and send the URL to the user.
- Before you show anything, look at your own screenshots. Overlapping menus, clipped text, misplaced overlays, and grammar such as "1 items" are common.
- Ask which screen to start with. Do one screen at a time, and don't batch choices across screens.

## Rounds

- File per round: `<screen>_round<n>.html`, next to the original. Never overwrite an earlier round; link back to it in the header and state what was decided.
- Open each round with a **numbered critique** of the current design, ranked by impact. The user answers per point.
- Each round has **1–5 options**, depending on how uncertain the question is. When something is settled, show one design. When a question is open, show alternatives, mark one as recommended, and give the reason.
- Organize the board in sections. Each has a heading and one paragraph stating the decision or the open question. Label every mockup as **State** (a state of the chosen design), **Recommended**, or **Alternative**, with a one-line note on how to build it natively.
- Keep files self-contained: inline CSS and JS, and no network, build, or install. Reuse the previous round's styles and helpers so rounds stay comparable. Use the project's real token values.
- Make key behavior interactive where it's cheap: scrolling that collapses the header, toggling selection, light/dark. A `?s=<n>` filter that shows a single section helps both screenshots and discussion.

## States before closing

Don't finalize a screen until each relevant state has been shown and approved:

- the navigation header, expanded and collapsed on scroll;
- every menu (screen-level and per-section) containing **all inventory items**;
- row gestures: swipe (reveals actions, never commits) and long press (full action set);
- selection mode and its bulk actions;
- follow-up sheets and their edge cases (for example a date outside the visible range);
- summaries in full: each summarized number has a route to its complete view, to editing, and to its sources ("what caused this?"), including incomplete and approximate values;
- empty, loading, error, offline, and draft states;
- dark mode, long text, and larger text sizes where layout is at risk.

## Finalize

- When the user approves, write `<screen>_final.html`, containing the approved states only and linking to the rounds that decided them.
- Implementation details are optional in early rounds and required in the final file:
  - a building-blocks table: element → component or API in the app (with installed versions) → why;
  - per section: **Fixes** (what it solves), **Native** (how to build it), **Risks** (what to verify, and API support you could not confirm);
  - collapsible code sketches for the notable parts, using the project's real seams, routes, and message keys where they exist.
- After approval, fix things only in the final file. Earlier rounds stay as history.

## Update guidance

Put each decision in the narrowest place it applies:

1. **Platform design system** (for example a mobile design-system file): interaction patterns and visual decisions this project now follows. Link the final file as evidence.
2. **Project-wide design system:** cross-platform decisions and the convention for design artifacts.
3. **Shared or generic guidelines:** if the project's shared guidance is managed or synced from elsewhere, don't edit it locally. Draft a proposal next to the designs (`guidance-proposal.md` with Proposed guidance / Why / Scope / Evidence / Acceptance) and file it upstream only after the user approves, since filing is outward-facing.

Keep rules generic in shared guidance and concrete (component names, routes) in project guidance.

## Improve this skill

When the user corrects the process, update this skill. Keep project-specific facts out of it; they belong in the project's design system or in memory.
