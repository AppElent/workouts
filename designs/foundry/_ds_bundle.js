/* @ds-bundle: {"format":4,"namespace":"FoundryDesignSystem_397633","components":[{"name":"GhostButton","sourcePath":"components/buttons/GhostButton.jsx"},{"name":"PrimaryButton","sourcePath":"components/buttons/PrimaryButton.jsx"},{"name":"TextAction","sourcePath":"components/buttons/TextAction.jsx"},{"name":"AppText","sourcePath":"components/core/AppText.jsx"},{"name":"Card","sourcePath":"components/core/Card.jsx"},{"name":"Chip","sourcePath":"components/core/Chip.jsx"},{"name":"EmptyState","sourcePath":"components/core/EmptyState.jsx"},{"name":"Eyebrow","sourcePath":"components/core/Eyebrow.jsx"},{"name":"Icon","sourcePath":"components/core/Icon.jsx"},{"name":"SkeletonBlock","sourcePath":"components/core/SkeletonBlock.jsx"},{"name":"SkeletonGroup","sourcePath":"components/core/SkeletonBlock.jsx"},{"name":"SportIcon","sourcePath":"components/core/SportIcon.jsx"},{"name":"StatBox","sourcePath":"components/core/StatBox.jsx"},{"name":"BucketChart","sourcePath":"components/data/BucketChart.jsx"},{"name":"DateStepper","sourcePath":"components/data/DateStepper.jsx"},{"name":"InsetList","sourcePath":"components/data/InsetList.jsx"},{"name":"InsetRow","sourcePath":"components/data/InsetList.jsx"},{"name":"NutritionCalendar","sourcePath":"components/data/NutritionCalendar.jsx"},{"name":"ProgressRing","sourcePath":"components/data/ProgressRing.jsx"},{"name":"SwipeableRow","sourcePath":"components/data/SwipeableRow.jsx"},{"name":"TrendChart","sourcePath":"components/data/TrendChart.jsx"},{"name":"ConfirmDialog","sourcePath":"components/feedback/ConfirmDialog.jsx"},{"name":"OfflineBanner","sourcePath":"components/feedback/OfflineBanner.jsx"},{"name":"RestTimerBar","sourcePath":"components/feedback/RestTimerBar.jsx"},{"name":"Toast","sourcePath":"components/feedback/Toast.jsx"},{"name":"AddRow","sourcePath":"components/forms/AddRow.jsx"},{"name":"DisclosureRow","sourcePath":"components/forms/DisclosureRow.jsx"},{"name":"EditableValueRow","sourcePath":"components/forms/EditableValueRow.jsx"},{"name":"FormSection","sourcePath":"components/forms/FormSection.jsx"},{"name":"FormTextField","sourcePath":"components/forms/FormTextField.jsx"},{"name":"GroupedSurface","sourcePath":"components/forms/GroupedSurface.jsx"},{"name":"InlineNumberFieldRow","sourcePath":"components/forms/InlineNumberFieldRow.jsx"},{"name":"SearchField","sourcePath":"components/forms/SearchField.jsx"},{"name":"Segmented","sourcePath":"components/forms/Segmented.jsx"},{"name":"StepperField","sourcePath":"components/forms/StepperField.jsx"},{"name":"HeroCard","sourcePath":"components/media/HeroCard.jsx"},{"name":"MediaThumb","sourcePath":"components/media/MediaThumb.jsx"},{"name":"ActiveSessionBar","sourcePath":"components/navigation/ActiveSessionBar.jsx"},{"name":"NavBar","sourcePath":"components/navigation/NavBar.jsx"},{"name":"TabBar","sourcePath":"components/navigation/TabBar.jsx"},{"name":"Sheet","sourcePath":"components/sheets/Sheet.jsx"}],"sourceHashes":{"components/buttons/GhostButton.jsx":"662d8d03cac1","components/buttons/PrimaryButton.jsx":"266fed1f4e9d","components/buttons/TextAction.jsx":"4f89c9662409","components/core/AppText.jsx":"c01c751160e8","components/core/Card.jsx":"7314635e4e44","components/core/Chip.jsx":"1163e949d17c","components/core/EmptyState.jsx":"8183d02e1948","components/core/Eyebrow.jsx":"0afed74fcbc7","components/core/Icon.jsx":"0308c9c6a98c","components/core/SkeletonBlock.jsx":"0eb4a2236af3","components/core/SportIcon.jsx":"9203de49a74f","components/core/StatBox.jsx":"0a9cd4f3a37d","components/data/BucketChart.jsx":"8faa8b00da8d","components/data/DateStepper.jsx":"0d1e56cb6844","components/data/InsetList.jsx":"da862fd48cd2","components/data/NutritionCalendar.jsx":"2d618103da36","components/data/ProgressRing.jsx":"667bace991b4","components/data/SwipeableRow.jsx":"309ef48fc621","components/data/TrendChart.jsx":"79c72c04f994","components/feedback/ConfirmDialog.jsx":"b0b0ae6f8be6","components/feedback/OfflineBanner.jsx":"bf31580b6648","components/feedback/RestTimerBar.jsx":"6b5abb82f17e","components/feedback/Toast.jsx":"dc3ccc4bbd63","components/forms/AddRow.jsx":"6e4a645afee5","components/forms/DisclosureRow.jsx":"818a73efab22","components/forms/EditableValueRow.jsx":"3a523ef1598b","components/forms/FormSection.jsx":"94648783cef1","components/forms/FormTextField.jsx":"6fcf782e03db","components/forms/GroupedSurface.jsx":"d6db94fc3dd9","components/forms/InlineNumberFieldRow.jsx":"554709217303","components/forms/SearchField.jsx":"d93ea424856c","components/forms/Segmented.jsx":"6a04b14798b3","components/forms/StepperField.jsx":"663ad84cdd68","components/media/HeroCard.jsx":"0a7b2a552e27","components/media/MediaThumb.jsx":"3026646e41b3","components/navigation/ActiveSessionBar.jsx":"85ff195ec54c","components/navigation/NavBar.jsx":"05cf6b71cbe5","components/navigation/TabBar.jsx":"d02ee9945675","components/sheets/Sheet.jsx":"57daef1ccbee","ui_kits/foundry-ios/App.jsx":"aee5b6941e3f","ui_kits/foundry-ios/HomeScreen.jsx":"a1786b724a48","ui_kits/foundry-ios/NutritionScreen.jsx":"de49e230598a","ui_kits/foundry-ios/ProfileScreen.jsx":"2ab4ed77e238","ui_kits/foundry-ios/ProgressScreen.jsx":"537479ebd785","ui_kits/foundry-ios/PushedScreens.jsx":"aa2fa8231873","ui_kits/foundry-ios/SessionScreen.jsx":"f0d7beb4d2a5","ui_kits/foundry-ios/TrainScreen.jsx":"766e61b73482","ui_kits/foundry-ios/data.js":"18ba18b05063"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.FoundryDesignSystem_397633 = window.FoundryDesignSystem_397633 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/buttons/GhostButton.jsx
try { (() => {
/** The quiet bordered capsule. A compatibility primitive, not the default. */
function GhostButton({
  label,
  icon,
  size = "md",
  loading = false,
  disabled,
  fullWidth = false,
  tone = "neutral",
  onClick,
  style
}) {
  const [pressed, setPressed] = React.useState(false);
  const off = disabled || loading;
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: off ? undefined : onClick,
    disabled: off,
    "aria-busy": loading || undefined,
    onPointerDown: () => setPressed(true),
    onPointerUp: () => setPressed(false),
    onPointerLeave: () => setPressed(false),
    style: {
      display: "flex",
      width: fullWidth ? "100%" : "auto",
      alignItems: "center",
      justifyContent: "center",
      gap: "var(--space-sm)",
      borderRadius: "var(--r-pill)",
      border: "var(--border-width) solid var(--border-strong)",
      padding: "0 var(--space-md)",
      minHeight: size === "lg" ? 52 : "var(--control-height)",
      background: pressed && !off ? "var(--surface-2)" : "transparent",
      color: tone === "destructive" ? "var(--danger)" : "var(--text)",
      fontFamily: "var(--font-system)",
      fontSize: size === "lg" ? "var(--type-heading-size)" : "var(--type-control-size)",
      fontWeight: 500,
      cursor: off ? "default" : "pointer",
      opacity: off ? "var(--disabled-opacity)" : 1,
      ...style
    }
  }, loading ? /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true"
  }, "\xB7\xB7\xB7") : icon, label);
}
Object.assign(__ds_scope, { GhostButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/buttons/GhostButton.jsx", error: String((e && e.message) || e) }); }

// components/buttons/PrimaryButton.jsx
try { (() => {
/** The accent-filled capsule. One per screen — the screen's single primary action. */
function PrimaryButton({
  label,
  icon,
  size = "md",
  loading = false,
  disabled,
  fullWidth = true,
  onClick,
  style
}) {
  const [pressed, setPressed] = React.useState(false);
  const off = disabled || loading;
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: off ? undefined : onClick,
    disabled: off,
    "aria-busy": loading || undefined,
    onPointerDown: () => setPressed(true),
    onPointerUp: () => setPressed(false),
    onPointerLeave: () => setPressed(false),
    style: {
      display: "flex",
      width: fullWidth ? "100%" : "auto",
      alignItems: "center",
      justifyContent: "center",
      gap: "var(--space-sm)",
      border: "none",
      borderRadius: "var(--r-pill)",
      minHeight: size === "lg" ? 52 : "var(--control-height)",
      padding: "0 var(--space-lg)",
      background: pressed && !off ? "var(--accent-pressed)" : "var(--accent)",
      color: "var(--on-accent)",
      fontFamily: "var(--font-system)",
      fontSize: size === "lg" ? "var(--type-heading-size)" : "var(--type-control-size)",
      fontWeight: 600,
      letterSpacing: "-0.2px",
      cursor: off ? "default" : "pointer",
      opacity: off ? "var(--disabled-opacity)" : 1,
      ...style
    }
  }, loading ? /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true"
  }, "\xB7\xB7\xB7") : icon, label);
}
Object.assign(__ds_scope, { PrimaryButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/buttons/PrimaryButton.jsx", error: String((e && e.message) || e) }); }

// components/buttons/TextAction.jsx
try { (() => {
/** Cancel, neutral or destructive secondary action. No fill, no border. */
function TextAction({
  label,
  tone = "accent",
  disabled,
  onClick,
  style
}) {
  const [pressed, setPressed] = React.useState(false);
  const color = tone === "destructive" ? "var(--danger)" : tone === "neutral" ? "var(--text)" : "var(--accent-ink)";
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: disabled ? undefined : onClick,
    disabled: disabled,
    onPointerDown: () => setPressed(true),
    onPointerUp: () => setPressed(false),
    onPointerLeave: () => setPressed(false),
    style: {
      minHeight: "var(--hit-target)",
      padding: "0 var(--space-md)",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      borderRadius: "var(--r-md)",
      border: "none",
      background: pressed && !disabled ? "var(--surface-2)" : "transparent",
      color,
      fontFamily: "var(--font-system)",
      fontSize: "var(--type-control-size)",
      fontWeight: 500,
      cursor: disabled ? "default" : "pointer",
      opacity: disabled ? "var(--disabled-opacity)" : 1,
      ...style
    }
  }, label);
}
Object.assign(__ds_scope, { TextAction });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/buttons/TextAction.jsx", error: String((e && e.message) || e) }); }

// components/core/AppText.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const RAMP = {
  display: {
    fontSize: "var(--type-display-size)",
    fontWeight: 800
  },
  title: {
    fontSize: "var(--type-title-size)",
    fontWeight: 800
  },
  metric: {
    fontSize: "var(--type-metric-size)",
    fontWeight: 800,
    fontVariantNumeric: "tabular-nums"
  },
  heading: {
    fontSize: "var(--type-heading-size)",
    fontWeight: 700
  },
  body: {
    fontSize: "var(--type-body-size)",
    fontWeight: 500
  },
  label: {
    fontSize: "var(--type-label-size)",
    fontWeight: 600,
    color: "var(--text-muted)"
  },
  caption: {
    fontSize: "var(--type-caption-size)",
    fontWeight: 500,
    color: "var(--text-muted)"
  },
  /* Native iOS styles — what grouped lists and chrome should use. */
  row: {
    fontSize: "var(--type-row-size)",
    fontWeight: 600,
    letterSpacing: "var(--type-row-tracking)"
  },
  secondary: {
    fontSize: "var(--type-secondary-size)",
    fontWeight: 400,
    color: "var(--text-muted)"
  },
  footnote: {
    fontSize: "var(--type-footnote-size)",
    fontWeight: 400,
    color: "var(--text-muted)"
  }
};

/** The only component allowed to set a font size. Screens pass a ramp name. */
function AppText({
  variant = "body",
  as = "span",
  numberOfLines,
  style,
  children,
  ...rest
}) {
  const Tag = as;
  const clamp = numberOfLines ? {
    display: "-webkit-box",
    WebkitBoxOrient: "vertical",
    WebkitLineClamp: numberOfLines,
    overflow: "hidden"
  } : null;
  return /*#__PURE__*/React.createElement(Tag, _extends({
    style: {
      fontFamily: "var(--font-system)",
      color: "var(--text)",
      lineHeight: "var(--line-body)",
      margin: 0,
      ...RAMP[variant],
      ...clamp,
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { AppText });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/AppText.jsx", error: String((e && e.message) || e) }); }

// components/core/Card.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** A card represents an actual object or summary — never a container for arbitrary form fields. */
function Card({
  tone = "default",
  style,
  children,
  ...rest
}) {
  const tones = {
    default: {
      background: "var(--surface)",
      borderColor: "var(--border)"
    },
    accent: {
      background: "var(--accent-dim)",
      borderColor: "var(--accent-ink)"
    }
  };
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      border: "var(--border-width) solid",
      borderRadius: "var(--r-list)",
      padding: "14px var(--space-md)",
      boxShadow: "var(--shadow-card)",
      fontFamily: "var(--font-system)",
      ...tones[tone],
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Card.jsx", error: String((e && e.message) || e) }); }

// components/core/Chip.jsx
try { (() => {
/** Compact filter or tag. Pills are allowed here and on the primary action only. */
function Chip({
  label,
  active = false,
  color,
  onClick,
  style
}) {
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onClick,
    "aria-pressed": active,
    style: {
      height: 34,
      padding: "0 14px",
      borderRadius: "var(--r-pill)",
      border: "none",
      cursor: onClick ? "pointer" : "default",
      background: active ? "var(--accent)" : "var(--surface-2)",
      color: active ? "var(--on-accent)" : color || "var(--text-muted)",
      fontFamily: "var(--font-system)",
      fontSize: "var(--type-caption-size)",
      fontWeight: 700,
      whiteSpace: "nowrap",
      textTransform: "none",
      ...style
    }
  }, label);
}
Object.assign(__ds_scope, { Chip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Chip.jsx", error: String((e && e.message) || e) }); }

// components/core/EmptyState.jsx
try { (() => {
/** What a region says when it holds nothing yet. */
function EmptyState({
  title,
  body,
  action,
  appearance = "default",
  style
}) {
  const search = appearance === "search";
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: search ? "var(--space-md)" : "var(--space-sm)",
      ...(search ? {
        minHeight: 320,
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--space-xxl) var(--space-xl)",
        textAlign: "center"
      } : {}),
      ...style
    }
  }, search ? /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    style: {
      fontSize: 46,
      color: "var(--text-faint)"
    }
  }, "\u2315") : null, title ? /*#__PURE__*/React.createElement(__ds_scope.AppText, {
    variant: "heading"
  }, title) : null, /*#__PURE__*/React.createElement(__ds_scope.AppText, {
    variant: "caption",
    style: search ? {
      maxWidth: 320
    } : null
  }, body), action ? /*#__PURE__*/React.createElement("div", {
    style: {
      alignSelf: search ? "center" : "flex-start",
      marginTop: "var(--space-xs)"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.GhostButton, {
    label: action.label,
    onClick: action.onPress
  })) : null);
}
Object.assign(__ds_scope, { EmptyState });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/EmptyState.jsx", error: String((e && e.message) || e) }); }

// components/core/Eyebrow.jsx
try { (() => {
/** Section label above a group. Uppercase, tracked, muted. */
function Eyebrow({
  children,
  style
}) {
  return /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-system)",
      fontSize: "var(--type-eyebrow-size)",
      fontWeight: 800,
      letterSpacing: "var(--type-eyebrow-tracking)",
      textTransform: "uppercase",
      color: "var(--text-muted)",
      ...style
    }
  }, children);
}
Object.assign(__ds_scope, { Eyebrow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Eyebrow.jsx", error: String((e && e.message) || e) }); }

// components/core/Icon.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * SF Symbols stand-in for HTML mocks. The app itself renders real SF Symbols
 * through expo-symbols / NativeTabs (`sf="house.fill"`); the web cannot, so
 * this maps the symbol names the app uses onto their nearest Lucide glyph.
 * Load `<script src="https://cdn.jsdelivr.net/npm/iconify-icon@2/dist/iconify-icon.min.js">` once per page.
 */
const SF_TO_LUCIDE = {
  "house.fill": "house",
  "play.fill": "play",
  "fork.knife": "utensils",
  "chart.bar.fill": "chart-column",
  "person.fill": "user",
  magnifyingglass: "search",
  trash: "trash-2",
  "arrow.right": "arrow-right",
  "chevron.right": "chevron-right",
  "chevron.left": "chevron-left",
  plus: "plus",
  minus: "minus",
  xmark: "x",
  ellipsis: "ellipsis",
  "barcode.viewfinder": "scan-barcode",
  "square.and.pencil": "square-pen",
  "timer": "timer",
  "flame.fill": "flame"
};
function Icon({
  name,
  size = 20,
  color = "currentColor",
  style,
  ...rest
}) {
  const glyph = SF_TO_LUCIDE[name] || name;
  return /*#__PURE__*/React.createElement("iconify-icon", _extends({
    icon: `lucide:${glyph}`,
    width: size,
    height: size,
    style: {
      color,
      display: "inline-flex",
      flex: "0 0 auto",
      ...style
    }
  }, rest));
}
Object.assign(__ds_scope, { Icon });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Icon.jsx", error: String((e && e.message) || e) }); }

// components/core/SkeletonBlock.jsx
try { (() => {
/** Deliberately still: no shimmer, so Reduce Motion needs no branch. */
function SkeletonBlock({
  width = "100%",
  height = 14,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width,
      height,
      background: "var(--surface-2)",
      borderRadius: Math.min(height / 2, 8),
      ...style
    }
  });
}

/** Wraps a set of blocks so a screen reader hears one label, not eleven rectangles. */
function SkeletonGroup({
  label,
  children,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    "aria-label": label,
    role: "status",
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-md)",
      ...style
    }
  }, children);
}
Object.assign(__ds_scope, { SkeletonBlock, SkeletonGroup });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/SkeletonBlock.jsx", error: String((e && e.message) || e) }); }

// components/core/SportIcon.jsx
try { (() => {
const SPORTS = {
  strength: {
    glyph: "S",
    color: "var(--sport-strength)",
    dim: "var(--sport-strength-dim)"
  },
  running: {
    glyph: "R",
    color: "var(--sport-running)",
    dim: "var(--sport-running-dim)"
  },
  cycling: {
    glyph: "C",
    color: "var(--sport-cycling)",
    dim: "var(--sport-cycling-dim)"
  },
  wod: {
    glyph: "W",
    color: "var(--sport-wod)",
    dim: "var(--sport-wod-dim)"
  }
};

/** The tinted tile that stands in for an activity type. Letter glyph, not an illustration. */
function SportIcon({
  sport = "strength",
  size = 34,
  style
}) {
  const meta = SPORTS[sport] || SPORTS.strength;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: size,
      height: size,
      borderRadius: size * 0.32,
      background: meta.dim,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flex: "0 0 auto",
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-system)",
      color: meta.color,
      fontWeight: 800,
      fontSize: size * 0.4
    }
  }, meta.glyph));
}
Object.assign(__ds_scope, { SportIcon });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/SportIcon.jsx", error: String((e && e.message) || e) }); }

// components/core/StatBox.jsx
try { (() => {
/** One number that is the point, with its uppercase label under it. */
function StatBox({
  value,
  unit,
  label,
  color,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      background: "var(--surface)",
      borderRadius: 16,
      padding: "15px 13px",
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-xs)",
      fontFamily: "var(--font-system)",
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--type-stat-value-size)",
      fontWeight: 800,
      color: color || "var(--text)",
      fontVariantNumeric: "tabular-nums"
    }
  }, value, unit ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--type-caption-size)",
      fontWeight: 700,
      color: "var(--text-muted)"
    }
  }, " ", unit) : null), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "var(--type-stat-label-size)",
      fontWeight: 800,
      letterSpacing: "var(--type-stat-label-tracking)",
      textTransform: "uppercase",
      color: "var(--text-muted)"
    }
  }, label));
}
Object.assign(__ds_scope, { StatBox });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/StatBox.jsx", error: String((e && e.message) || e) }); }

