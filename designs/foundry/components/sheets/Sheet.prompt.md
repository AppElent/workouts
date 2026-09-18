One-line: the app's bottom sheet — plate calculator, set editor, serving editor all live in one.

```jsx
<Sheet title="Set 3" subtitle="Bench press" doneLabel="Close" onDone={close} detent="medium">
  …
</Sheet>
```

Drag-to-dismiss is native. A sheet with unsaved edits must ask before discarding; a clean one dismisses freely. Nested editors stay in the SAME sheet rather than stacking a new one.
