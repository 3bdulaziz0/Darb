/**
 * OWNER: teammate A (shell + routing).
 *
 * DONE:  every route below renders standalone with mock data.
 * TODO:  nothing here until real state exists. Resist adding a state library —
 *        the MVP has no persistent user state (PRD 10).
 *
 * The phone frame: on a phone the app is full-bleed. On a desktop it is
 * centred at 430px so the mobile-first layout is never stretched.
 */

import { Navigate, Route, Routes } from 'react-router-dom';
import CameraPage from './pages/CameraPage';
import StoryPage from './pages/StoryPage';
import NotFoundLandmarkPage from './pages/NotFoundLandmarkPage';
import DiscoveryPage from './pages/DiscoveryPage';
import SettingsPage from './pages/SettingsPage';

export default function App() {
  return (
    <div className="flex h-full justify-center bg-black">
      <main className="relative h-full w-full max-w-[430px] overflow-hidden bg-bg">
        <Routes>
          {/* Teammate A */}
          <Route path="/" element={<CameraPage />} />

          {/* Teammate C */}
          <Route path="/story/:id" element={<StoryPage />} />
          <Route path="/not-found" element={<NotFoundLandmarkPage />} />
          {/* Honest mode used to live at /unknown. Kept so any link that is
              still in flight lands in the right place. */}
          <Route path="/unknown" element={<Navigate to="/not-found" replace />} />
          <Route path="/discover" element={<DiscoveryPage />} />
          <Route path="/settings" element={<SettingsPage />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
