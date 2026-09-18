One-line: SF Symbol stand-in for HTML mocks — takes the app's SF name, draws the nearest Lucide glyph.

```jsx
<Icon name="house.fill" size={22} color="var(--accent)" />
```

Intentional addition (the app has no Icon component — it passes `sf=`/`md=` names straight to native). Requires the iconify-icon script tag on the page. Never hand-roll an SVG icon instead.
