One-line: the 36pt iOS search bar that sits above a filtered list.

```jsx
<SearchField value={query} onChange={setQuery} placeholder="Search exercises" onCancel={clear} />
```

The only boxed input in the system. Filters below it are a horizontally scrolling row of `Chip`s. All filtering is client-side and composes with AND.
