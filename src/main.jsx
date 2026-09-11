import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AppProvider } from "./context/AppContext";
import App from "./App.jsx";
import "./index.css";

// Provider order matters here: BrowserRouter has to be outside AppProvider
// because AppContext's consumers (screens) use router hooks like
// useNavigate() -- if the order were reversed, those hooks would have
// nothing to attach to.
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <AppProvider>
        <App />
      </AppProvider>
    </BrowserRouter>
  </StrictMode>
);