// components/data/BucketChart.jsx
try { (() => {
/** Discrete buckets — a week's volume, a month's sessions. Bars, rounded top. */
function BucketChart({
  title,
  note,
  points = [],
  color = "var(--accent-ink)",
  height = 160,
  style
}) {
  const max = Math.max(1, ...points.map(p => p.value));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-xs)",
      background: "var(--surface)",
      border: "var(--border-width) solid var(--border)",
      borderRadius: "var(--r-lg)",
      padding: "var(--space-md)",
      overflow: "hidden",
      ...style
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.AppText, {
    variant: "caption",
    style: {
      fontWeight: 800,
      letterSpacing: 1,
      textTransform: "uppercase"
    }
  }, title), note ? /*#__PURE__*/React.createElement(__ds_scope.AppText, {
    variant: "caption"
  }, note) : null, points.length === 0 ? /*#__PURE__*/React.createElement(__ds_scope.AppText, {
    variant: "caption",
    style: {
      padding: "var(--space-lg) 0",
      textAlign: "center"
    }
  }, "Not enough data yet.") : /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "flex-end",
      gap: 14,
      height,
      borderBottom: "var(--border-width) solid var(--border)",
      paddingTop: "var(--space-sm)"
    }
  }, points.map((p, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    style: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 6,
      flex: "0 0 auto"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 16,
      height: Math.max(3, p.value / max * (height - 26)),
      background: color,
      borderRadius: "3px 3px 0 0"
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-system)",
      fontSize: 9,
      color: "var(--text-faint)"
    }
  }, p.label)))));
}
Object.assign(__ds_scope, { BucketChart });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/BucketChart.jsx", error: String((e && e.message) || e) }); }

// components/data/DateStepper.jsx
try { (() => {
/** Previous/next around a formatted date. Tapping the date opens a picker. */
function DateStepper({
  label,
  secondaryLabel,
  onPrevious,
  onNext,
  onChooseDate,
  style
}) {
  const btn = {
    minWidth: "var(--hit-target)",
    minHeight: "var(--hit-target)",
    padding: 4,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "var(--r-pill)",
    border: "none",
    background: "transparent",
    color: "var(--accent-ink)",
    fontFamily: "var(--font-system)",
    fontSize: "var(--type-heading-size)",
    fontWeight: 700,
    cursor: "pointer"
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: "var(--space-sm)",
      ...style
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-label": "Previous day",
    onClick: onPrevious,
    style: btn
  }, "\u2039"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onChooseDate,
    style: {
      flex: 1,
      minHeight: "var(--hit-target)",
      border: "none",
      background: "transparent",
      cursor: onChooseDate ? "pointer" : "default",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.AppText, {
    style: {
      textAlign: "center",
      fontWeight: 700
    }
  }, label), secondaryLabel ? /*#__PURE__*/React.createElement(__ds_scope.AppText, {
    variant: "caption",
    style: {
      textAlign: "center"
    }
  }, secondaryLabel) : null), /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-label": "Next day",
    onClick: onNext,
    style: btn
  }, "\u203A"));
}
Object.assign(__ds_scope, { DateStepper });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/DateStepper.jsx", error: String((e && e.message) || e) }); }

// components/data/InsetList.jsx
try { (() => {
/**
 * The iOS inset grouped list — the shape that makes a screen read as an app
 * rather than a stack of web cards. Hairline separators are inset from the
 * leading content, not full-bleed, and the row itself is 48pt with a 17/600
 * title over a 15pt secondary line.
 */
function InsetList({
  header,
  footer,
  action,
  children,
  style
}) {
  const rows = React.Children.toArray(children);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-sm)",
      ...style
    }
  }, header || action ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "var(--space-sm)"
    }
  }, header ? /*#__PURE__*/React.createElement(__ds_scope.AppText, {
    style: {
      fontSize: "var(--type-eyebrow-size)",
      fontWeight: 600,
      letterSpacing: "var(--type-eyebrow-tracking)",
      textTransform: "uppercase",
      color: "var(--text-muted)"
    }
  }, header) : /*#__PURE__*/React.createElement("span", null), action) : null, /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--surface)",
      borderRadius: "var(--r-list)",
      border: "var(--hairline-width) solid var(--border)",
      boxShadow: "var(--shadow-card)",
      overflow: "hidden"
    }
  }, rows.map((row, i) => /*#__PURE__*/React.createElement(React.Fragment, {
    key: i
  }, i > 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      height: "var(--hairline-width)",
      marginLeft: "var(--separator-inset)",
      background: "var(--separator)"
    }
  }) : null, row))), footer ? /*#__PURE__*/React.createElement(__ds_scope.AppText, {
    variant: "footnote"
  }, footer) : null);
}

