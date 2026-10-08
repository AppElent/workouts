---
version: 1.0.0
description: Select checks and establish runtime and design acceptance.
---

# Verification

Run the affected target's configured checks. Start with the changed behavior and
failure paths, then complete its required gates. Build shared workspace outputs
before dependent checks. A root suite does not cover an excluded target.
Preserve assertions and checks; report pre-existing failures with evidence.

For runtime work, identify the revision, bundle, backend, and device/browser before
writes. Use the host's shared preview/device tools when available. Exercise the
changed journey, recovery, and refresh/reopen; identify inaccessible paths.

For a supplied design, list its applicable states before implementation, including
menus, keyboard, and clean/dirty/invalid forms. Resolve material deviations with
the user. Compare each state against the running implementation and record pass,
agreed deviation, or unresolved, with current screenshots/recordings. Recheck
states affected by later changes.

For native sheets, keyboard accessories, overlays, or platform hosts, exercise a
small complete flow before polishing: open, focus, switch inputs/presentations,
dismiss, reopen. Check that the parent remains tappable, the draft survives the
intended transitions, and one owner coordinates keyboard/scroll/insets. Repeat
affected transitions after geometry or adapter changes.

Verify supported themes/locales, larger text, accessibility, Back/dismissal,
relevant gestures, and offline/error states. Capture motion as a recording;
a still image cannot verify it. Physical hardware is needed for tactile haptics.
Automated tests, bundle exports, device behavior, and provider delivery are
separate evidence. Record untested paths explicitly.

Keep one current-status section per report with revision and pending acceptance;
older observations remain dated evidence. Documentation-only changes need link,
ownership, and routing checks. Save noisy diagnostic output locally and inspect
the failure excerpt with its exit status.
