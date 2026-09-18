One-line: the app's only type primitive — pass a ramp name, never a raw font size.

```jsx
<AppText variant="heading">Bench press</AppText>
<AppText variant="caption">compound · barbell</AppText>
```

Variants: display, title, metric (tabular numbers), heading, body, label, caption. `label` and `caption` already carry the muted colour; override with `style={{ color: "var(--accent)" }}` when a row is an action.
