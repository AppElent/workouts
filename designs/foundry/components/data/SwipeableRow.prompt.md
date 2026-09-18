One-line: the list row with trailing actions — swipe reveals them, it never commits them.

```jsx
<SwipeableRow
  menuTitle="Bench press"
  open={open}
  onToggle={() => setOpen(!open)}
  actions={[
    { key: "edit", label: "Edit" },
    { key: "delete", label: "Delete", destructive: true, onPress: confirmDelete },
  ]}
>
  <div style={{ display: "flex", gap: 12, padding: 12, alignItems: "center" }}>…</div>
</SwipeableRow>
```

Max two swipe actions (88px each). Deletion still asks. The caller must also offer a visible route to every action elsewhere.
