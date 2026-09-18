One-line: bordered capsule for the secondary action beside a primary one.

```jsx
<div style={{ display: "flex", gap: "var(--space-sm)" }}>
  <PrimaryButton label="Start" fullWidth={false} style={{ flex: 1 }} />
  <GhostButton label="Edit" />
  <GhostButton label="Delete" tone="destructive" />
</div>
```

Not for disclosures, additions, cancellation or navigation — those belong to rows and TextAction.
