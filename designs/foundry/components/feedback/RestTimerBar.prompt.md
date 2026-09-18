One-line: the rest countdown pill plus its preset row, pinned under the session content.

```jsx
<RestTimerBar remaining="1:12" defaultSeconds={90} onAdjust={adjust} onDismiss={stop} />
```

Starts after any non-warmup set. Completion is a haptic, not a sound. Give it layout space so it cannot cover the last row or the Log set button.
