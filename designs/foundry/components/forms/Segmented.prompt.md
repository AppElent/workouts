One-line: 44pt-tall choice row for 2–4 options (language, units, goal direction).

```jsx
<Segmented
  options={[{ value: "en", label: "English" }, { value: "nl", label: "Nederlands" }]}
  value={locale}
  onChange={setLocale}
/>
```

Labels wrap to two lines rather than truncating. Not a platform segmented control — the app needs its own dark palette, including when you are reading the language you are about to leave.
