One-line: the row that either navigates (›) or expands in place (+/−).

```jsx
<DisclosureRow label="Units" value="kg · km" onPress={openUnits} />
<DisclosureRow label="Advanced" expanded={open} onPress={() => setOpen(!open)} />
```

Never use a GhostButton for either job.
