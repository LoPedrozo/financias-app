import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import ErroFatal from "./components/ErroFatal";
import { PreferenciasProvider } from "./hooks/usePreferencias";
import "./styles/global.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErroFatal>
      <PreferenciasProvider>
        <App />
      </PreferenciasProvider>
    </ErroFatal>
  </React.StrictMode>
);
