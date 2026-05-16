// Rest of the imports
import React from "react";
import ReactDOM from "react-dom/client";  // Nieuw: juiste import voor React 18
import App from "./App.js";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