/** One row of an InsetList. Leading media, title + secondary, trailing value, chevron. */
function InsetRow({
  leading,
  title,
  secondary,
  value,
  chevron = false,
  destructive = false,
  onPress,
  style
}) {
  const [pressed, setPressed] = React.useState(false);
  const interactive = Boolean(onPress);
  return /*#__PURE__*/React.createElement("div", {
    role: interactive ? "button" : undefined,
    tabIndex: interactive ? 0 : undefined,
    onClick: onPress,
    onPointerDown: () => setPressed(true),
    onPointerUp: () => setPressed(false),
    onPointerLeave: () => setPressed(false),
    style: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      minHeight: "var(--row-min-height)",
      padding: "8px var(--space-md)",
      background: pressed && interactive ? "var(--surface-2)" : "transparent",
      cursor: interactive ? "pointer" : "default",
      ...style
    }
  }, leading, /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      minWidth: 0,
      display: "flex",
      flexDirection: "column",
      gap: 1
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.AppText, {
    variant: "row",
    numberOfLines: 1,
    style: destructive ? {
      color: "var(--danger)"
    } : null
  }, title), secondary ? /*#__PURE__*/React.createElement(__ds_scope.AppText, {
    variant: "footnote"
  }, secondary) : null), value ? /*#__PURE__*/React.createElement(__ds_scope.AppText, {
    variant: "secondary",
    style: {
      fontVariantNumeric: "tabular-nums"
    }
  }, value) : null, chevron ? /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    style: {
      color: "var(--text-faint)",
      fontSize: 17,
      fontFamily: "var(--font-system)"
    }
  }, "\u203A") : null);
}
Object.assign(__ds_scope, { InsetList, InsetRow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/InsetList.jsx", error: String((e && e.message) || e) }); }

// components/data/NutritionCalendar.jsx
try { (() => {
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Month grid, Monday-first. Cells are 44pt minimum and announce their state. */
function NutritionCalendar({
  monthLabel = "September 2026",
  offset = 1,
  days = 30,
  selected,
  today,
  onSelect,
  style
}) {
  const cells = [...Array.from({
    length: offset
  }, () => null), ...Array.from({
    length: days
  }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);
  const nav = {
    minWidth: "var(--hit-target)",
    minHeight: "var(--hit-target)",
    border: "none",
    background: "transparent",
    color: "var(--accent-ink)",
    fontSize: 26,
    fontFamily: "var(--font-system)",
    cursor: "pointer",
    borderRadius: "var(--r-pill)"
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-sm)",
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-label": "Previous month",
    style: nav
  }, "\u2039"), /*#__PURE__*/React.createElement(__ds_scope.AppText, {
    variant: "heading",
    style: {
      flex: 1,
      textAlign: "center"
    }
  }, monthLabel), /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-label": "Next month",
    style: nav
  }, "\u203A")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex"
    }
  }, WEEKDAYS.map(d => /*#__PURE__*/React.createElement(__ds_scope.AppText, {
    key: d,
    variant: "caption",
    style: {
      flex: 1,
      textAlign: "center",
      fontWeight: 700
    }
  }, d))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(7, 1fr)"
    }
  }, cells.map((day, i) => {
    if (day === null) return /*#__PURE__*/React.createElement("span", {
      key: `e${i}`,
      style: {
        minHeight: "var(--hit-target)"
      }
    });
    const isSelected = day === selected;
    const isToday = day === today;
    return /*#__PURE__*/React.createElement("button", {
      key: day,
      type: "button",
      "aria-pressed": isSelected,
      onClick: () => onSelect && onSelect(day),
      style: {
        minHeight: "var(--hit-target)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "var(--r-pill)",
        border: isToday && !isSelected ? "var(--border-width) solid var(--accent-ink)" : "var(--border-width) solid transparent",
        background: isSelected ? "var(--accent)" : "transparent",
        color: isSelected ? "var(--on-accent)" : "var(--text)",
        fontFamily: "var(--font-system)",
        fontSize: "var(--type-body-size)",
        fontWeight: isSelected ? 800 : 500,
        cursor: "pointer"
      }
    }, day);
  })), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => onSelect && today && onSelect(today),
    style: {
      alignSelf: "center",
      padding: "var(--space-sm)",
      minHeight: "var(--hit-target)",
      border: "none",
      background: "transparent",
      color: "var(--accent-ink)",
      fontFamily: "var(--font-system)",
      fontWeight: 500,
      cursor: "pointer"
    }
  }, "Today"));
}
Object.assign(__ds_scope, { NutritionCalendar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/NutritionCalendar.jsx", error: String((e && e.message) || e) }); }

// components/data/ProgressRing.jsx
try { (() => {
/** Closed-ring progress. One series, accent ink; the hole carries the number. */
function ProgressRing({
  value = 0,
  target = 1,
  size = 56,
  thickness = 6,
  color = "var(--accent-ink)",
  track = "var(--surface-2)",
  label,
  style
}) {
  const pct = Math.max(0, Math.min(1, target ? value / target : 0));
  return /*#__PURE__*/React.createElement("div", {
    role: "img",
    "aria-label": label || value + " of " + target,
    style: {
      width: size,
      height: size,
      borderRadius: "50%",
      flex: "0 0 auto",
      display: "grid",
      placeItems: "center",
      background: "conic-gradient(" + color + " 0 " + pct * 100 + "%, " + track + " 0)",
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: size - thickness * 2,
      height: size - thickness * 2,
      borderRadius: "50%",
      background: "var(--surface)",
      display: "grid",
      placeItems: "center"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.AppText, {
    style: {
      fontSize: Math.round(size * 0.26),
      fontWeight: 700,
      fontVariantNumeric: "tabular-nums"
    }
  }, value, target ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: Math.round(size * 0.17),
      fontWeight: 400,
      color: "var(--text-muted)"
    }
  }, "/", target) : null)));
}
Object.assign(__ds_scope, { ProgressRing });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/ProgressRing.jsx", error: String((e && e.message) || e) }); }

// components/data/SwipeableRow.jsx
try { (() => {
/**
 * A row whose actions are reachable three ways: swipe reveals (never commits),
 * long press opens a menu, and screen readers get named custom actions. Travel
 * is clamped to the buttons' width, so there is no full-swipe-to-delete.
 */
function SwipeableRow({
  actions = [],
  menuTitle,
  open = false,
  onToggle,
  children,
  style
}) {
  const swipeActions = actions.filter(a => a.swipe !== false);
  const width = 88 * swipeActions.length;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      overflow: "hidden",
      borderRadius: "var(--r-card)",
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      right: 0,
      top: 0,
      bottom: 0,
      width,
      display: "flex"
    }
  }, swipeActions.map(action => /*#__PURE__*/React.createElement("button", {
    key: action.key,
    type: "button",
    onClick: action.onPress,
    style: {
      width: 88,
      minHeight: "var(--hit-target)",
      border: "none",
      background: action.destructive ? "var(--danger-soft)" : "var(--surface-2)",
      color: action.destructive ? "var(--danger)" : "var(--text)",
      fontFamily: "var(--font-system)",
      fontSize: "var(--type-caption-size)",
      fontWeight: 700,
      cursor: "pointer"
    }
  }, action.label))), /*#__PURE__*/React.createElement("div", {
    onClick: onToggle,
    style: {
      position: "relative",
      background: "var(--surface)",
      transform: open ? `translateX(-${width}px)` : "translateX(0)",
      transition: "transform var(--dur-base) var(--ease-ios)"
    }
  }, children), /*#__PURE__*/React.createElement("span", {
    className: "sr-only",
    style: {
      position: "absolute",
      width: 1,
      height: 1,
      overflow: "hidden",
      clip: "rect(0 0 0 0)"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.AppText, {
    variant: "caption"
  }, menuTitle)));
}
Object.assign(__ds_scope, { SwipeableRow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/SwipeableRow.jsx", error: String((e && e.message) || e) }); }

// components/data/TrendChart.jsx
try { (() => {
/** A trend over time. Needs two points — a single dot is not a line. */
function TrendChart({
  title,
  note,
  points = [],
  color = "var(--accent-ink)",
  height = 160,
  style
}) {
  const values = points.map(p => p.value);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const coords = points.map((p, i) => {
    const x = points.length > 1 ? i / (points.length - 1) * 100 : 50;
    const y = 100 - (p.value - min) / span * 88 - 6;
    return {
      x,
      y,
      ...p
    };
  });
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-xs)",
      background: "var(--surface)",
      border: "var(--border-width) solid var(--border)",
      borderRadius: "var(--r-lg)",
      padding: "var(--space-md)",
      overflow: "hidden",
      ...style
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.AppText, {
    variant: "caption",
    style: {
      fontWeight: 800,
      letterSpacing: 1,
      textTransform: "uppercase"
    }
  }, title), note ? /*#__PURE__*/React.createElement(__ds_scope.AppText, {
    variant: "caption"
  }, note) : null, points.length < 2 ? /*#__PURE__*/React.createElement(__ds_scope.AppText, {
    variant: "caption",
    style: {
      padding: "var(--space-lg) 0",
      textAlign: "center"
    }
  }, "Not enough data yet.") : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 100 100",
    preserveAspectRatio: "none",
    style: {
      width: "100%",
      height,
      borderBottom: "var(--border-width) solid var(--border)"
    }
  }, /*#__PURE__*/React.createElement("polyline", {
    points: coords.map(c => `${c.x},${c.y}`).join(" "),
    fill: "none",
    stroke: color,
    strokeWidth: "1",
    vectorEffect: "non-scaling-stroke"
  }), coords.map((c, i) => /*#__PURE__*/React.createElement("circle", {
    key: i,
    cx: c.x,
    cy: c.y,
    r: "1.2",
    fill: color,
    vectorEffect: "non-scaling-stroke"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between"
    }
  }, coords.map((c, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    style: {
      fontFamily: "var(--font-system)",
      fontSize: 9,
      color: "var(--text-faint)"
    }
  }, c.label)))));
}
Object.assign(__ds_scope, { TrendChart });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/TrendChart.jsx", error: String((e && e.message) || e) }); }

// components/feedback/ConfirmDialog.jsx
try { (() => {
/** The only way a destructive action asks. Confirm labels are verbs, never "OK". */
function ConfirmDialog({
  title,
  message,
  confirmLabel,
  cancelLabel = "Keep",
  destructive = false,
  onConfirm,
  onCancel,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      background: "var(--scrim)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "var(--space-lg)",
      zIndex: 40,
      ...style
    },
    onClick: onCancel
  }, /*#__PURE__*/React.createElement("div", {
    role: "alertdialog",
    "aria-label": title,
    onClick: e => e.stopPropagation(),
    style: {
      width: "100%",
      maxWidth: 380,
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-sm)",
      background: "var(--surface)",
      border: "var(--border-width) solid var(--border)",
      borderRadius: "var(--r-sheet)",
      padding: "var(--space-lg)",
      boxShadow: "var(--shadow-menu)"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.AppText, {
    variant: "heading"
  }, title), message ? /*#__PURE__*/React.createElement(__ds_scope.AppText, {
    variant: "caption"
  }, message) : null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: "var(--space-sm)",
      marginTop: "var(--space-sm)"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.GhostButton, {
    label: cancelLabel,
    onClick: onCancel,
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onConfirm,
    style: {
      flex: 1,
      minHeight: "var(--hit-target)",
      borderRadius: "var(--r-pill)",
      border: "none",
      padding: "0 var(--space-md)",
      background: destructive ? "var(--danger)" : "var(--accent)",
      color: destructive ? "var(--text)" : "var(--on-accent)",
      fontFamily: "var(--font-system)",
      fontSize: "var(--type-body-size)",
      fontWeight: 800,
      cursor: "pointer"
    }
  }, confirmLabel))));
}
Object.assign(__ds_scope, { ConfirmDialog });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/ConfirmDialog.jsx", error: String((e && e.message) || e) }); }

// components/feedback/OfflineBanner.jsx
try { (() => {
/** Takes layout space, has no dismiss, and disappears when the condition does. */
function OfflineBanner({
  message = "Offline — changes sync when you reconnect",
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    role: "status",
    style: {
      display: "flex",
      justifyContent: "center",
      padding: "var(--space-xs) var(--space-md)",
      background: "var(--warn-soft)",
      borderBottom: "var(--border-width) solid var(--warn-border)",
      ...style
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.AppText, {
    variant: "caption",
    style: {
      color: "var(--warn)",
      fontWeight: 600
    }
  }, message));
}
Object.assign(__ds_scope, { OfflineBanner });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/OfflineBanner.jsx", error: String((e && e.message) || e) }); }

// components/feedback/RestTimerBar.jsx
try { (() => {
const PRESETS = [60, 90, 120, 180];

/** Between-sets countdown. Occupies its own space — it never covers Log set. */
function RestTimerBar({
  remaining = "1:30",
  paused = false,
  done = false,
  defaultSeconds = 90,
  onAdjust,
  onTogglePause,
  onDismiss,
  onChooseDefault,
  style
}) {
  const glyph = {
    border: "none",
    background: "transparent",
    color: "var(--text-muted)",
    fontFamily: "var(--font-system)",
    fontSize: 13,
    fontWeight: 800,
    cursor: "pointer",
    minWidth: 36,
    minHeight: 36
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-xs)",
      padding: "var(--space-xs) var(--space-md)",
      background: "var(--bg)",
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "var(--space-sm)",
      minHeight: 52,
      padding: "0 var(--space-md)",
      borderRadius: "var(--r-pill)",
      background: "var(--surface-2)",
      border: "var(--border-width) solid",
      borderColor: done ? "var(--accent-ink)" : "var(--border-strong)"
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-label": "Subtract 15 seconds",
    onClick: () => onAdjust && onAdjust(-15),
    style: glyph
  }, "\u221215"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onTogglePause,
    style: {
      ...glyph,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      minWidth: 88
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.AppText, {
    style: {
      fontSize: 18,
      fontWeight: 800,
      fontVariantNumeric: "tabular-nums"
    }
  }, done ? "Rest over" : remaining), paused ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 9,
      color: "var(--text-muted)"
    }
  }, "paused") : null), /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-label": "Add 15 seconds",
    onClick: () => onAdjust && onAdjust(15),
    style: glyph
  }, "+15"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-label": "Dismiss rest timer",
    onClick: onDismiss,
    style: {
      ...glyph,
      fontSize: 15
    }
  }, "\u2715")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: "var(--space-xs)",
      justifyContent: "center"
    }
  }, PRESETS.map(seconds => {
    const active = seconds === defaultSeconds;
    return /*#__PURE__*/React.createElement("button", {
      key: seconds,
      type: "button",
      onClick: () => onChooseDefault && onChooseDefault(seconds),
      style: {
        padding: "4px 10px",
        borderRadius: "var(--r-pill)",
        border: "none",
        background: active ? "var(--accent)" : "var(--surface)",
        color: active ? "var(--on-accent)" : "var(--text-muted)",
        fontFamily: "var(--font-system)",
        fontSize: 10,
        fontWeight: 700,
        cursor: "pointer"
      }
    }, seconds, "s");
  })));
}
Object.assign(__ds_scope, { RestTimerBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/RestTimerBar.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Toast.jsx
try { (() => {
/** A mutation that fails must say so. Success toasts are the exception, not the habit. */
function Toast({
  kind = "error",
  message,
  onDismiss,
  style
}) {
  const tone = kind === "error" ? {
    background: "var(--danger-soft)",
    borderColor: "var(--danger)"
  } : {
    background: "var(--accent-dim)",
    borderColor: "var(--accent-ink)"
  };
  return /*#__PURE__*/React.createElement("div", {
    role: kind === "error" ? "alert" : "status",
    onClick: onDismiss,
    style: {
      borderRadius: "var(--r-lg)",
      border: "var(--border-width) solid",
      padding: "10px var(--space-md)",
      cursor: onDismiss ? "pointer" : "default",
      ...tone,
      ...style
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.AppText, null, message));
}
Object.assign(__ds_scope, { Toast });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Toast.jsx", error: String((e && e.message) || e) }); }

// components/forms/AddRow.jsx
try { (() => {
/** Add an item inside the section it affects. */
function AddRow({
  label,
  onPress,
  style
}) {
  const [pressed, setPressed] = React.useState(false);
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onPress,
    onPointerDown: () => setPressed(true),
    onPointerUp: () => setPressed(false),
    onPointerLeave: () => setPressed(false),
    style: {
      width: "100%",
      minHeight: "var(--row-min-height)",
      padding: "0 var(--space-md)",
      display: "flex",
      alignItems: "center",
      gap: "var(--space-sm)",
      border: "none",
      background: pressed ? "var(--surface-2)" : "transparent",
      cursor: "pointer",
      textAlign: "left",
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--accent-ink)",
      fontSize: 19,
      fontWeight: 700,
      fontFamily: "var(--font-system)"
    }
  }, "\uFF0B"), /*#__PURE__*/React.createElement(__ds_scope.AppText, {
    style: {
      flex: 1,
      color: "var(--accent-ink)",
      fontWeight: 500,
      fontSize: "var(--type-row-size)"
    }
  }, label));
}
Object.assign(__ds_scope, { AddRow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/AddRow.jsx", error: String((e && e.message) || e) }); }

// components/forms/DisclosureRow.jsx
try { (() => {
/** Progressive disclosure, or navigation to more detail. */
function DisclosureRow({
  label,
  value,
  expanded,
  onPress,
  style
}) {
  const [pressed, setPressed] = React.useState(false);
  const glyph = expanded === undefined ? "›" : expanded ? "−" : "+";
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onPress,
    "aria-expanded": expanded === undefined ? undefined : expanded,
    onPointerDown: () => setPressed(true),
    onPointerUp: () => setPressed(false),
    onPointerLeave: () => setPressed(false),
    style: {
      width: "100%",
      minHeight: "var(--row-min-height)",
      padding: "0 var(--space-md)",
      display: "flex",
      alignItems: "center",
      gap: "var(--space-sm)",
      border: "none",
      background: pressed ? "var(--surface-2)" : "transparent",
      cursor: "pointer",
      textAlign: "left",
      ...style
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.AppText, {
    variant: "row",
    style: {
      flex: 1,
      minWidth: 0
    }
  }, label), value ? /*#__PURE__*/React.createElement(__ds_scope.AppText, {
    variant: "secondary",
    style: {
      color: "var(--text-muted)"
    }
  }, value) : null, /*#__PURE__*/React.createElement("span", {
    style: {
      minWidth: 20,
      textAlign: "center",
      color: "var(--accent-ink)",
      fontSize: 20,
      fontWeight: 700,
      fontFamily: "var(--font-system)"
    }
  }, glyph));
}
Object.assign(__ds_scope, { DisclosureRow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/DisclosureRow.jsx", error: String((e && e.message) || e) }); }

// components/forms/EditableValueRow.jsx
try { (() => {
/** A saved repeated value, summarised in one row, with an optional visible delete. */
function EditableValueRow({
  label,
  value,
  deleteLabel,
  onPress,
  onDelete,
  style
}) {
  const [pressed, setPressed] = React.useState(false);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "stretch",
      ...style
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onPress,
    onPointerDown: () => setPressed(true),
    onPointerUp: () => setPressed(false),
    onPointerLeave: () => setPressed(false),
    style: {
      flex: 1,
      minHeight: 56,
      padding: "var(--space-sm) 0 var(--space-sm) var(--space-md)",
      display: "flex",
      alignItems: "center",
      gap: "var(--space-sm)",
      border: "none",
      background: pressed ? "var(--surface-2)" : "transparent",
      cursor: "pointer",
      textAlign: "left"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      minWidth: 0,
      display: "flex",
      flexDirection: "column",
      gap: 2
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.AppText, {
    variant: "row"
  }, label), /*#__PURE__*/React.createElement(__ds_scope.AppText, {
    variant: "caption"
  }, value)), /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--text-faint)",
      fontSize: 24,
      fontFamily: "var(--font-system)"
    }
  }, "\u203A")), onDelete && deleteLabel ? /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onDelete,
    "aria-label": `${deleteLabel} ${label}`,
    style: {
      minWidth: 72,
      padding: "0 var(--space-sm)",
      border: "none",
      background: "transparent",
      color: "var(--danger)",
      fontFamily: "var(--font-system)",
      fontSize: "var(--type-caption-size)",
      fontWeight: 700,
      cursor: "pointer"
    }
  }, deleteLabel) : null);
}
Object.assign(__ds_scope, { EditableValueRow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/EditableValueRow.jsx", error: String((e && e.message) || e) }); }

// components/forms/FormSection.jsx
try { (() => {
/** A grouped section: label outside, hairline separators between rows inside. */
function FormSection({
  title,
  footer,
  children,
  style
}) {
  const rows = React.Children.toArray(children);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-sm)",
      ...style
    }
  }, title ? /*#__PURE__*/React.createElement(__ds_scope.AppText, {
    variant: "label"
  }, title) : null, /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--surface)",
      borderRadius: "var(--r-list)",
      overflow: "hidden",
      border: "var(--hairline-width) solid var(--border)",
      boxShadow: "var(--shadow-card)"
    }
  }, rows.map((row, i) => /*#__PURE__*/React.createElement(React.Fragment, {
    key: i
  }, i > 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      height: "var(--hairline-width)",
      marginLeft: "var(--separator-inset)",
      background: "var(--separator)"
    }
  }) : null, row))), footer ? /*#__PURE__*/React.createElement(__ds_scope.AppText, {
    variant: "caption"
  }, footer) : null);
}
Object.assign(__ds_scope, { FormSection });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/FormSection.jsx", error: String((e && e.message) || e) }); }

