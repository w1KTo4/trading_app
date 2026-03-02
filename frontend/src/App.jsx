import { useEffect, useMemo, useState } from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom';
import './App.css';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Market from './pages/Market';
import Instrument from './pages/Instrument';
import { WebSocketProvider, useWebSocketData } from './ws/WebSocketProvider';

function Layout({ email, onLogout, children }) {
  const { connected } = useWebSocketData();

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <h1>Paper Trading MVP</h1>
          <p className="muted">WS: {connected ? 'online' : 'offline'}</p>
        </div>
        <nav className="nav">
          <Link to="/dashboard">Dashboard</Link>
          <Link to="/market">Rynek</Link>
          <span>{email}</span>
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

  const onAuthSuccess = ({ token: nextToken, email: nextEmail, accountId: nextAccountId }) => {
    setToken(nextToken);
    setEmail(nextEmail);
    setAccountId(nextAccountId || 1);
  };

  const onLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('accountId');
    setToken(null);
    setEmail(null);
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
                <Layout email={email} onLogout={onLogout}>
                  <Dashboard accountId={accountId} />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/market"
            element={
              <ProtectedRoute token={token}>
                <Layout email={email} onLogout={onLogout}>
                  <Market />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/instrument/:symbol"
            element={
              <ProtectedRoute token={token}>
                <Layout email={email} onLogout={onLogout}>
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
