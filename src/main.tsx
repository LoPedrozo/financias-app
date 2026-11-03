import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import ErroFatal from "./components/ErroFatal";
import "./styles/global.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErroFatal>
      <App />
    </ErroFatal>
  </React.StrictMode>
);
