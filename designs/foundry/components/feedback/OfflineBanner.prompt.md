One-line: the amber strip that distinguishes a queued set from a saved one.

```jsx
{!connected ? <OfflineBanner message={t.common.offline} /> : null}
```

No dismiss control. It must never overlay the native header or a control — give it real layout space above the chrome.
