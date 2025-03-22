import React from "react";
import ReactDOM from "react-dom/client";  // Nieuw: juiste import voor React 18
import App from "./App.js";
import connectDB from "./db.js";

// Initialize MongoDB connection
(async () => {
  try {
    await connectDB();
    console.log('MongoDB connection initialized in index.js');
  } catch (err) {
    console.error('Failed to initialize MongoDB connection:', err);
    console.log('Application will continue to run, but database features may not work');
  }
})();

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);