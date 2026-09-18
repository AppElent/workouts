One-line: the iOS inset grouped list — use it for any list of objects or settings; it is what stops a screen looking like HTML.

```jsx
<InsetList header="Recent" action={<TextAction label="See all" />}>
  <InsetRow leading={<SportIcon size={30} />} title="Push day" secondary="Mon 14 Sep" value="48 min" chevron onPress={open} />
  <InsetRow leading={<SportIcon size={30} />} title="Leg day" secondary="Sat 12 Sep" value="62 min" chevron onPress={open} />
</InsetList>
```

Rows are 48pt with 0.5px separators inset 16px. Prefer this over a stack of individual Cards — cards are for single objects and summaries, lists are for collections.
