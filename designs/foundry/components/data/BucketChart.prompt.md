One-line: bar chart card for bucketed totals (weekly volume, sessions per month).

```jsx
<BucketChart title="Weekly volume" note="Every set type, warmups included." points={[{ value: 4200, label: "W12" }, { value: 5100, label: "W13" }]} />
```

Empty says "Not enough data yet." rather than drawing an axis with nothing on it.
