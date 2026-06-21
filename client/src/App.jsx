import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { NotesProvider } from './context/NotesContext';

import ProtectedRoute from './components/Auth/ProtectedRoute';
import GuestRoute from './components/Auth/GuestRoute';
import DashboardLayout from './components/Layout/DashboardLayout';
import OfflineBanner from './components/OfflineBanner/OfflineBanner';

import './styles/globals.css';
import Navbar from './components/Navbar/Navbar';
import Hero from './components/Hero/Hero';
import Marquee from './components/Marquee/Marquee';
import Features from './components/Features/Features';
import CTA from './components/CTA/CTA';
import Footer from './components/Footer/Footer';
import Cursor from './components/Cursor/Cursor';
import GrainOverlay from './components/GrainOverlay/GrainOverlay';

import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';

import SharedNotePage from './pages/shared/SharedNotePage';

import DashboardPage from './pages/Dashboard/DashboardPage';
import ExplorePage from './pages/Dashboard/ExplorePage';
import AnalyticsPage from './pages/Dashboard/AnalyticsPage';
import SettingsPage from './pages/Dashboard/SettingsPage';

function LandingPage() {
  return (
    <>
      <Cursor />
      <GrainOverlay />
      <Navbar />
      <Hero />
      <Marquee />
      <Features />
      <CTA />
      <Footer />
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      {/* OfflineBanner sits outside BrowserRouter so it's truly global */}

      <BrowserRouter>
        <OfflineBanner />
        <AuthProvider>
          <Routes>
            {/* Public landing */}
            <Route path="/" element={<LandingPage />} />

            {/* Public shared note (no auth needed) */}
            <Route path="/shared/:token" element={<SharedNotePage />} />

            {/* Auth (guests only) */}
            <Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
            <Route path="/register" element={<GuestRoute><RegisterPage /></GuestRoute>} />

            {/* Dashboard (authenticated) */}
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <NotesProvider>
                  <DashboardLayout />
                </NotesProvider>
              </ProtectedRoute>
            }>
              <Route index element={<DashboardPage />} />
              <Route path="explore" element={<ExplorePage />} />
              <Route path="analytics" element={<AnalyticsPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>

            {/* 404 fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}
