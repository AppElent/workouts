One-line: the native iOS header, as HTML — for mocks only; in the app the navigator owns it.

```jsx
<NavBar title="Exercises" onBack={back} action={{ label: "Add", onPress: add }} />
<NavBar title="Home" largeTitle />
```

Titles and actions belong to the navigator, outside scrolling content. Tab roots use `largeTitle`; pushed screens don't. Glass values come from `--glass-chrome`/`--glass-blur`, standing in for `systemUltraThinMaterialDark`.
