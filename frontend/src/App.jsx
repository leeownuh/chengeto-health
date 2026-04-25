/**
 * CHENGETO Health - Main Application Component
 * Progressive Web App for elderly care monitoring
 */

import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Box, Button, CircularProgress, Snackbar, Alert as MuiAlert } from '@mui/material';
import { SnackbarProvider } from 'notistack';

// Context providers
import { AuthProvider } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import { OfflineProvider } from './contexts/OfflineContext';
import { ThemeModeProvider } from './contexts/ThemeModeContext';

// Layout components
import MainLayout from './components/layout/MainLayout';
import AuthLayout from './components/layout/AuthLayout';

// Auth pages
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';
import MFASetupPage from './pages/auth/MFASetupPage';

// Dashboard pages
import AdminDashboard from './pages/dashboard/AdminDashboard';
import CaregiverDashboard from './pages/dashboard/CaregiverDashboard';
import CHWDashboard from './pages/dashboard/CHWDashboard';
import ClinicianDashboard from './pages/dashboard/ClinicianDashboard';
import FamilyDashboard from './pages/dashboard/FamilyDashboard';

// Patient pages
import PatientListPage from './pages/patients/PatientListPage';
import PatientDetailPage from './pages/patients/PatientDetailPage';
import PatientFormPage from './pages/patients/PatientFormPage';
import PatientVitalsPage from './pages/patients/PatientVitalsPage';

// Alert pages
import AlertsPage from './pages/alerts/AlertsPage';
import AlertDetailPage from './pages/alerts/AlertDetailPage';

// Check-in pages
import CheckInPage from './pages/checkin/CheckInPage';
import CheckInHistoryPage from './pages/checkin/CheckInHistoryPage';
import SchedulePage from './pages/checkin/SchedulePage';

// Settings pages
import SettingsPage from './pages/settings/SettingsPage';
import ProfilePage from './pages/settings/ProfilePage';

// IoT pages
import DeviceSimulatorPage from './pages/iot/DeviceSimulatorPage';

// Guards
import PrivateRoute from './components/guards/PrivateRoute';
import RoleRoute from './components/guards/RoleRoute';

// Loading component
const LoadingScreen = () => (
  <Box
    sx={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      bgcolor: 'background.default',
    }}
  >
    <Box sx={{ textAlign: 'center' }}>
      <CircularProgress size={48} />
      <Box sx={{ mt: 2, color: 'text.secondary' }}>Loading CHENGETO Health...</Box>
    </Box>
  </Box>
);

function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState(null);

  const promptForUpdate = useCallback((registration) => {
    const worker = registration?.waiting;
    if (!worker) return;
    setWaitingWorker(worker);
    setUpdateAvailable(true);
  }, []);

  const applyUpdate = useCallback(async () => {
    try {
      if (waitingWorker) {
        waitingWorker.postMessage({ type: 'SKIP_WAITING' });
      }
    } finally {
      setUpdateAvailable(false);
    }
  }, [waitingWorker]);

  useEffect(() => {
    // Initialize app
    const initApp = async () => {
      // In the live dev-server setup we use for this deployment, stale SW caches
      // can keep serving old shells even after code fixes.
      if ('serviceWorker' in navigator && !import.meta.env.PROD) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));
      } else if ('serviceWorker' in navigator && import.meta.env.PROD) {
        try {
          const registration = await navigator.serviceWorker.register('/sw.js');
          console.log('Service Worker registered');

          // If an update is already waiting, prompt immediately.
          if (registration.waiting) {
            promptForUpdate(registration);
          }

          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (!newWorker) return;

            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                promptForUpdate(registration);
              }
            });
          });

          // When the new SW takes control, reload to get the fresh assets.
          navigator.serviceWorker.addEventListener('controllerchange', () => {
            window.location.reload();
          });
        } catch (error) {
          console.error('Service Worker registration failed:', error);
        }
      }
      
      // Simulate initial load
      setTimeout(() => setIsLoading(false), 500);
    };

    initApp();
  }, []);

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <ThemeModeProvider>
      <SnackbarProvider
        maxSnack={5}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        autoHideDuration={5000}
      >
        <AuthProvider>
          <OfflineProvider>
            <SocketProvider>
              <Router>
                <Routes>
                  {/* Public routes */}
                  <Route element={<AuthLayout />}>
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/register" element={<RegisterPage />} />
                    <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                    <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
                    <Route path="/mfa-setup" element={<MFASetupPage />} />
                  </Route>

                  {/* Protected routes */}
                  <Route element={<PrivateRoute />}>
                    <Route element={<MainLayout />}>
                      {/* Dashboard routes */}
                      <Route path="/" element={<Navigate to="/dashboard" replace />} />
                      <Route
                        path="/dashboard"
                        element={
                          <RoleRoute
                            roles={{
                              admin: <AdminDashboard />,
                              caregiver: <CaregiverDashboard />,
                              chw: <CHWDashboard />,
                              clinician: <ClinicianDashboard />,
                              family: <FamilyDashboard />,
                            }}
                          />
                        }
                      />

                      {/* Patient routes */}
                      <Route path="/patients" element={<PatientListPage />} />
                      <Route path="/patients/new" element={<PatientFormPage />} />
                      <Route path="/patients/:id" element={<PatientDetailPage />} />
                      <Route path="/patients/:id/edit" element={<PatientFormPage />} />
                      <Route path="/patients/:id/vitals" element={<PatientVitalsPage />} />

                      {/* Alert routes */}
                      <Route path="/alerts" element={<AlertsPage />} />
                      <Route path="/alerts/:id" element={<AlertDetailPage />} />

                      {/* Check-in routes */}
                      <Route path="/checkin" element={<CheckInPage />} />
                      <Route path="/checkin/history" element={<CheckInHistoryPage />} />
                      <Route path="/schedule" element={<SchedulePage />} />

                      {/* Settings routes */}
                      <Route path="/settings" element={<SettingsPage />} />
                      <Route path="/profile" element={<ProfilePage />} />

                      {/* IoT routes (simulator / demo) */}
                      <Route
                        path="/iot/simulator"
                        element={
                          <RoleRoute
                            roles={{
                              admin: <DeviceSimulatorPage />,
                              chw: <DeviceSimulatorPage />
                            }}
                          />
                        }
                      />
                    </Route>
                  </Route>

                  {/* Catch-all redirect */}
                  <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>

                <Snackbar
                  open={updateAvailable}
                  onClose={() => setUpdateAvailable(false)}
                  anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                >
                  <MuiAlert
                    severity="info"
                    variant="filled"
                    action={
                      <Button color="inherit" size="small" onClick={applyUpdate}>
                        Update
                      </Button>
                    }
                    sx={{ width: '100%' }}
                  >
                    A new version of CHENGETO is available.
                  </MuiAlert>
                </Snackbar>
              </Router>
            </SocketProvider>
          </OfflineProvider>
        </AuthProvider>
      </SnackbarProvider>
    </ThemeModeProvider>
  );
}

export default App;
