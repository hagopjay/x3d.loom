import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import BridgeApp from "./BridgeApp";
import Tour from "./tour/Tour";
// Front door: the guided tour. ?lab=1 opens the bridge lab, ?workspace=1 the original workbench.
const params = new URLSearchParams(location.search);
const Root = params.has("workspace") ? App : params.has("lab") ? BridgeApp : Tour;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>
);