// components/forms/FormTextField.jsx
try { (() => {
/**
 * Text entry inside a grouped section.
 *
 * iOS does not box a field inside a grouped list — the row IS the field. The
 * label sits left, the text is right-aligned and borderless, and the only
 * focus affordance is the caret plus the keyboard. A bordered rectangle inside
 * an already-bordered group is the single strongest "this is a web form" tell,
 * so `inline` is the default and `stacked` exists only for values too long to
 * share a line (a note, a URL).
 */
function FormTextField({
  label,
  value,
  placeholder,
  error,
  type = "text",
  layout = "inline",
  multiline = false,
  onChange,
  style
}) {
  const field = {
    flex: 1,
    minWidth: 0,
    border: "none",
    outline: "none",
    background: "transparent",
    color: "var(--text)",
    caretColor: "var(--accent-ink)",
    fontFamily: "var(--font-system)",
    fontSize: "var(--type-row-size)",
    fontWeight: 400,
    padding: 0,
    textAlign: layout === "inline" && !multiline ? "right" : "left"
  };
  const input = multiline ? /*#__PURE__*/React.createElement("textarea", {
    rows: 3,
    value: value,
    placeholder: placeholder,
    "aria-label": label,
    onChange: onChange ? e => onChange(e.target.value) : undefined,
    style: {
      ...field,
      resize: "none",
      lineHeight: "var(--line-body)"
    }
  }) : /*#__PURE__*/React.createElement("input", {
    type: type,
    value: value,
    placeholder: placeholder,
    "aria-label": label,
    "aria-invalid": error ? true : undefined,
    onChange: onChange ? e => onChange(e.target.value) : undefined,
    style: field
  });
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "0 var(--space-md)",
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: "var(--row-min-height)",
      padding: layout === "inline" && !multiline ? "8px 0" : "10px 0",
      display: "flex",
      flexDirection: layout === "inline" && !multiline ? "row" : "column",
      alignItems: layout === "inline" && !multiline ? "center" : "stretch",
      gap: layout === "inline" && !multiline ? 12 : 4
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.AppText, {
    variant: "row",
    style: {
      fontWeight: 400,
      flex: layout === "inline" && !multiline ? "0 0 auto" : undefined
    }
  }, label), input), error ? /*#__PURE__*/React.createElement(__ds_scope.AppText, {
    variant: "footnote",
    role: "alert",
    style: {
      display: "block",
      color: "var(--danger)",
      paddingBottom: 8
    }
  }, error) : null);
}
Object.assign(__ds_scope, { FormTextField });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/FormTextField.jsx", error: String((e && e.message) || e) }); }

// components/forms/GroupedSurface.jsx
try { (() => {
/** A composed summary that must stay one visual object — no row dividers. */
function GroupedSurface({
  children,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--surface)",
      borderRadius: "var(--r-lg)",
      padding: "var(--space-md)",
      ...style
    }
  }, children);
}
Object.assign(__ds_scope, { GroupedSurface });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/GroupedSurface.jsx", error: String((e && e.message) || e) }); }

// components/forms/InlineNumberFieldRow.jsx
try { (() => {
/**
 * Numeric entry as a row: label left, right-aligned tabular number, unit, and
 * an optional accessory. Borderless like `FormTextField` — the number sits on
 * the group's own surface rather than in a box of its own.
 */
function InlineNumberFieldRow({
  label,
  value,
  suffix,
  accessory,
  onChange,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: "var(--row-min-height)",
      padding: "8px var(--space-md)",
      display: "flex",
      alignItems: "center",
      gap: 12,
      ...style
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.AppText, {
    variant: "row",
    style: {
      fontWeight: 400,
      flex: 1,
      minWidth: 0
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 6,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("input", {
    inputMode: "decimal",
    value: value,
    "aria-label": label,
    onChange: onChange ? e => onChange(e.target.value) : undefined,
    style: {
      width: 64,
      border: "none",
      outline: "none",
      background: "transparent",
      color: "var(--text)",
      caretColor: "var(--accent-ink)",
      fontFamily: "var(--font-system)",
      fontSize: "var(--type-row-size)",
      fontWeight: 400,
      fontVariantNumeric: "tabular-nums",
      textAlign: "right",
      padding: 0
    }
  }), suffix ? /*#__PURE__*/React.createElement(__ds_scope.AppText, {
    variant: "secondary",
    style: {
      minWidth: 26
    }
  }, suffix) : null, accessory));
}
Object.assign(__ds_scope, { InlineNumberFieldRow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/InlineNumberFieldRow.jsx", error: String((e && e.message) || e) }); }

// components/forms/SearchField.jsx
try { (() => {
/**
 * The iOS search bar: a 36pt rounded field on the raised surface with a
 * leading magnifier and a clear button once there is text. This is the one
 * input that IS a box on iOS — it sits above a list rather than inside a
 * grouped section.
 */
function SearchField({
  value = "",
  placeholder = "Search",
  onChange,
  onCancel,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0,
      height: 36,
      display: "flex",
      alignItems: "center",
      gap: 6,
      padding: "0 8px",
      borderRadius: 10,
      background: "var(--surface-2)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    style: {
      color: "var(--text-faint)",
      fontSize: 15,
      fontFamily: "var(--font-system)"
    }
  }, "\u2315"), /*#__PURE__*/React.createElement("input", {
    type: "search",
    value: value,
    placeholder: placeholder,
    "aria-label": placeholder,
    onChange: onChange ? e => onChange(e.target.value) : undefined,
    style: {
      flex: 1,
      minWidth: 0,
      border: "none",
      outline: "none",
      background: "transparent",
      color: "var(--text)",
      caretColor: "var(--accent-ink)",
      fontFamily: "var(--font-system)",
      fontSize: "var(--type-row-size)",
      fontWeight: 400,
      padding: 0,
      appearance: "none",
      WebkitAppearance: "none"
    }
  }), value ? /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-label": "Clear search",
    onClick: () => onChange && onChange(""),
    style: {
      border: "none",
      background: "transparent",
      color: "var(--text-faint)",
      fontFamily: "var(--font-system)",
      fontSize: 14,
      cursor: "pointer",
      padding: 0,
      minWidth: 20
    }
  }, "\u2715") : null), onCancel && value ? /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onCancel,
    style: {
      border: "none",
      background: "transparent",
      color: "var(--accent-ink)",
      fontFamily: "var(--font-system)",
      fontSize: "var(--type-nav-action-size)",
      fontWeight: 500,
      cursor: "pointer",
      padding: "0 2px"
    }
  }, "Cancel") : null);
}
Object.assign(__ds_scope, { SearchField });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/SearchField.jsx", error: String((e && e.message) || e) }); }

// components/forms/Segmented.jsx
try { (() => {
/** Mutually exclusive choices. Selection is announced, not only drawn. */
function Segmented({
  options = [],
  value,
  onChange,
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: "var(--space-sm)",
      ...style
    }
  }, options.map(option => {
    const selected = option.value === value;
    return /*#__PURE__*/React.createElement("button", {
      key: option.value,
      type: "button",
      "aria-pressed": selected,
      "aria-label": option.accessibilityLabel || option.label,
      onClick: () => onChange && onChange(option.value),
      style: {
        flex: 1,
        minHeight: "var(--hit-target)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 var(--space-sm)",
        border: "var(--border-width) solid",
        borderColor: selected ? "var(--accent)" : "var(--border)",
        borderRadius: "var(--r-lg)",
        background: selected ? "var(--accent)" : "var(--surface)",
        cursor: "pointer"
      }
    }, /*#__PURE__*/React.createElement(__ds_scope.AppText, {
      numberOfLines: 2,
      style: {
        fontWeight: 700,
        textAlign: "center",
        color: selected ? "var(--on-accent)" : "var(--text)"
      }
    }, option.label));
  }));
}
Object.assign(__ds_scope, { Segmented });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Segmented.jsx", error: String((e && e.message) || e) }); }

// components/forms/StepperField.jsx
try { (() => {
/**
 * Bounded numeric adjustment.
 *
 * `compact` is the platform stepper: a 32pt two-button segment with a hairline
 * divider, placed as a row accessory next to the value. `field` is the larger
 * standalone control the set logger uses, where weight and reps are the point
 * of the screen and the thumb should not have to aim.
 */
function StepperField({
  label,
  value = 0,
  step = 1,
  min = 0,
  onChange,
  height = 48,
  variant = "field",
  style
}) {
  const round = n => Math.round(n * 10) / 10;
  const dec = () => onChange && onChange(round(Math.max(min, value - step)));
  const inc = () => onChange && onChange(round(value + step));
  if (variant === "compact") {
    const btn = {
      width: 42,
      height: 32,
      display: "grid",
      placeItems: "center",
      border: "none",
      background: "transparent",
      color: "var(--accent-ink)",
      fontFamily: "var(--font-system)",
      fontSize: 17,
      fontWeight: 500,
      cursor: "pointer"
    };
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        borderRadius: 8,
        background: "var(--surface-2)",
        overflow: "hidden",
        flex: "0 0 auto",
        ...style
      }
    }, /*#__PURE__*/React.createElement("button", {
      type: "button",
      "aria-label": "Decrease " + label,
      onClick: dec,
      style: btn
    }, "\u2212"), /*#__PURE__*/React.createElement("span", {
      style: {
        width: "var(--hairline-width)",
        alignSelf: "stretch",
        background: "var(--border-strong)"
      }
    }), /*#__PURE__*/React.createElement("button", {
      type: "button",
      "aria-label": "Increase " + label,
      onClick: inc,
      style: btn
    }, "\uFF0B"));
  }
  const btn = {
    width: 44,
    height: 44,
    display: "grid",
    placeItems: "center",
    border: "none",
    background: "transparent",
    color: "var(--accent-ink)",
    fontFamily: "var(--font-system)",
    fontSize: 20,
    fontWeight: 500,
    cursor: "pointer"
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 96,
      height,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 2px",
      borderRadius: "var(--r-lg)",
      background: "var(--surface-2)",
      ...style
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-label": "Decrease " + label,
    onClick: dec,
    style: btn
  }, "\u2212"), /*#__PURE__*/React.createElement("span", {
    style: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 0
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.AppText, {
    style: {
      fontSize: 22,
      fontWeight: 600,
      fontVariantNumeric: "tabular-nums",
      letterSpacing: "-0.4px"
    }
  }, value), /*#__PURE__*/React.createElement(__ds_scope.AppText, {
    style: {
      fontSize: 11,
      fontWeight: 400,
      color: "var(--text-muted)"
    }
  }, label)), /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-label": "Increase " + label,
    onClick: inc,
    style: btn
  }, "\uFF0B"));
}
Object.assign(__ds_scope, { StepperField });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/StepperField.jsx", error: String((e && e.message) || e) }); }

