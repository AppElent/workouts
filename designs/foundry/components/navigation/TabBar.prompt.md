One-line: the five-tab native bar, with the home indicator and an optional bottom accessory.

```jsx
<TabBar
  value={tab}
  onChange={setTab}
  accessory={active ? <ActiveSessionBar name="Push day" elapsed="12:04" /> : null}
  tabs={[
    { key: "home", label: "Home", icon: "house.fill" },
    { key: "train", label: "Train", icon: "play.fill" },
    { key: "nutrition", label: "Nutrition", icon: "fork.knife" },
    { key: "progress", label: "Progress", icon: "chart.bar.fill" },
    { key: "profile", label: "Profile", icon: "person.fill" },
  ]}
/>
```

Foundry's five tabs are fixed: Home, Train, Nutrition, Progress, Profile. Adding a sixth area must displace one.
