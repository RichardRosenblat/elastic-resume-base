import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { AuthProvider } from './contexts/AuthContext';
import { theme } from './theme';
import './i18n';

import AppLayout from './components/Layout/AppLayout';
import ProtectedRoute from './components/ProtectedRoute';

import LoginPage from './pages/Login/LoginPage';
import DashboardPage from './pages/Dashboard/DashboardPage';
import UsersPage from './pages/Users/UsersPage';
import ResumesPage from './pages/Resumes/ResumesPage';
import SearchPage from './pages/Search/SearchPage';
import AccountPage from './pages/Account/AccountPage';
import NotFoundPage from './pages/NotFound/NotFoundPage';

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/resumes" element={<ResumesPage />} />
                <Route path="/search" element={<SearchPage />} />
                <Route path="/account" element={<AccountPage />} />
              </Route>
            </Route>
            <Route element={<ProtectedRoute adminOnly />}>
              <Route element={<AppLayout />}>
                <Route path="/users" element={<UsersPage />} />
              </Route>
            </Route>
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}
