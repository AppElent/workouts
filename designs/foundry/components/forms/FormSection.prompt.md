One-line: the grouped-rows container — every data-entry screen is a stack of these.

```jsx
<FormSection title="Targets" footer="Applies from today onwards.">
  <InlineNumberFieldRow label="Protein" suffix="g" value="150" />
  <DisclosureRow label="Advanced" expanded={false} onPress={toggle} />
</FormSection>
```

Separators are drawn automatically between children, inset by 16px. Section gap is 24px; row gap inside a group is zero.