// components/media/HeroCard.jsx
try { (() => {
/**
 * A photo card for one object: today's workout, a routine, a progress photo.
 * The image is 16:9 and the copy sits below it on the opaque surface rather
 * than over the photo — text on an uncontrolled image is the one place this
 * system will not gamble on contrast. Use `overlay` only with an image you
 * control, and it adds a protection gradient.
 */
function HeroCard({
  src,
  alt = "",
  eyebrow,
  title,
  subtitle,
  meta,
  overlay = false,
  ratio = "16 / 9",
  action,
  onPress,
  style
}) {
  const copy = /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 4
    }
  }, eyebrow ? /*#__PURE__*/React.createElement(__ds_scope.AppText, {
    style: {
      fontSize: "var(--type-eyebrow-size)",
      fontWeight: 600,
      letterSpacing: "var(--type-eyebrow-tracking)",
      textTransform: "uppercase",
      color: overlay ? "rgba(255,255,255,0.82)" : "var(--text-muted)"
    }
  }, eyebrow) : null, /*#__PURE__*/React.createElement(__ds_scope.AppText, {
    variant: "heading",
    style: overlay ? {
      color: "#ffffff"
    } : null
  }, title), subtitle ? /*#__PURE__*/React.createElement(__ds_scope.AppText, {
    variant: "footnote",
    style: overlay ? {
      color: "rgba(255,255,255,0.86)"
    } : null
  }, subtitle) : null, meta ? /*#__PURE__*/React.createElement(__ds_scope.AppText, {
    variant: "footnote",
    style: {
      color: overlay ? "rgba(255,255,255,0.72)" : "var(--text-faint)"
    }
  }, meta) : null);
  return /*#__PURE__*/React.createElement("div", {
    onClick: onPress,
    style: {
      position: "relative",
      borderRadius: "var(--r-list)",
      overflow: "hidden",
      background: "var(--surface)",
      border: "var(--hairline-width) solid var(--border)",
      boxShadow: "var(--shadow-card)",
      cursor: onPress ? "pointer" : "default",
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      aspectRatio: ratio,
      background: "var(--surface-2)",
      position: "relative"
    }
  }, src ? /*#__PURE__*/React.createElement("img", {
    src: src,
    alt: alt,
    style: {
      width: "100%",
      height: "100%",
      objectFit: "cover",
      display: "block"
    }
  }) : null, overlay ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      background: "linear-gradient(to top, rgba(10,11,9,0.86) 0%, rgba(10,11,9,0.35) 45%, rgba(10,11,9,0) 100%)"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      left: "var(--space-md)",
      right: "var(--space-md)",
      bottom: 14
    }
  }, copy)) : null), overlay ? null : /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "12px var(--space-md) 14px",
      display: "flex",
      flexDirection: "column",
      gap: 12
    }
  }, copy, action), overlay && action ? /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "12px var(--space-md) 14px"
    }
  }, action) : null);
}
Object.assign(__ds_scope, { HeroCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/media/HeroCard.jsx", error: String((e && e.message) || e) }); }

// components/media/MediaThumb.jsx
try { (() => {
/**
 * Leading image for a list row: exercise thumbnails, Open Food Facts product
 * shots, a meal photo. Square by default because a row is height-bound.
 *
 * Every photo is optional by contract — the app has rows with no image and
 * rows whose remote image has not arrived, so the fallback is a first-class
 * state, not an error: the muted initial on a raised surface.
 */
function MediaThumb({
  src,
  alt = "",
  size = 44,
  radius = 10,
  fallback,
  style
}) {
  const [failed, setFailed] = React.useState(false);
  const show = src && !failed;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: size,
      height: size,
      borderRadius: radius,
      overflow: "hidden",
      flex: "0 0 auto",
      background: "var(--surface-2)",
      display: "grid",
      placeItems: "center",
      ...style
    }
  }, show ? /*#__PURE__*/React.createElement("img", {
    src: src,
    alt: alt,
    onError: () => setFailed(true),
    style: {
      width: "100%",
      height: "100%",
      objectFit: "cover",
      display: "block"
    }
  }) : /*#__PURE__*/React.createElement(__ds_scope.AppText, {
    style: {
      fontSize: Math.round(size * 0.34),
      fontWeight: 600,
      color: "var(--text-faint)"
    }
  }, (fallback || alt || "?").slice(0, 1).toUpperCase()));
}
Object.assign(__ds_scope, { MediaThumb });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/media/MediaThumb.jsx", error: String((e && e.message) || e) }); }

// components/navigation/ActiveSessionBar.jsx
try { (() => {
/** Resume control — in the iOS 26 tab accessory, or inline above the tabs below that. */
function ActiveSessionBar({
  name = "Free session",
  elapsed,
  onPress,
  style
}) {
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onPress,
    "aria-label": "Resume active workout",
    style: {
      width: "100%",
      display: "flex",
      alignItems: "center",
      gap: "var(--space-sm)",
      minHeight: "var(--hit-target)",
      padding: "0 var(--space-md)",
      borderRadius: "var(--r-pill)",
      border: "none",
      background: "var(--surface-2)",
      cursor: "pointer",
      textAlign: "left",
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 8,
      height: 8,
      borderRadius: "var(--r-pill)",
      background: "var(--accent)",
      flex: "0 0 auto"
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      minWidth: 0,
      display: "flex",
      flexDirection: "column"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.AppText, {
    variant: "caption",
    style: {
      color: "var(--accent-ink)",
      letterSpacing: 0.4,
      textTransform: "uppercase"
    }
  }, "In progress"), /*#__PURE__*/React.createElement(__ds_scope.AppText, {
    numberOfLines: 1,
    style: {
      fontWeight: 700
    }
  }, name)), elapsed ? /*#__PURE__*/React.createElement(__ds_scope.AppText, {
    style: {
      color: "var(--text-muted)",
      fontWeight: 700,
      fontVariantNumeric: "tabular-nums"
    }
  }, elapsed) : null, /*#__PURE__*/React.createElement(__ds_scope.AppText, {
    style: {
      color: "var(--accent-ink)",
      fontWeight: 600
    }
  }, "Resume"));
}
Object.assign(__ds_scope, { ActiveSessionBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/ActiveSessionBar.jsx", error: String((e && e.message) || e) }); }

// components/navigation/NavBar.jsx
try { (() => {
/**
 * iOS native stack header: Liquid Glass material, minimal back chevron, and an
 * optional right toolbar action. In the app this is `Stack.Screen` chrome —
 * never drawn in React Native. This is the HTML stand-in for mocks.
 */
function NavBar({
  title,
  backLabel,
  onBack,
  action,
  largeTitle = false,
  statusBar = true,
  style
}) {
  return /*#__PURE__*/React.createElement("header", {
    style: {
      position: "sticky",
      top: 0,
      zIndex: 20,
      background: "var(--glass-chrome)",
      backdropFilter: "var(--glass-blur)",
      WebkitBackdropFilter: "var(--glass-blur)",
      borderBottom: "var(--hairline-width) solid var(--glass-hairline)",
      fontFamily: "var(--font-system)",
      ...style
    }
  }, statusBar ? /*#__PURE__*/React.createElement("div", {
    style: {
      height: "var(--status-bar-height)",
      display: "flex",
      alignItems: "flex-end",
      justifyContent: "space-between",
      padding: "0 22px 4px",
      color: "var(--text)",
      fontSize: 14,
      fontWeight: 700
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontVariantNumeric: "tabular-nums"
    }
  }, "9:41"), /*#__PURE__*/React.createElement("span", {
    style: {
      display: "flex",
      gap: 5,
      alignItems: "center",
      opacity: 0.9
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11
    }
  }, "\u25AE\u25AE\u25AE"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11
    }
  }, "WiFi"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11
    }
  }, "100%"))) : null, /*#__PURE__*/React.createElement("div", {
    style: {
      height: "var(--nav-bar-height)",
      display: "flex",
      alignItems: "center",
      padding: "0 var(--space-sm)",
      gap: "var(--space-xs)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      flex: "0 0 25%",
      display: "flex",
      alignItems: "center"
    }
  }, onBack ? /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onBack,
    style: {
      minHeight: "var(--hit-target)",
      display: "flex",
      alignItems: "center",
      gap: 2,
      border: "none",
      background: "transparent",
      color: "var(--accent-ink)",
      fontFamily: "var(--font-system)",
      fontSize: "var(--type-nav-action-size)",
      fontWeight: 500,
      cursor: "pointer",
      padding: "0 6px"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 26,
      lineHeight: "22px",
      fontWeight: 500
    }
  }, "\u2039"), backLabel) : null), /*#__PURE__*/React.createElement(__ds_scope.AppText, {
    numberOfLines: 1,
    style: {
      flex: 1,
      textAlign: "center",
      fontSize: "var(--type-nav-title-size)",
      fontWeight: 600,
      opacity: largeTitle ? 0 : 1
    }
  }, title), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: "0 0 25%",
      display: "flex",
      justifyContent: "flex-end"
    }
  }, action ? /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: action.onPress,
    disabled: action.disabled,
    style: {
      minHeight: "var(--hit-target)",
      padding: "0 6px",
      border: "none",
      background: "transparent",
      color: "var(--accent-ink)",
      fontFamily: "var(--font-system)",
      fontSize: "var(--type-nav-action-size)",
      fontWeight: 500,
      opacity: action.disabled ? "var(--disabled-opacity)" : 1,
      cursor: "pointer"
    }
  }, action.label) : null)), largeTitle ? /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "0 var(--screen-gutter) 6px"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.AppText, {
    as: "h1",
    style: {
      fontSize: "var(--type-large-title-size)",
      fontWeight: 700,
      letterSpacing: "var(--type-large-title-tracking)"
    }
  }, title)) : null);
}
Object.assign(__ds_scope, { NavBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/NavBar.jsx", error: String((e && e.message) || e) }); }

// components/navigation/TabBar.jsx
try { (() => {
/** Native tab bar (five is the ceiling — a sixth collapses into a system "More"). */
function TabBar({
  tabs = [],
  value,
  onChange,
  accessory,
  style
}) {
  return /*#__PURE__*/React.createElement("nav", {
    style: {
      position: "sticky",
      bottom: 0,
      zIndex: 20,
      background: "var(--glass-chrome-strong)",
      backdropFilter: "var(--glass-blur)",
      WebkitBackdropFilter: "var(--glass-blur)",
      borderTop: "var(--hairline-width) solid var(--glass-hairline)",
      fontFamily: "var(--font-system)",
      ...style
    }
  }, accessory ? /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "var(--space-sm) var(--space-md) 0"
    }
  }, accessory) : null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      height: "var(--tab-bar-height)",
      alignItems: "stretch",
      paddingTop: 4
    }
  }, tabs.map(tab => {
    const selected = tab.key === value;
    return /*#__PURE__*/React.createElement("button", {
      key: tab.key,
      type: "button",
      "aria-current": selected ? "page" : undefined,
      onClick: () => onChange && onChange(tab.key),
      style: {
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
        border: "none",
        background: "transparent",
        color: selected ? "var(--accent-ink)" : "var(--text-faint)",
        cursor: "pointer"
      }
    }, /*#__PURE__*/React.createElement(__ds_scope.Icon, {
      name: tab.icon,
      size: 22
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 10,
        fontWeight: 500
      }
    }, tab.label));
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      height: "var(--home-indicator-height)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 140,
      height: 5,
      borderRadius: 3,
      background: "rgba(255,255,255,0.35)"
    }
  })));
}
Object.assign(__ds_scope, { TabBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/TabBar.jsx", error: String((e && e.message) || e) }); }

// components/sheets/Sheet.jsx
try { (() => {
/**
 * Bottom sheet presentation. On iOS the app uses a native formSheet or an
 * @expo/ui sheet; this is the shared shape — grabber, 20px top corners,
 * surface ground, scrim behind.
 */
function Sheet({
  title,
  subtitle,
  doneLabel = "Done",
  onDone,
  detent = "medium",
  children,
  style
}) {
  const heights = {
    small: "40%",
    medium: "62%",
    large: "88%"
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      background: "var(--scrim)",
      display: "flex",
      alignItems: "flex-end",
      zIndex: 30,
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    role: "dialog",
    "aria-label": title,
    style: {
      width: "100%",
      maxHeight: heights[detent],
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-sm)",
      background: "var(--surface)",
      borderTopLeftRadius: "var(--r-sheet)",
      borderTopRightRadius: "var(--r-sheet)",
      padding: "var(--space-sm) var(--space-md) var(--space-lg)",
      boxShadow: "var(--shadow-sheet)",
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      alignSelf: "center",
      width: "var(--grabber-w)",
      height: "var(--grabber-h)",
      borderRadius: "var(--r-pill)",
      background: "var(--border-strong)"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      minHeight: "var(--hit-target)",
      gap: "var(--space-sm)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      minWidth: 0,
      display: "flex",
      flexDirection: "column"
    }
  }, title ? /*#__PURE__*/React.createElement(__ds_scope.AppText, {
    variant: "heading"
  }, title) : null, subtitle ? /*#__PURE__*/React.createElement(__ds_scope.AppText, {
    variant: "caption"
  }, subtitle) : null), onDone ? /*#__PURE__*/React.createElement(__ds_scope.TextAction, {
    label: doneLabel,
    onClick: onDone,
    style: {
      fontWeight: 800
    }
  }) : null), /*#__PURE__*/React.createElement("div", {
    style: {
      overflowY: "auto",
      display: "flex",
      flexDirection: "column",
      gap: "var(--space-sm)"
    }
  }, children)));
}
Object.assign(__ds_scope, { Sheet });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/sheets/Sheet.jsx", error: String((e && e.message) || e) }); }

// ui_kits/foundry-ios/App.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const {
  NavBar,
  TabBar,
  ActiveSessionBar,
  RestTimerBar,
  ConfirmDialog,
  Toast,
  OfflineBanner
} = window.FoundryDesignSystem_397633;
const TABS = [{
  key: "home",
  label: "Home",
  icon: "house.fill"
}, {
  key: "train",
  label: "Train",
  icon: "play.fill"
}, {
  key: "nutrition",
  label: "Nutrition",
  icon: "fork.knife"
}, {
  key: "progress",
  label: "Progress",
  icon: "chart.bar.fill"
}, {
  key: "profile",
  label: "Profile",
  icon: "person.fill"
}];
const TAB_TITLES = {
  home: "Home",
  train: "Train",
  nutrition: "Nutrition",
  progress: "Progress",
  profile: "Profile"
};

