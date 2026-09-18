One-line: a flexed stat tile — big tabular number, uppercase micro-label.

```jsx
<div style={{ display: "flex", gap: "var(--space-sm)" }}>
  <StatBox value="142" label="Sessions" />
  <StatBox value="312" unit="km" label="Distance" />
</div>
```

Two or three per row. Never more — the label becomes unreadable.
