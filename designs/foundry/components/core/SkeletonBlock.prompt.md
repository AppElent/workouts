One-line: still placeholder blocks shaped like the content they stand in for.

```jsx
<SkeletonGroup label="Loading routines">
  <SkeletonBlock height={52} style={{ borderRadius: "var(--r-card)" }} />
  <SkeletonBlock width="60%" />
</SkeletonGroup>
```

Never animate these. Compose them into the real layout instead of centring a spinner.
