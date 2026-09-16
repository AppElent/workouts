# Mobile instructions

For mobile screen, layout, form, navigation, sheet, or visual-polish work, read
`DESIGN_SYSTEM.md` before editing UI code. Complete its screen contract and
device acceptance steps before calling the work done.

Use the semantic interfaces in `src/ui/form.tsx` for forms, grouped content,
disclosures, editable values, and steppers. Extend that module when a pattern
recurs; keep raw input and layout mechanics inside the design-system seam.

On iOS, prefer native tabs, stack headers, toolbars, menus, sheets, controls,
and SF Symbols. Liquid Glass is functional chrome above the content layer;
content uses calm opaque grouped surfaces. Preserve Android outcome parity
with the repository's existing platform adapters.

