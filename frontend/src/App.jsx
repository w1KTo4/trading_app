import { useEffect, useMemo, useState } from 'react';
import { BrowserRouter, NavLink, Navigate, Route, Routes } from 'react-router-dom';
import './App.css';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Market from './pages/Market';
import Portfolio from './pages/Portfolio';
import Instrument from './pages/Instrument';
import { WebSocketProvider, useWebSocketData } from './ws/WebSocketProvider';

function Layout({ email, accountId, onLogout, children }) {
  const { connected } = useWebSocketData();

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <h1>Trading Station</h1>
          <p className="muted">Szybsze przejscia, prostsze portfolio i czytelniejszy handel.</p>
        </div>
        <nav className="nav">
          <NavLink to="/dashboard" className={({ isActive }) => `tab-link ${isActive ? 'active' : ''}`}>
            Terminal
          </NavLink>
          <NavLink to="/market" className={({ isActive }) => `tab-link ${isActive ? 'active' : ''}`}>
            Rynek
          </NavLink>
          <NavLink to="/portfolio" className={({ isActive }) => `tab-link ${isActive ? 'active' : ''}`}>
            Portfolio
          </NavLink>
          <span className={`status-pill ${connected ? 'is-live' : ''}`}>WS: {connected ? 'online' : 'offline'}</span>
          <span className="status-pill">Konto #{accountId || 1}</span>
          <span className="status-pill">{email}</span>
          <button className="button ghost" onClick={onLogout}>
            Wyloguj
          </button>
        </nav>
      </header>
      <main>{children}</main>
    </div>
  );
}

function ProtectedRoute({ token, children }) {
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function App() {
  const [token, setToken] = useState(localStorage.getItem('accessToken'));
  const [email, setEmail] = useState(localStorage.getItem('userEmail'));
  const [accountId, setAccountId] = useState(Number(localStorage.getItem('accountId') || 1));

  useEffect(() => {
    const storedToken = localStorage.getItem('accessToken');
    const storedEmail = localStorage.getItem('userEmail');
    const storedAccountId = Number(localStorage.getItem('accountId') || 1);
    setToken(storedToken);
    setEmail(storedEmail);
    setAccountId(storedAccountId);
  }, []);

  const syncAccountId = (nextAccountId) => {
    const resolvedAccountId = Number(nextAccountId || 1);
    localStorage.setItem('accountId', String(resolvedAccountId));
    setAccountId(resolvedAccountId);
  };

  const onAuthSuccess = ({ token: nextToken, email: nextEmail, accountId: nextAccountId }) => {
    setToken(nextToken);
    setEmail(nextEmail);
    syncAccountId(nextAccountId || 1);
  };

  const onLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('accountId');
    setToken(null);
    setEmail(null);
    setAccountId(1);
  };

  const wsKey = useMemo(() => token || 'no-token', [token]);

  return (
    <BrowserRouter>
      <WebSocketProvider key={wsKey}>
        <Routes>
          <Route path="/login" element={<Login onAuthSuccess={onAuthSuccess} />} />
          <Route path="/register" element={<Register />} />

          <Route
            path="/dashboard"
            element={
              <ProtectedRoute token={token}>
                <Layout email={email} accountId={accountId} onLogout={onLogout}>
                  <Dashboard accountId={accountId} onAccountChange={syncAccountId} />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/market"
            element={
              <ProtectedRoute token={token}>
                <Layout email={email} accountId={accountId} onLogout={onLogout}>
                  <Market />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/portfolio"
            element={
              <ProtectedRoute token={token}>
                <Layout email={email} accountId={accountId} onLogout={onLogout}>
                  <Portfolio accountId={accountId} onAccountChange={syncAccountId} />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/instrument/:symbol"
            element={
              <ProtectedRoute token={token}>
                <Layout email={email} accountId={accountId} onLogout={onLogout}>
                  <Instrument accountId={accountId} />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to={token ? '/dashboard' : '/login'} replace />} />
        </Routes>
      </WebSocketProvider>
    </BrowserRouter>
  );
}

export default App;
