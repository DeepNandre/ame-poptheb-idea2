import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LandingPage } from "./components/landing/LandingPage";

// Lazy-loaded so the heavy scanner bundle (mapbox, three, etc.) is only
// fetched when /app is visited — the public landing page stays lean.
const BuildingScannerProduct = lazy(() =>
  import("./components/BuildingScannerProduct").then((m) => ({
    default: m.BuildingScannerProduct,
  })),
);

// Judge-facing validation evidence pack, linked from the landing nav.
const EvidenceDashboard = lazy(() =>
  import("./components/validate/EvidenceDashboard").then((m) => ({
    default: m.EvidenceDashboard,
  })),
);

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public stealth teaser + early-access capture */}
        <Route path="/" element={<LandingPage />} />
        {/* The actual product, kept off the landing — not linked publicly */}
        <Route
          path="/app"
          element={
            <Suspense fallback={<div className="min-h-screen bg-black" />}>
              <BuildingScannerProduct />
            </Suspense>
          }
        />
        {/* Validation evidence pack for judges & investors */}
        <Route
          path="/validate"
          element={
            <Suspense fallback={<div className="min-h-screen bg-white" />}>
              <EvidenceDashboard />
            </Suspense>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
