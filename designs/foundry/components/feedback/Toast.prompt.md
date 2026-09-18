One-line: the top-anchored message strip for failures (and, rarely, invisible successes).

```jsx
<Toast kind="error" message="Could not log that set." onDismiss={clear} />
```

Positioned absolutely under the status bar, 16px inset both sides, 4s auto-dismiss. Never use it for something already visible on screen.
