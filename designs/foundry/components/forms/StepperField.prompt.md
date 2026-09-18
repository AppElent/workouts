One-line: −/+ number control, as a row accessory (`compact`) or a standalone thumb-sized field.

```jsx
{/* next to a value in a grouped row */}
<InlineNumberFieldRow label="Sets" value="4" suffix="" accessory={<StepperField variant="compact" label="sets" value={4} onChange={setSets} />} />

{/* the set logger */}
<div style={{ display: "flex", gap: "var(--space-sm)" }}>
  <StepperField label="kg" value={82.5} step={2.5} height={56} onChange={setWeight} />
  <StepperField label="reps" value={8} step={1} min={1} height={56} onChange={setReps} />
</div>
```

Steps are per-equipment, never one global increment. Values round to one decimal.
