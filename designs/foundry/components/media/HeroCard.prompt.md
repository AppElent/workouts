One-line: the 16:9 photo card for a single object, with copy below the image by default.

```jsx
<HeroCard
  src={routine.image}
  alt="Push day"
  eyebrow="Today's workout"
  title="Push day"
  subtitle="Chest, shoulders, triceps"
  meta="8 exercises · 45 min"
  action={<PrimaryButton label="Start workout" onClick={start} />}
/>
```

`overlay` puts the copy on the photo behind a bottom protection gradient — only for imagery you control. With no `src` the well stays as a flat raised surface and the card still works.