/** Stand-in for the app's RestTimerProvider — start()/stop() and a derived remainder. */
function useRestTimerMock() {
  const [endsAt, setEndsAt] = React.useState(null);
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (endsAt === null) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [endsAt]);
  const seconds = endsAt === null ? 0 : Math.ceil((endsAt - now) / 1000);
  return {
    running: endsAt !== null,
    done: endsAt !== null && seconds <= 0,
    label: Math.floor(Math.max(0, seconds) / 60) + ":" + String(Math.max(0, seconds) % 60).padStart(2, "0"),
    start: s => {
      setEndsAt(Date.now() + (s || 90) * 1000);
      setNow(Date.now());
    },
    stop: () => setEndsAt(null),
    adjust: d => setEndsAt(p => p === null ? p : p + d * 1000)
  };
}
window.useRestTimerMock = useRestTimerMock;
function App() {
  const [tab, setTab] = React.useState("home");
  const [stack, setStack] = React.useState([]);
  const [active, setActive] = React.useState(null);
  const [confirm, setConfirm] = React.useState(null);
  const [toast, setToast] = React.useState(null);
  const [offline, setOffline] = React.useState(false);
  // "system" lets prefers-color-scheme decide, as the app does; the other two
  // force a mode so both themes can be reviewed here.
  const [theme, setTheme] = React.useState("system");
  const rest = useRestTimerMock();
  React.useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(id);
  }, [toast]);
  const push = screen => setStack(s => [...s, screen]);
  const pop = () => setStack(s => s.slice(0, -1));
  const top = stack[stack.length - 1];
  const startFree = () => {
    setActive({
      name: "Push day"
    });
    setStack([{
      kind: "session",
      title: "Push day"
    }]);
  };
  let body = null;
  let header = null;
  if (!top) {
    header = /*#__PURE__*/React.createElement(NavBar, {
      title: TAB_TITLES[tab],
      largeTitle: true
    });
    body = tab === "home" ? /*#__PURE__*/React.createElement(HomeScreen, {
      active: active,
      onStart: () => push({
        kind: "start",
        title: "Start activity"
      }),
      onResume: () => push({
        kind: "session",
        title: active ? active.name : "Workout"
      }),
      onOpenSession: () => push({
        kind: "summary",
        title: "Summary"
      })
    }) : tab === "train" ? /*#__PURE__*/React.createElement(TrainScreen, {
      onStart: () => push({
        kind: "start",
        title: "Start activity"
      }),
      onOpenExercises: () => push({
        kind: "exercises",
        title: "Exercises"
      }),
      onDeleteRoutine: r => setConfirm({
        title: "Delete " + r.name + "?",
        message: "Sessions you already logged from it are kept.",
        confirmLabel: "Delete routine",
        destructive: true
      })
    }) : tab === "nutrition" ? /*#__PURE__*/React.createElement(NutritionScreen, {
      onAdd: () => push({
        kind: "exercises",
        title: "Add food"
      })
    }) : tab === "progress" ? /*#__PURE__*/React.createElement(ProgressScreen, null) : /*#__PURE__*/React.createElement(ProfileScreen, {
      onOpenLanguage: () => push({
        kind: "language",
        title: "Language"
      }),
      theme: theme,
      onTheme: setTheme
    });
  } else if (top.kind === "session") {
    header = /*#__PURE__*/React.createElement(NavBar, {
      title: top.title,
      onBack: pop,
      action: {
        label: "Finish",
        onPress: () => {
          setActive(null);
          setStack([{
            kind: "summary",
            title: "Summary"
          }]);
          rest.stop();
        }
      }
    });
    body = /*#__PURE__*/React.createElement(SessionScreen, {
      onCancelRequest: () => setConfirm({
        title: "Cancel this workout?",
        message: "Sets you already logged are kept.",
        confirmLabel: "Cancel workout",
        cancelLabel: "Keep going",
        destructive: true,
        onConfirm: () => {
          setActive(null);
          setStack([]);
          rest.stop();
        }
      })
    });
  } else if (top.kind === "exercises") {
    header = /*#__PURE__*/React.createElement(NavBar, {
      title: top.title,
      onBack: pop,
      action: {
        label: "Add"
      }
    });
    body = /*#__PURE__*/React.createElement(ExercisesScreen, {
      onDelete: item => setConfirm({
        title: "Delete " + item.name + "?",
        message: "Every set and 1RM logged against it goes too.",
        confirmLabel: "Delete exercise",
        destructive: true,
        onConfirm: () => setToast({
          kind: "error",
          message: "Default exercises cannot be deleted."
        })
      })
    });
  } else if (top.kind === "start") {
    header = /*#__PURE__*/React.createElement(NavBar, {
      title: top.title,
      onBack: pop
    });
    body = /*#__PURE__*/React.createElement(StartActivityScreen, {
      onStartFree: startFree
    });
  } else if (top.kind === "language") {
    header = /*#__PURE__*/React.createElement(NavBar, {
      title: top.title,
      onBack: pop
    });
    body = /*#__PURE__*/React.createElement(LanguageScreen, null);
  } else {
    header = /*#__PURE__*/React.createElement(NavBar, {
      title: "Summary"
    });
    body = /*#__PURE__*/React.createElement(SummaryScreen, {
      onDone: () => setStack([])
    });
  }
  const onSession = top && top.kind === "session";
  return /*#__PURE__*/React.createElement("div", {
    className: theme === "system" ? undefined : "theme-" + theme,
    style: {
      position: "relative",
      width: 390,
      minHeight: 844,
      margin: "0 auto",
      background: "var(--bg)",
      color: "var(--text)",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden"
    }
  }, offline ? /*#__PURE__*/React.createElement(OfflineBanner, null) : null, header, /*#__PURE__*/React.createElement("main", {
    style: {
      flex: 1,
      overflowY: "auto"
    }
  }, body), onSession && rest.running ? /*#__PURE__*/React.createElement(RestTimerBar, {
    remaining: rest.label,
    done: rest.done,
    defaultSeconds: 90,
    onAdjust: rest.adjust,
    onDismiss: rest.stop
  }) : null, !onSession ? /*#__PURE__*/React.createElement(TabBar, {
    tabs: TABS,
    value: tab,
    onChange: k => {
      setTab(k);
      setStack([]);
    },
    accessory: active ? /*#__PURE__*/React.createElement(ActiveSessionBar, {
      name: active.name,
      elapsed: "12:04",
      onPress: () => setStack([{
        kind: "session",
        title: active.name
      }])
    }) : null
  }) : null, toast ? /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      top: 62,
      left: 16,
      right: 16,
      zIndex: 50
    }
  }, /*#__PURE__*/React.createElement(Toast, {
    kind: toast.kind,
    message: toast.message,
    onDismiss: () => setToast(null)
  })) : null, confirm ? /*#__PURE__*/React.createElement(ConfirmDialog, _extends({}, confirm, {
    onConfirm: () => {
      if (confirm.onConfirm) confirm.onConfirm();
      setConfirm(null);
    },
    onCancel: () => setConfirm(null)
  })) : null, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setOffline(!offline),
    style: {
      position: "absolute",
      top: 8,
      right: 8,
      zIndex: 60,
      border: "1px solid var(--border-strong)",
      borderRadius: 9999,
      background: "var(--surface-2)",
      color: "var(--text-faint)",
      fontFamily: "var(--font-system)",
      fontSize: 9,
      padding: "3px 8px",
      cursor: "pointer"
    }
  }, offline ? "online" : "offline"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setTheme(theme === "light" ? "dark" : "light"),
    style: {
      position: "absolute",
      top: 8,
      left: 8,
      zIndex: 60,
      border: "1px solid var(--border-strong)",
      borderRadius: 9999,
      background: "var(--surface-2)",
      color: "var(--text-faint)",
      fontFamily: "var(--font-system)",
      fontSize: 9,
      padding: "3px 8px",
      cursor: "pointer"
    }
  }, theme === "light" ? "dark" : "light"));
}
Object.assign(window, {
  App,
  TABS
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/foundry-ios/App.jsx", error: String((e && e.message) || e) }); }

// ui_kits/foundry-ios/HomeScreen.jsx
try { (() => {
const {
  AppText,
  Card,
  HeroCard,
  InsetList,
  InsetRow,
  ProgressRing,
  SportIcon,
  PrimaryButton,
  TextAction,
  MediaThumb
} = window.FoundryDesignSystem_397633;
function SportRow({
  onPick
}) {
  const sports = [["strength", "Strength"], ["running", "Running"], ["cycling", "Cycling"], ["wod", "WOD"]];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8
    }
  }, sports.map(([key, label]) => /*#__PURE__*/React.createElement("button", {
    key: key,
    type: "button",
    onClick: onPick,
    style: {
      flex: 1,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 5,
      padding: "10px 0 8px",
      borderRadius: 13,
      border: "none",
      background: "var(--sport-" + key + "-dim)",
      cursor: "pointer"
    }
  }, /*#__PURE__*/React.createElement(SportIcon, {
    sport: key,
    size: 30
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-system)",
      fontSize: 11,
      fontWeight: 600,
      color: "var(--text-muted)"
    }
  }, label))));
}
function HomeScreen({
  active,
  onStart,
  onResume,
  onOpenSession
}) {
  const data = window.FOUNDRY_DATA;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--section-gap)",
      padding: "4px 20px 24px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between"
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(AppText, {
    style: {
      fontSize: "var(--type-eyebrow-size)",
      fontWeight: 600,
      letterSpacing: "var(--type-eyebrow-tracking)",
      textTransform: "uppercase",
      color: "var(--text-muted)"
    }
  }, "Wednesday, 17 Sep"), /*#__PURE__*/React.createElement(AppText, {
    as: "h1",
    style: {
      display: "block",
      marginTop: 2,
      fontSize: "var(--type-screen-title-size)",
      fontWeight: 700,
      letterSpacing: "var(--type-screen-title-tracking)"
    }
  }, "Ready to move")), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 36,
      height: 36,
      borderRadius: 18,
      background: "var(--surface-2)",
      display: "grid",
      placeItems: "center"
    }
  }, /*#__PURE__*/React.createElement(AppText, {
    style: {
      fontSize: 13,
      fontWeight: 600,
      color: "var(--text-muted)"
    }
  }, "EJ"))), /*#__PURE__*/React.createElement(Card, {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 14
    }
  }, /*#__PURE__*/React.createElement(ProgressRing, {
    value: 3,
    target: 8,
    size: 56,
    label: "3 of 8 sessions this week"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: "flex",
      flexDirection: "column",
      gap: 1
    }
  }, /*#__PURE__*/React.createElement(AppText, {
    variant: "row"
  }, "This week"), /*#__PURE__*/React.createElement(AppText, {
    variant: "footnote"
  }, "3 sessions logged \xB7 2h 41m")), /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    style: {
      color: "var(--text-faint)",
      fontSize: 17
    }
  }, "\u203A")), active ? /*#__PURE__*/React.createElement(Card, {
    tone: "accent",
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 7,
      height: 7,
      borderRadius: 9999,
      background: "var(--accent-ink)"
    }
  }), /*#__PURE__*/React.createElement(AppText, {
    style: {
      fontSize: "var(--type-eyebrow-size)",
      fontWeight: 600,
      letterSpacing: "var(--type-eyebrow-tracking)",
      textTransform: "uppercase",
      color: "var(--accent-ink)"
    }
  }, "In progress")), /*#__PURE__*/React.createElement(AppText, {
    variant: "heading"
  }, active.name), /*#__PURE__*/React.createElement(PrimaryButton, {
    label: "Resume",
    onClick: onResume
  })) : /*#__PURE__*/React.createElement(HeroCard, {
    eyebrow: "Today's workout",
    title: "Push day",
    subtitle: "Chest, shoulders, triceps",
    meta: "4 exercises \xB7 about 45 min",
    alt: "Push day",
    action: /*#__PURE__*/React.createElement(PrimaryButton, {
      label: "Start activity",
      onClick: onStart
    })
  }), /*#__PURE__*/React.createElement(SportRow, {
    onPick: onStart
  }), /*#__PURE__*/React.createElement(InsetList, {
    header: "Recent",
    action: /*#__PURE__*/React.createElement(TextAction, {
      label: "See all",
      style: {
        minHeight: 0,
        padding: 0
      }
    })
  }, data.recent.slice(0, 3).map(item => /*#__PURE__*/React.createElement(InsetRow, {
    key: item.id,
    leading: /*#__PURE__*/React.createElement(MediaThumb, {
      alt: item.name,
      size: 36,
      radius: 9
    }),
    title: item.name,
    secondary: item.when,
    value: item.duration,
    chevron: true,
    onPress: onOpenSession
  }))));
}
Object.assign(window, {
  HomeScreen,
  SportRow
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/foundry-ios/HomeScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/foundry-ios/NutritionScreen.jsx
try { (() => {
const {
  AppText,
  Eyebrow,
  GroupedSurface,
  DateStepper,
  NutritionCalendar,
  EmptyState,
  SwipeableRow,
  TextAction
} = window.FoundryDesignSystem_397633;
const MEALS = [["breakfast", "Breakfast"], ["lunch", "Lunch"], ["dinner", "Dinner"], ["snacks", "Snacks"]];
function Track({
  fraction,
  color = "var(--accent)"
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      height: 8,
      borderRadius: "var(--r-pill)",
      background: "var(--surface-2)",
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: 8,
      width: Math.max(0, Math.min(100, fraction * 100)) + "%",
      borderRadius: "var(--r-pill)",
      background: color
    }
  }));
}
function MacroCell({
  name,
  value,
  goal
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flexGrow: 1,
      flexBasis: 80,
      minWidth: 80,
      display: "flex",
      flexDirection: "column",
      gap: 4
    }
  }, /*#__PURE__*/React.createElement(AppText, {
    variant: "caption"
  }, name), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 2
    }
  }, /*#__PURE__*/React.createElement(AppText, {
    style: {
      fontWeight: 700
    }
  }, value, " g"), /*#__PURE__*/React.createElement(AppText, {
    variant: "caption"
  }, "\u2265 ", goal, " g")));
}
function MealSection({
  label,
  entries,
  onAdd
}) {
  const kcal = entries.reduce((s, e) => s + e.kcal, 0);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement(AppText, {
    variant: "heading"
  }, label), entries.length ? /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(AppText, {
    variant: "caption"
  }, kcal, " kcal")) : null), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 4
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-label": label + ": actions",
    style: {
      minWidth: 44,
      minHeight: 44,
      border: "none",
      background: "transparent",
      color: "var(--text-muted)",
      cursor: "pointer",
      fontFamily: "var(--font-system)"
    }
  }, "\xB7\xB7\xB7"), /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-label": "Add to " + label,
    onClick: onAdd,
    style: {
      minWidth: 44,
      minHeight: 44,
      borderRadius: "var(--r-pill)",
      border: "none",
      background: "var(--accent)",
      color: "var(--on-accent)",
      fontFamily: "var(--font-system)",
      fontSize: 18,
      fontWeight: 700,
      cursor: "pointer"
    }
  }, "+"))), /*#__PURE__*/React.createElement(GroupedSurface, {
    style: {
      padding: "0 var(--space-md)"
    }
  }, entries.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "var(--space-md) 0"
    }
  }, /*#__PURE__*/React.createElement(EmptyState, {
    body: "Nothing logged here yet."
  })) : entries.map((entry, i) => /*#__PURE__*/React.createElement(SwipeableRow, {
    key: entry.id,
    menuTitle: "Actions for " + entry.name,
    style: {
      borderRadius: 0
    },
    actions: [{
      key: "edit",
      label: "Edit"
    }, {
      key: "copy",
      label: "Copy",
      swipe: false
    }, {
      key: "move",
      label: "Move",
      swipe: false
    }, {
      key: "delete",
      label: "Delete",
      destructive: true
    }]
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "12px 0",
      minHeight: 56,
      borderBottom: i === entries.length - 1 ? "none" : "1px solid var(--border)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      minWidth: 0,
      display: "flex",
      flexDirection: "column"
    }
  }, /*#__PURE__*/React.createElement(AppText, {
    style: {
      fontWeight: 700
    }
  }, entry.name), /*#__PURE__*/React.createElement(AppText, {
    variant: "caption"
  }, entry.serving)), /*#__PURE__*/React.createElement(AppText, {
    style: {
      fontWeight: 700
    }
  }, entry.kcal, " kcal"))))));
}
function NutritionScreen({
  onAdd
}) {
  const diary = window.FOUNDRY_DATA.diary;
  const [calendar, setCalendar] = React.useState(false);
  const logged = MEALS.reduce((s, [k]) => s + diary[k].reduce((a, e) => a + e.kcal, 0), 0);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 16,
      padding: "12px 20px 40px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement(DateStepper, {
    label: "Today",
    secondaryLabel: "17 Sep",
    onChooseDate: () => setCalendar(!calendar)
  })), /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-label": "Weekly review",
    style: {
      minWidth: 44,
      minHeight: 44,
      border: "none",
      background: "transparent",
      display: "flex",
      alignItems: "flex-end",
      justifyContent: "center",
      gap: 3,
      cursor: "pointer"
    }
  }, [10, 19, 15].map(h => /*#__PURE__*/React.createElement("span", {
    key: h,
    style: {
      width: 4,
      height: h,
      borderRadius: 2,
      background: "var(--accent)"
    }
  })))), calendar ? /*#__PURE__*/React.createElement(NutritionCalendar, {
    monthLabel: "September 2026",
    offset: 1,
    days: 30,
    selected: 17,
    today: 17
  }) : null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 4,
      minHeight: 44
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--accent)",
      fontSize: 8,
      fontFamily: "var(--font-system)"
    }
  }, "\u25CF"), /*#__PURE__*/React.createElement(AppText, {
    variant: "caption"
  }, "Trained today")), /*#__PURE__*/React.createElement(GroupedSurface, {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(AppText, {
    variant: "caption"
  }, "Goals"), /*#__PURE__*/React.createElement(TextAction, {
    label: "Edit goals",
    style: {
      minHeight: 44,
      padding: 0,
      fontSize: 12
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 2,
      paddingBottom: 4
    }
  }, /*#__PURE__*/React.createElement(AppText, {
    variant: "title"
  }, 2400 - logged, " kcal left"), /*#__PURE__*/React.createElement(AppText, {
    variant: "caption"
  }, logged, " logged of 2 400 kcal")), /*#__PURE__*/React.createElement(Track, {
    fraction: logged / 2400
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      gap: 16,
      paddingTop: 8
    }
  }, /*#__PURE__*/React.createElement(MacroCell, {
    name: "Protein",
    value: 96,
    goal: 150
  }), /*#__PURE__*/React.createElement(MacroCell, {
    name: "Carbs",
    value: 121,
    goal: 250
  }), /*#__PURE__*/React.createElement(MacroCell, {
    name: "Fat",
    value: 38,
    goal: 70
  }))), MEALS.map(([key, label]) => /*#__PURE__*/React.createElement(MealSection, {
    key: key,
    label: label,
    entries: diary[key],
    onAdd: onAdd
  })));
}
Object.assign(window, {
  NutritionScreen,
  MealSection,
  Track,
  MacroCell
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/foundry-ios/NutritionScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/foundry-ios/ProfileScreen.jsx
try { (() => {
const {
  AppText,
  StatBox,
  InsetList,
  InsetRow,
  Segmented
} = window.FoundryDesignSystem_397633;
function ProfileScreen({
  onOpenLanguage,
  theme,
  onTheme
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "var(--section-gap)",
      padding: "4px 20px 24px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 6,
      padding: "8px 0"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 56,
      height: 56,
      borderRadius: 9999,
      background: "var(--surface-2)",
      display: "grid",
      placeItems: "center"
    }
  }, /*#__PURE__*/React.createElement(AppText, {
    style: {
      fontSize: 17,
      fontWeight: 600,
      color: "var(--text-muted)"
    }
  }, "EJ")), /*#__PURE__*/React.createElement(AppText, {
    variant: "heading"
  }, "Eric Jansen"), /*#__PURE__*/React.createElement(AppText, {
    variant: "footnote"
  }, "Member since Mar 2025")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(StatBox, {
    value: "142",
    label: "Sessions"
  }), /*#__PURE__*/React.createElement(StatBox, {
    value: "312 km",
    label: "Distance"
  }), /*#__PURE__*/React.createElement(StatBox, {
    value: "18",
    label: "PRs"
  })), /*#__PURE__*/React.createElement(InsetList, {
    header: "Preferences"
  }, /*#__PURE__*/React.createElement(InsetRow, {
    title: "Units",
    value: "kg \xB7 km",
    chevron: true,
    onPress: () => {}
  }), /*#__PURE__*/React.createElement(InsetRow, {
    title: "Notifications",
    value: "On",
    chevron: true,
    onPress: () => {}
  }), /*#__PURE__*/React.createElement(InsetRow, {
    title: "Connected apps",
    value: "None",
    chevron: true,
    onPress: () => {}
  }), /*#__PURE__*/React.createElement(InsetRow, {
    title: "Language",
    value: "English",
    chevron: true,
    onPress: onOpenLanguage
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(AppText, {
    style: {
      fontSize: "var(--type-eyebrow-size)",
      fontWeight: 600,
      letterSpacing: "var(--type-eyebrow-tracking)",
      textTransform: "uppercase",
      color: "var(--text-muted)"
    }
  }, "Appearance"), /*#__PURE__*/React.createElement(Segmented, {
    value: theme,
    onChange: onTheme,
    options: [{
      value: "system",
      label: "System"
    }, {
      value: "light",
      label: "Light"
    }, {
      value: "dark",
      label: "Dark"
    }]
  }), /*#__PURE__*/React.createElement(AppText, {
    variant: "footnote"
  }, "The app follows iOS by default; this switch is here so both themes can be reviewed.")), /*#__PURE__*/React.createElement(InsetList, null, /*#__PURE__*/React.createElement(InsetRow, {
    title: "Sign out",
    destructive: true,
    onPress: () => {}
  })));
}
Object.assign(window, {
  ProfileScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/foundry-ios/ProfileScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/foundry-ios/ProgressScreen.jsx
try { (() => {
const {
  AppText,
  Chip,
  Eyebrow,
  StatBox,
  TrendChart,
  BucketChart
} = window.FoundryDesignSystem_397633;
function ProgressScreen() {
  const [tab, setTab] = React.useState("Exercises");
  const [exercise, setExercise] = React.useState("Bench press");
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 14,
      padding: "12px 20px 24px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 7
    }
  }, ["Exercises", "Body"].map(t => /*#__PURE__*/React.createElement("span", {
    key: t,
    style: {
      flex: 1,
      display: "flex"
    }
  }, /*#__PURE__*/React.createElement(Chip, {
    label: t,
    active: t === tab,
    onClick: () => setTab(t),
    style: {
      flex: 1
    }
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(StatBox, {
    value: "24",
    label: "Sessions"
  }), /*#__PURE__*/React.createElement(StatBox, {
    value: "18h 40m",
    label: "Active"
  })), tab === "Exercises" ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Eyebrow, null, "Exercise"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 7,
      overflowX: "auto"
    }
  }, ["Bench press", "Back squat", "Deadlift"].map(n => /*#__PURE__*/React.createElement(Chip, {
    key: n,
    label: n,
    active: n === exercise,
    onClick: () => setExercise(n)
  }))), /*#__PURE__*/React.createElement(TrendChart, {
    title: "1RM over time",
    points: [{
      value: 92,
      label: "3 Mar"
    }, {
      value: 96,
      label: "18 Mar"
    }, {
      value: 95,
      label: "1 Apr"
    }, {
      value: 101,
      label: "20 Apr"
    }]
  }), /*#__PURE__*/React.createElement(BucketChart, {
    title: "Weekly volume",
    note: "Every set type, warmups included.",
    points: [{
      value: 4200,
      label: "W12"
    }, {
      value: 5100,
      label: "W13"
    }, {
      value: 3900,
      label: "W14"
    }, {
      value: 5600,
      label: "W15"
    }, {
      value: 6100,
      label: "W16"
    }]
  })) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Eyebrow, null, "Body"), /*#__PURE__*/React.createElement(TrendChart, {
    title: "Weight",
    points: [{
      value: 84.2,
      label: "Jun"
    }, {
      value: 83.4,
      label: "Jul"
    }, {
      value: 82.9,
      label: "Aug"
    }, {
      value: 82.5,
      label: "Sep"
    }]
  }), /*#__PURE__*/React.createElement(AppText, {
    variant: "caption"
  }, "Logged from the Body tab; a measurement is one row per day.")));
}
Object.assign(window, {
  ProgressScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/foundry-ios/ProgressScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/foundry-ios/PushedScreens.jsx
try { (() => {
const {
  AppText,
  Chip,
  Eyebrow,
  SportIcon,
  EmptyState,
  SwipeableRow,
  Segmented,
  PrimaryButton,
  TextAction,
  SearchField,
  MediaThumb,
  InsetList,
  InsetRow,
  FormSection,
  FormTextField
} = window.FoundryDesignSystem_397633;
const CHIP_FILTERS = ["All", "Chest", "Back", "Legs", "Shoulders", "Arms", "Core"];
const EQUIPMENT = ["compound", "isolation", "barbell", "dumbbell", "cable", "bodyweight", "machine"];
function ExercisesScreen({
  onDelete
}) {
  const data = window.FOUNDRY_DATA;
  const [search, setSearch] = React.useState("");
  const [chip, setChip] = React.useState("All");
  const [eq, setEq] = React.useState(null);
  const list = data.exercises.filter(e => e.name.toLowerCase().includes(search.trim().toLowerCase()) && (!eq || e.category === eq || e.equipment === eq));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 8,
      padding: "8px 0 40px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 8,
      padding: "0 16px"
    }
  }, /*#__PURE__*/React.createElement(SearchField, {
    value: search,
    onChange: setSearch,
    placeholder: "Search exercises",
    onCancel: () => setSearch("")
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      overflowX: "auto"
    }
  }, CHIP_FILTERS.map(c => /*#__PURE__*/React.createElement(Chip, {
    key: c,
    label: c,
    active: c === chip,
    onClick: () => setChip(c)
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      overflowX: "auto"
    }
  }, EQUIPMENT.map(c => /*#__PURE__*/React.createElement(Chip, {
    key: c,
    label: c,
    active: c === eq,
    onClick: () => setEq(eq === c ? null : c)
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 8,
      padding: "8px 16px 0"
    }
  }, list.length === 0 ? /*#__PURE__*/React.createElement(EmptyState, {
    appearance: "search",
    title: "Nothing matches",
    body: "Try clearing a filter or two."
  }) : list.map(item => /*#__PURE__*/React.createElement(SwipeableRow, {
    key: item.id,
    menuTitle: item.name,
    style: {
      borderRadius: "var(--r-lg)"
    },
    actions: [{
      key: "open",
      label: "View"
    }, ...(item.isDefault ? [] : [{
      key: "delete",
      label: "Delete",
      destructive: true,
      onPress: () => onDelete(item)
    }])]
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: "8px 16px",
      minHeight: "var(--row-min-height)"
    }
  }, /*#__PURE__*/React.createElement(MediaThumb, {
    alt: item.name,
    size: 40
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      minWidth: 0,
      display: "flex",
      flexDirection: "column",
      gap: 1
    }
  }, /*#__PURE__*/React.createElement(AppText, {
    variant: "row",
    numberOfLines: 1
  }, item.name), /*#__PURE__*/React.createElement(AppText, {
    variant: "footnote",
    style: {
      textTransform: "capitalize"
    }
  }, item.category, " \xB7 ", item.equipment)), item.isDefault ? null : /*#__PURE__*/React.createElement(TextAction, {
    label: "Delete",
    tone: "destructive",
    onClick: () => onDelete(item),
    style: {
      minHeight: 0,
      padding: 0,
      fontSize: 15
    }
  }))))));
}
function StartActivityScreen({
  onStartFree
}) {
  const data = window.FOUNDRY_DATA;
  const [stub, setStub] = React.useState(null);
  const [name, setName] = React.useState("");
  const sports = [["strength", "Strength", "Log sets & reps"], ["running", "Running", "Distance & pace"], ["cycling", "Cycling", "Distance & pace"], ["wod", "WOD", "Distance & pace"]];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 14,
      padding: "12px 20px 80px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      gap: 8
    }
  }, sports.map(([key, label, sub]) => /*#__PURE__*/React.createElement("button", {
    key: key,
    type: "button",
    onClick: () => key === "strength" ? onStartFree() : setStub(label),
    style: {
      width: "48%",
      borderRadius: 14,
      border: "none",
      padding: 12,
      display: "flex",
      flexDirection: "column",
      gap: 6,
      alignItems: "flex-start",
      background: "var(--sport-" + key + "-dim)",
      cursor: "pointer"
    }
  }, /*#__PURE__*/React.createElement(SportIcon, {
    sport: key,
    size: 32
  }), /*#__PURE__*/React.createElement(AppText, {
    style: {
      fontSize: 15,
      fontWeight: 800
    }
  }, label), /*#__PURE__*/React.createElement(AppText, {
    style: {
      fontSize: 10,
      color: "var(--text-muted)"
    }
  }, sub)))), stub ? /*#__PURE__*/React.createElement("div", {
    style: {
      background: "var(--surface-2)",
      borderRadius: 12,
      padding: 12
    }
  }, /*#__PURE__*/React.createElement(AppText, {
    style: {
      fontSize: 12,
      color: "var(--text-muted)",
      lineHeight: 1.42
    }
  }, stub, " logging doesn't exist yet \u2014 strength is the only activity type with a backend so far (ADR-0002). The picker is built for four so adding one is a screen, not a redesign.")) : null, /*#__PURE__*/React.createElement(FormSection, {
    title: "Name this session (optional)"
  }, /*#__PURE__*/React.createElement(FormTextField, {
    label: "Name",
    value: name,
    onChange: setName,
    placeholder: "Push day"
  })), /*#__PURE__*/React.createElement(Eyebrow, null, "Routines"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 6
    }
  }, data.routines.map(r => /*#__PURE__*/React.createElement("button", {
    key: r.id,
    type: "button",
    onClick: onStartFree,
    style: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      background: "var(--surface)",
      borderRadius: 14,
      border: "none",
      padding: 10,
      cursor: "pointer",
      textAlign: "left"
    }
  }, /*#__PURE__*/React.createElement(SportIcon, {
    sport: "strength",
    size: 40
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      display: "flex",
      flexDirection: "column",
      gap: 2
    }
  }, /*#__PURE__*/React.createElement(AppText, {
    style: {
      fontSize: 14,
      fontWeight: 700
    }
  }, r.name), /*#__PURE__*/React.createElement(AppText, {
    style: {
      fontSize: 11,
      color: "var(--text-muted)"
    }
  }, r.exercises.length, " exercises")), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 18,
      color: "var(--text-faint)",
      fontFamily: "var(--font-system)"
    }
  }, "\u203A")))));
}
function LanguageScreen() {
  const [locale, setLocale] = React.useState("en");
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 14,
      padding: "12px 20px 24px"
    }
  }, /*#__PURE__*/React.createElement(AppText, {
    variant: "caption"
  }, "Foundry follows your device language unless you choose one here."), /*#__PURE__*/React.createElement(Segmented, {
    value: locale,
    onChange: setLocale,
    options: [{
      value: "en",
      label: "English"
    }, {
      value: "nl",
      label: "Nederlands"
    }]
  }));
}
function SummaryScreen({
  onDone
}) {
  const {
    StatBox
  } = window.FoundryDesignSystem_397633;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 14,
      padding: "12px 20px 24px"
    }
  }, /*#__PURE__*/React.createElement(AppText, {
    style: {
      fontSize: 26,
      fontWeight: 800,
      letterSpacing: -0.5
    }
  }, "Push day"), /*#__PURE__*/React.createElement(AppText, {
    variant: "caption"
  }, "Wednesday 17 September \xB7 48 min"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(StatBox, {
    value: "14",
    label: "Sets"
  }), /*#__PURE__*/React.createElement(StatBox, {
    value: "3 120",
    unit: "kg",
    label: "Volume"
  }), /*#__PURE__*/React.createElement(StatBox, {
    value: "1",
    label: "PRs"
  })), /*#__PURE__*/React.createElement(Eyebrow, null, "Exercises"), [["Bench press", "4 sets · 60–70 kg"], ["Incline DB press", "3 sets · 22.5 kg"], ["Lateral raise", "3 sets · 10 kg"]].map(([n, s]) => /*#__PURE__*/React.createElement("div", {
    key: n,
    style: {
      background: "var(--surface)",
      borderRadius: 14,
      padding: 12,
      display: "flex",
      flexDirection: "column",
      gap: 2
    }
  }, /*#__PURE__*/React.createElement(AppText, {
    style: {
      fontSize: 14,
      fontWeight: 700
    }
  }, n), /*#__PURE__*/React.createElement(AppText, {
    variant: "caption"
  }, s))), /*#__PURE__*/React.createElement(PrimaryButton, {
    label: "Done",
    onClick: onDone
  }));
}
Object.assign(window, {
  ExercisesScreen,
  StartActivityScreen,
  LanguageScreen,
  SummaryScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/foundry-ios/PushedScreens.jsx", error: String((e && e.message) || e) }); }

// ui_kits/foundry-ios/SessionScreen.jsx
try { (() => {
const {
  AppText,
  Chip,
  StepperField,
  PrimaryButton,
  GhostButton,
  Sheet,
  SwipeableRow,
  Eyebrow,
  TextAction
} = window.FoundryDesignSystem_397633;
const SET_TYPES = ["warmup", "working", "drop", "failure"];
function SetTable({
  sets,
  onEdit
}) {
  const th = {
    fontFamily: "var(--font-system)",
    fontSize: 9,
    fontWeight: 800,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: "var(--text-faint)"
  };
  const td = {
    fontFamily: "var(--font-system)",
    fontSize: 12,
    fontWeight: 800,
    color: "var(--text)",
    fontVariantNumeric: "tabular-nums"
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 2
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      padding: "0 2px 4px"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      ...th,
      width: 26
    }
  }, "Set"), /*#__PURE__*/React.createElement("span", {
    style: {
      ...th,
      flex: 1
    }
  }, "Type"), /*#__PURE__*/React.createElement("span", {
    style: {
      ...th,
      width: 60,
      textAlign: "center"
    }
  }, "kg"), /*#__PURE__*/React.createElement("span", {
    style: {
      ...th,
      width: 44,
      textAlign: "center"
    }
  }, "Reps")), sets.length === 0 ? /*#__PURE__*/React.createElement(AppText, {
    variant: "caption"
  }, "Nothing logged yet.") : sets.map(s => /*#__PURE__*/React.createElement(SwipeableRow, {
    key: s.n,
    menuTitle: "Set " + s.n,
    actions: [{
      key: "edit",
      label: "Edit set",
      onPress: () => onEdit(s)
    }],
    style: {
      borderRadius: 0
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => onEdit(s),
    style: {
      width: "100%",
      display: "flex",
      alignItems: "center",
      gap: 6,
      height: 34,
      border: "none",
      background: "transparent",
      cursor: "pointer"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      ...td,
      width: 26,
      textAlign: "left"
    }
  }, s.n), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--font-system)",
      fontSize: 12,
      color: "var(--text-muted)",
      flex: 1,
      textAlign: "left"
    }
  }, s.type), /*#__PURE__*/React.createElement("span", {
    style: {
      ...td,
      width: 60,
      textAlign: "center"
    }
  }, s.weight), /*#__PURE__*/React.createElement("span", {
    style: {
      ...td,
      width: 44,
      textAlign: "center"
    }
  }, s.reps)))));
}
function SessionScreen({
  onCancelRequest
}) {
  const [sets, setSets] = React.useState(window.FOUNDRY_DATA.sets);
  const [weight, setWeight] = React.useState(60);
  const [reps, setReps] = React.useState(8);
  const [type, setType] = React.useState("working");
  const [editing, setEditing] = React.useState(null);
  const [plates, setPlates] = React.useState(false);
  const rest = window.useRestTimerMock();
  const log = () => {
    setSets(prev => [...prev, {
      n: prev.length + 1,
      type,
      weight,
      reps
    }]);
    if (type !== "warmup") rest.start();
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 12,
      padding: "12px 20px 40px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 6,
      height: 6,
      borderRadius: 9999,
      background: "var(--accent)"
    }
  }), /*#__PURE__*/React.createElement(AppText, {
    style: {
      fontSize: 12,
      fontWeight: 700,
      color: "var(--text-muted)",
      fontVariantNumeric: "tabular-nums"
    }
  }, "12:04")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      overflowX: "auto"
    }
  }, /*#__PURE__*/React.createElement(Chip, {
    label: "Bench press",
    active: true
  }), /*#__PURE__*/React.createElement(Chip, {
    label: "Incline DB press"
  }), /*#__PURE__*/React.createElement(Chip, {
    label: "Lateral raise"
  })), /*#__PURE__*/React.createElement(GhostButton, {
    label: "+ Add exercise",
    fullWidth: true
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between"
    }
  }, /*#__PURE__*/React.createElement(AppText, {
    style: {
      fontSize: 17,
      fontWeight: 800
    }
  }, "Bench press"), /*#__PURE__*/React.createElement(AppText, {
    style: {
      fontSize: 11,
      fontWeight: 700,
      color: "var(--text-muted)"
    }
  }, sets.length, " sets")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement(Chip, {
    label: "Last: 60 \xD7 8"
  }), /*#__PURE__*/React.createElement(Chip, {
    label: "Plates",
    onClick: () => setPlates(true)
  })), /*#__PURE__*/React.createElement(SetTable, {
    sets: sets,
    onEdit: setEditing
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6
    }
  }, SET_TYPES.map(t => /*#__PURE__*/React.createElement("span", {
    key: t,
    style: {
      flex: 1,
      display: "flex"
    }
  }, /*#__PURE__*/React.createElement(Chip, {
    label: t,
    active: t === type,
    onClick: () => setType(t),
    style: {
      flex: 1
    }
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 10,
      marginTop: 4
    }
  }, /*#__PURE__*/React.createElement(StepperField, {
    label: "kg",
    value: weight,
    step: 2.5,
    height: 56,
    onChange: setWeight,
    style: {
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: 14
    }
  }), /*#__PURE__*/React.createElement(StepperField, {
    label: "reps",
    value: reps,
    step: 1,
    min: 1,
    height: 56,
    onChange: setReps,
    style: {
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: 14
    }
  })), /*#__PURE__*/React.createElement(PrimaryButton, {
    label: "Log set " + (sets.length + 1),
    onClick: log
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "center",
      marginTop: 8
    }
  }, /*#__PURE__*/React.createElement(TextAction, {
    label: "Cancel workout",
    tone: "destructive",
    onClick: onCancelRequest
  })), plates ? /*#__PURE__*/React.createElement(Sheet, {
    title: weight + " kg",
    doneLabel: "Done",
    onDone: () => setPlates(false),
    detent: "medium"
  }, /*#__PURE__*/React.createElement(Eyebrow, null, "Per side"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 3,
      alignItems: "center",
      padding: "8px 0"
    }
  }, [20, 20].map((p, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    style: {
      width: 26,
      height: Math.max(18, Math.min(56, 18 + p * 1.5)),
      borderRadius: "var(--r-xs)",
      background: "var(--accent)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "var(--font-system)",
      fontSize: 9,
      fontWeight: 800,
      color: "var(--on-accent)"
    }
  }, p))), /*#__PURE__*/React.createElement(AppText, {
    variant: "caption"
  }, "20 + 20 per side, plus the 20 kg bar."), /*#__PURE__*/React.createElement(Eyebrow, null, "Warm-up"), [[20, 8, "empty bar"], [40, 5, "60%"], [50, 3, "80%"]].map(([w, r, p]) => /*#__PURE__*/React.createElement("div", {
    key: w,
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      background: "var(--surface-2)",
      borderRadius: "var(--r-md)",
      padding: 8
    }
  }, /*#__PURE__*/React.createElement(AppText, {
    style: {
      fontWeight: 800,
      width: 72
    }
  }, w, " kg"), /*#__PURE__*/React.createElement(AppText, {
    variant: "caption",
    style: {
      flex: 1
    }
  }, "\xD7 ", r), /*#__PURE__*/React.createElement(AppText, {
    variant: "caption"
  }, p)))) : null, editing ? /*#__PURE__*/React.createElement(Sheet, {
    title: "Set " + editing.n,
    subtitle: "Bench press",
    doneLabel: "Close",
    onDone: () => setEditing(null),
    detent: "large"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6
    }
  }, SET_TYPES.map(t => /*#__PURE__*/React.createElement("span", {
    key: t,
    style: {
      flex: 1,
      display: "flex"
    }
  }, /*#__PURE__*/React.createElement(Chip, {
    label: t,
    active: t === editing.type,
    style: {
      flex: 1
    }
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(StepperField, {
    label: "kg",
    value: editing.weight,
    step: 2.5,
    height: 56
  }), /*#__PURE__*/React.createElement(StepperField, {
    label: "reps",
    value: editing.reps,
    step: 1,
    height: 56
  })), /*#__PURE__*/React.createElement(PrimaryButton, {
    label: "No changes",
    disabled: true
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(GhostButton, {
    label: "Duplicate",
    fullWidth: true,
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement(GhostButton, {
    label: "Delete",
    tone: "destructive",
    fullWidth: true,
    style: {
      flex: 1
    }
  }))) : null);
}
Object.assign(window, {
  SessionScreen,
  SetTable
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/foundry-ios/SessionScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/foundry-ios/TrainScreen.jsx
try { (() => {
const {
  AppText,
  Chip,
  Eyebrow,
  SportIcon,
  PrimaryButton,
  GhostButton,
  TextAction,
  SwipeableRow,
  InsetList,
  InsetRow
} = window.FoundryDesignSystem_397633;
const FILTERS = ["All", "Strength", "Running", "Cycling", "WOD"];
function RoutineCard({
  routine,
  onStart,
  onEdit,
  onDelete
}) {
  const [open, setOpen] = React.useState(false);
  return /*#__PURE__*/React.createElement(SwipeableRow, {
    menuTitle: routine.name,
    open: open,
    onToggle: () => setOpen(!open),
    actions: [{
      key: "edit",
      label: "Edit",
      onPress: onEdit
    }, {
      key: "delete",
      label: "Delete",
      destructive: true,
      onPress: onDelete
    }]
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 10,
      padding: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(SportIcon, {
    sport: "strength",
    size: 40
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: "flex",
      flexDirection: "column",
      gap: 2
    }
  }, /*#__PURE__*/React.createElement(AppText, {
    style: {
      fontSize: 14,
      fontWeight: 700
    }
  }, routine.name), /*#__PURE__*/React.createElement(AppText, {
    style: {
      fontSize: 11,
      color: "var(--text-muted)"
    }
  }, routine.exercises.length, " exercises"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      gap: 6
    }
  }, routine.exercises.slice(0, 3).map(e => /*#__PURE__*/React.createElement(Chip, {
    key: e.name,
    label: e.name + " " + e.sets + "×" + e.reps
  })), routine.exercises.length > 3 ? /*#__PURE__*/React.createElement(Chip, {
    label: "+" + (routine.exercises.length - 3) + " more"
  }) : null), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement(PrimaryButton, {
    label: "Start",
    onClick: onStart,
    fullWidth: false,
    style: {
      flex: 1,
      padding: "12px 16px",
      fontSize: 13
    }
  }), /*#__PURE__*/React.createElement(GhostButton, {
    label: "Edit",
    onClick: onEdit
  }), /*#__PURE__*/React.createElement(GhostButton, {
    label: "Delete",
    tone: "destructive",
    onClick: onDelete
  }))));
}
function LibraryRow({
  sport,
  title,
  subtitle,
  onPress
}) {
  return /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onPress,
    style: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      background: "var(--surface)",
      borderRadius: 14,
      border: "none",
      padding: 12,
      cursor: "pointer",
      textAlign: "left"
    }
  }, /*#__PURE__*/React.createElement(SportIcon, {
    sport: sport,
    size: 40
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      display: "flex",
      flexDirection: "column",
      gap: 2
    }
  }, /*#__PURE__*/React.createElement(AppText, {
    style: {
      fontSize: 14,
      fontWeight: 700
    }
  }, title), /*#__PURE__*/React.createElement(AppText, {
    style: {
      fontSize: 11,
      color: "var(--text-muted)"
    }
  }, subtitle)), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 18,
      color: "var(--text-faint)",
      fontFamily: "var(--font-system)"
    }
  }, "\u203A"));
}
function TrainScreen({
  onStart,
  onOpenExercises,
  onDeleteRoutine
}) {
  const data = window.FOUNDRY_DATA;
  const [filter, setFilter] = React.useState("All");
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 14,
      padding: "12px 20px 24px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 7,
      overflowX: "auto"
    }
  }, FILTERS.map(x => /*#__PURE__*/React.createElement(Chip, {
    key: x,
    label: x,
    active: x === filter,
    onClick: () => setFilter(x)
  }))), /*#__PURE__*/React.createElement(PrimaryButton, {
    label: "Start activity",
    size: "md",
    onClick: onStart,
    style: {
      padding: "15px 24px"
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between"
    }
  }, /*#__PURE__*/React.createElement(Eyebrow, null, "Routines"), /*#__PURE__*/React.createElement(TextAction, {
    label: "New",
    style: {
      minHeight: 0,
      padding: 0,
      fontSize: 13,
      fontWeight: 800
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 8
    }
  }, data.routines.map(r => /*#__PURE__*/React.createElement(RoutineCard, {
    key: r.id,
    routine: r,
    onStart: onStart,
    onEdit: () => {},
    onDelete: () => onDeleteRoutine(r)
  }))), /*#__PURE__*/React.createElement(InsetList, {
    header: "Library"
  }, /*#__PURE__*/React.createElement(InsetRow, {
    leading: /*#__PURE__*/React.createElement(SportIcon, {
      sport: "strength",
      size: 30
    }),
    title: "Exercises",
    secondary: data.exercises.length + " exercises",
    chevron: true,
    onPress: onOpenExercises
  }), /*#__PURE__*/React.createElement(InsetRow, {
    leading: /*#__PURE__*/React.createElement(SportIcon, {
      sport: "wod",
      size: 30
    }),
    title: "WODs",
    secondary: "Benchmarks and your own, with scores",
    chevron: true,
    onPress: () => {}
  }), /*#__PURE__*/React.createElement(InsetRow, {
    leading: /*#__PURE__*/React.createElement(SportIcon, {
      sport: "wod",
      size: 30
    }),
    title: "Hosted workouts",
    secondary: "Join with a code, or run one",
    chevron: true,
    onPress: () => {}
  })));
}
Object.assign(window, {
  TrainScreen,
  RoutineCard,
  LibraryRow
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/foundry-ios/TrainScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/foundry-ios/data.js
try { (() => {
window.FOUNDRY_DATA = {
  recent: [{
    id: "s1",
    name: "Push day",
    when: "Mon 14 Sep",
    duration: "48 min"
  }, {
    id: "s2",
    name: "Leg day",
    when: "Sat 12 Sep",
    duration: "62 min"
  }, {
    id: "s3",
    name: "Free session",
    when: "Thu 10 Sep",
    duration: "31 min"
  }, {
    id: "s4",
    name: "Pull day",
    when: "Tue 8 Sep",
    duration: "45 min"
  }],
  routines: [{
    id: "r1",
    name: "Push day",
    exercises: [{
      name: "Bench press",
      sets: 4,
      reps: 8
    }, {
      name: "Incline DB press",
      sets: 3,
      reps: 10
    }, {
      name: "Lateral raise",
      sets: 3,
      reps: 15
    }, {
      name: "Triceps pushdown",
      sets: 3,
      reps: 12
    }]
  }, {
    id: "r2",
    name: "Leg day",
    exercises: [{
      name: "Back squat",
      sets: 5,
      reps: 5
    }, {
      name: "Romanian deadlift",
      sets: 3,
      reps: 8
    }, {
      name: "Leg press",
      sets: 3,
      reps: 12
    }, {
      name: "Standing calf raise",
      sets: 4,
      reps: 15
    }, {
      name: "Hanging leg raise",
      sets: 3,
      reps: 12
    }]
  }],
  exercises: [{
    id: "e1",
    name: "Back squat",
    category: "compound",
    equipment: "barbell",
    isDefault: true
  }, {
    id: "e2",
    name: "Bench press",
    category: "compound",
    equipment: "barbell",
    isDefault: true
  }, {
    id: "e3",
    name: "Deadlift",
    category: "compound",
    equipment: "barbell",
    isDefault: true
  }, {
    id: "e4",
    name: "Incline DB press",
    category: "compound",
    equipment: "dumbbell",
    isDefault: true
  }, {
    id: "e5",
    name: "Lateral raise",
    category: "isolation",
    equipment: "dumbbell",
    isDefault: true
  }, {
    id: "e6",
    name: "Triceps pushdown",
    category: "isolation",
    equipment: "cable",
    isDefault: true
  }, {
    id: "e7",
    name: "Zercher squat",
    category: "compound",
    equipment: "barbell",
    isDefault: false
  }],
  sets: [{
    n: 1,
    type: "warmup",
    weight: 40,
    reps: 10
  }, {
    n: 2,
    type: "working",
    weight: 60,
    reps: 8
  }],
  diary: {
    breakfast: [{
      id: "d1",
      name: "Skyr, plain",
      serving: "250 g",
      kcal: 158
    }, {
      id: "d2",
      name: "Oats",
      serving: "80 g",
      kcal: 304
    }],
    lunch: [{
      id: "d3",
      name: "Chicken thigh, grilled",
      serving: "180 g",
      kcal: 326
    }],
    dinner: [],
    snacks: [{
      id: "d4",
      name: "Banana",
      serving: "1 medium",
      kcal: 105
    }]
  }
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/foundry-ios/data.js", error: String((e && e.message) || e) }); }

__ds_ns.GhostButton = __ds_scope.GhostButton;

__ds_ns.PrimaryButton = __ds_scope.PrimaryButton;

__ds_ns.TextAction = __ds_scope.TextAction;

__ds_ns.AppText = __ds_scope.AppText;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.Chip = __ds_scope.Chip;

__ds_ns.EmptyState = __ds_scope.EmptyState;

__ds_ns.Eyebrow = __ds_scope.Eyebrow;

__ds_ns.Icon = __ds_scope.Icon;

__ds_ns.SkeletonBlock = __ds_scope.SkeletonBlock;

__ds_ns.SkeletonGroup = __ds_scope.SkeletonGroup;

__ds_ns.SportIcon = __ds_scope.SportIcon;

__ds_ns.StatBox = __ds_scope.StatBox;

__ds_ns.BucketChart = __ds_scope.BucketChart;

__ds_ns.DateStepper = __ds_scope.DateStepper;

__ds_ns.InsetList = __ds_scope.InsetList;

__ds_ns.InsetRow = __ds_scope.InsetRow;

__ds_ns.NutritionCalendar = __ds_scope.NutritionCalendar;

__ds_ns.ProgressRing = __ds_scope.ProgressRing;

__ds_ns.SwipeableRow = __ds_scope.SwipeableRow;

__ds_ns.TrendChart = __ds_scope.TrendChart;

__ds_ns.ConfirmDialog = __ds_scope.ConfirmDialog;

__ds_ns.OfflineBanner = __ds_scope.OfflineBanner;

__ds_ns.RestTimerBar = __ds_scope.RestTimerBar;

__ds_ns.Toast = __ds_scope.Toast;

__ds_ns.AddRow = __ds_scope.AddRow;

__ds_ns.DisclosureRow = __ds_scope.DisclosureRow;

__ds_ns.EditableValueRow = __ds_scope.EditableValueRow;

__ds_ns.FormSection = __ds_scope.FormSection;

__ds_ns.FormTextField = __ds_scope.FormTextField;

__ds_ns.GroupedSurface = __ds_scope.GroupedSurface;

__ds_ns.InlineNumberFieldRow = __ds_scope.InlineNumberFieldRow;

__ds_ns.SearchField = __ds_scope.SearchField;

__ds_ns.Segmented = __ds_scope.Segmented;

__ds_ns.StepperField = __ds_scope.StepperField;

__ds_ns.HeroCard = __ds_scope.HeroCard;

__ds_ns.MediaThumb = __ds_scope.MediaThumb;

__ds_ns.ActiveSessionBar = __ds_scope.ActiveSessionBar;

__ds_ns.NavBar = __ds_scope.NavBar;

__ds_ns.TabBar = __ds_scope.TabBar;

__ds_ns.Sheet = __ds_scope.Sheet;

})();
