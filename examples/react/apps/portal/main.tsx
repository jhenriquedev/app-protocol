import ReactDOM from "react-dom/client";

import { renderRoot } from "./app";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Portal root element #root was not found.");
}

ReactDOM.createRoot(rootElement).render(renderRoot());
