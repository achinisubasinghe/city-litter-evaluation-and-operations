import React from "react";
import ReactDOM from "react-dom/client";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import App from "./App";
import { LanguageProvider } from "./i18n/LanguageContext";
import "./index.css";

const convexUrl =
  (import.meta as unknown as { env?: { VITE_CONVEX_URL?: string } }).env
    ?.VITE_CONVEX_URL || "https://savory-ram-12.convex.cloud";

const convex = new ConvexReactClient(convexUrl);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ConvexProvider client={convex}>
      <LanguageProvider>
        <App />
      </LanguageProvider>
    </ConvexProvider>
  </React.StrictMode>
);
