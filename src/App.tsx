import React, { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Footer } from './components/Footer.tsx';
import { Navbar } from './components/Navbar.tsx';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { AdminDashboard } from './pages/AdminDashboard.tsx';
import { ForgotPasswordPage, LoginPage, RegisterPage } from './pages/AuthPages.tsx';
import { LandingPage } from './pages/LandingPage.tsx';
import { ParentDashboard } from './pages/ParentDashboard.tsx';
import { SearchTeachersPage } from './pages/SearchTeachersPage.tsx';
import {
  BantuanPage,
  CaraKerjaPage,
  LegalPage,
  TentangKamiPage,
  UnauthorizedPage,
} from './pages/StaticInfoPages.tsx';
import { StudentDashboard } from './pages/StudentDashboard.tsx';
import { TeacherDashboard } from './pages/TeacherDashboard.tsx';
import { TeacherDetailPage } from './pages/TeacherDetailPage.tsx';
import { TeacherRegisterPage } from './pages/TeacherRegisterPage.tsx';
import { VirtualClassroomPage } from './pages/VirtualClassroomPage.tsx';
import type { UserRole } from './types/index.ts';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function RoleRoute({
  allowedRoles,
  children,
}: {
  allowedRoles: UserRole[];
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16">
        <div className="h-40 rounded-2xl bg-slate-100 animate-pulse" />
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (!allowedRoles.includes(user.role)) {
    return <UnauthorizedPage />;
  }
  return <>{children}</>;
}

function AppShell() {
  return (
    <div className="min-h-screen flex flex-col bg-white text-[#1F2937]">
      <ScrollToTop />
      <Navbar />
      <div className="flex-1">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/cari-guru" element={<SearchTeachersPage />} />
          <Route path="/guru/:id" element={<TeacherDetailPage />} />
          <Route path="/daftar-guru" element={<TeacherRegisterPage />} />
          <Route path="/cara-kerja" element={<CaraKerjaPage />} />
          <Route path="/tentang" element={<TentangKamiPage />} />
          <Route path="/bantuan" element={<BantuanPage />} />
          <Route path="/kebijakan-privasi" element={<LegalPage type="privacy" />} />
          <Route path="/syarat-ketentuan" element={<LegalPage type="terms" />} />

          <Route path="/login" element={<LoginPage />} />
          <Route path="/daftar" element={<RegisterPage />} />
          <Route path="/lupa-password" element={<ForgotPasswordPage />} />
          <Route path="/403" element={<UnauthorizedPage />} />

          <Route
            path="/dashboard/siswa"
            element={
              <RoleRoute allowedRoles={['student', 'admin']}>
                <StudentDashboard />
              </RoleRoute>
            }
          />
          <Route
            path="/dashboard/guru"
            element={
              <RoleRoute allowedRoles={['teacher', 'admin']}>
                <TeacherDashboard />
              </RoleRoute>
            }
          />
          <Route
            path="/dashboard/orang-tua"
            element={
              <RoleRoute allowedRoles={['parent', 'admin']}>
                <ParentDashboard />
              </RoleRoute>
            }
          />
          <Route
            path="/dashboard/admin"
            element={
              <RoleRoute allowedRoles={['admin']}>
                <AdminDashboard />
              </RoleRoute>
            }
          />
          <Route
            path="/kelas/:bookingId"
            element={
              <RoleRoute allowedRoles={['student', 'teacher', 'admin']}>
                <VirtualClassroomPage />
              </RoleRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </BrowserRouter>
  );
}
