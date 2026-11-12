import { createRoot } from "react-dom/client";
import { VIEW_NAMES, type ViewName } from "../types";
import { ViewRoot } from "./ViewRoot";
import "./styles.css";

const requested = document.body.dataset.view;
const view = VIEW_NAMES.find((name) => name === requested) as ViewName;
const root = document.getElementById("root");
if (root && view) createRoot(root).render(<ViewRoot view={view} />);
