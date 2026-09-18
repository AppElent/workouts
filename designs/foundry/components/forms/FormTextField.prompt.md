One-line: borderless text entry that *is* the row — the iOS grouped-form field.

```jsx
<FormSection title="Exercise" footer="Shared exercises cannot be renamed.">
  <FormTextField label="Name" value={name} onChange={setName} placeholder="Required" />
  <FormTextField label="Notes" multiline value={notes} onChange={setNotes} />
</FormSection>
```

Never draw a box around a field inside a FormSection — the group already has the border, and doubling it is what makes a screen read as HTML. Focus shows a caret in `--accent-ink` and nothing else: no ring, no border change.
