One-line: the square leading image on a list row, with a typographic fallback.

```jsx
<InsetRow leading={<MediaThumb src={exercise.image} alt={exercise.name} />} title="Bench press" secondary="compound · barbell" chevron />
```

Where images come from: exercise library rows (generated stills, 1:1), nutrition diary rows (Open Food Facts product photos, 1:1), meal photos the user takes. Never let a missing photo shift the row's height.
