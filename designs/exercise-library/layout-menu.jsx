import React from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { Menu } from "@base-ui/react/menu";

let root;

function LayoutThumbnail({ grouped }) {
	return (
		<svg className="layout-thumbnail" viewBox="0 0 68 120" aria-hidden="true">
			<rect className="mini-device" x="8" y="3" width="52" height="112" rx="9" />
			<path className="mini-notch" d="M29 9h10" />
			{grouped ? (
				<>
					<rect className="mini-heading" x="15" y="23" width="19" height="4" rx="2" />
					<rect className="mini-surface" x="15" y="31" width="38" height="26" rx="4" />
					<path className="mini-row" d="M20 40h28M20 48h23" />
					<rect className="mini-heading" x="15" y="67" width="16" height="4" rx="2" />
					<rect className="mini-surface" x="15" y="75" width="38" height="26" rx="4" />
					<path className="mini-row" d="M20 84h28M20 92h23" />
				</>
			) : (
				<>
					<rect className="mini-surface" x="15" y="23" width="38" height="78" rx="4" />
					{[34, 48, 62, 76, 90].map((y) => <path key={y} className="mini-row" d={`M20 ${y}h28`} />)}
				</>
			)}
		</svg>
	);
}

function LayoutMenu({ value, onChange }) {
	return (
		<Menu.Root orientation="horizontal">
			<Menu.Trigger id="layout-menu-button" className="icon-button" aria-label="Library layout">
				<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></svg>
			</Menu.Trigger>
			<Menu.Portal container={document.getElementById("phone")}>
				<Menu.Positioner className="menu-positioner" side="bottom" align="end" sideOffset={8}>
					<Menu.Popup className="header-menu visual-layout-menu">
						<Menu.Group>
							<Menu.GroupLabel className="sr-only">View library</Menu.GroupLabel>
							<Menu.RadioGroup className="layout-options" value={value} onValueChange={(v) => setTimeout(() => onChange(v), 0)}>
								{[["inset", "List"], ["muscle", "Muscle groups"]].map(([v, label]) => (
									<Menu.RadioItem className="visual-layout-option" key={v} value={v}>
										<LayoutThumbnail grouped={v === "muscle"} />
										<span className="layout-option-label">{label}</span>
										<span className="layout-option-check" aria-hidden="true"><Menu.RadioItemIndicator>✓</Menu.RadioItemIndicator></span>
									</Menu.RadioItem>
								))}
							</Menu.RadioGroup>
						</Menu.Group>
					</Menu.Popup>
				</Menu.Positioner>
			</Menu.Portal>
		</Menu.Root>
	);
}

window.exerciseLayoutMenu = {
	mount(element, value, onChange) {
		root = createRoot(element);
		flushSync(() => root.render(<LayoutMenu value={value} onChange={onChange} />));
	},
	unmount() {
		if (root) { root.unmount(); root = null; }
	},
};
