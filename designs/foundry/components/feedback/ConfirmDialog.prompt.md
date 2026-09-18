One-line: destructive confirmation — on iOS the app uses a system alert; this is the in-app / mock presentation.

```jsx
<ConfirmDialog
  title="Cancel this workout?"
  message="Sets you already logged are kept."
  confirmLabel="Cancel workout"
  cancelLabel="Keep going"
  destructive
  onConfirm={cancel}
  onCancel={close}
/>
```

Every destructive action confirms. The cancel label is the safe verb ("Keep", "Keep going"), never "No".
