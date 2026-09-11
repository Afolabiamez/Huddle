import { Routes, Route, Navigate } from "react-router-dom";
import { RequireAuth } from "./routes/RequireAuth";
import { OnboardingScreen } from "./screens/OnboardingScreen";
import { AuthScreen } from "./screens/AuthScreen";
import { ChannelListScreen } from "./screens/ChannelListScreen";
import { CreateChannelScreen } from "./screens/CreateChannelScreen";
import { ChannelViewScreen } from "./screens/ChannelViewScreen";

// The whole Sprint 1 scope, laid out as a URL map. Reading top to bottom:
// public routes first, then everything behind RequireAuth.
export default function App() {
  return (
    // This centered, max-width wrapper is a presentation choice only -- it
    // keeps the layout visually close to the mobile mockups on a wide
    // desktop screen. The PRD's quality bar targets a standard desktop
    // browser, not a native mobile app, so nothing here blocks the page
    // from being genuinely responsive later -- it's one wrapper to loosen.
    <div className="w-full min-h-screen flex justify-center bg-neutral-100">
      <div className="w-full max-w-[420px] bg-white min-h-screen shadow-xl">
        <Routes>
          <Route path="/" element={<OnboardingScreen />} />
      <Route path="/auth" element={<AuthScreen />} />

      <Route
        path="/channels"
        element={
          <RequireAuth>
            <ChannelListScreen />
          </RequireAuth>
        }
      />
      <Route
        path="/channels/new"
        element={
          <RequireAuth>
            <CreateChannelScreen />
          </RequireAuth>
        }
      />
      <Route
        path="/channels/:channelId"
        element={
          <RequireAuth>
            <ChannelViewScreen />
          </RequireAuth>
        }
      />

          {/* Anything unrecognised sends the person back to the start. */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  );
}
