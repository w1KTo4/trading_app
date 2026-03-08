import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';

function Login({ onAuthSuccess }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState('test@test.com');
  const [password, setPassword] = useState('test123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const normalizedEmail = email.trim().toLowerCase();
      const { data } = await api.post('/api/auth/login', { email: normalizedEmail, password });

      let accountId = Number(localStorage.getItem('accountId') || 1);
      try {
        const profile = await api.get('/api/auth/me', {
          headers: { Authorization: `Bearer ${data.accessToken}` },
        });
        accountId = profile.data.accountIds?.[0] || accountId;
      } catch (_profileError) {
        // Nie blokuj logowania, jesli /me chwilowo zwroci blad.
      }

      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      localStorage.setItem('userEmail', data.email || normalizedEmail);
      localStorage.setItem('accountId', String(accountId));

      onAuthSuccess?.({ token: data.accessToken, email: data.email || normalizedEmail, accountId });
      navigate('/dashboard');
    } catch (requestError) {
      const backendMessage = requestError.response?.data?.message;
      if (backendMessage) {
        setError(backendMessage);
      } else if (!requestError.response) {
        setError('Brak polaczenia z backendem albo blokada CORS.');
      } else {
        setError(`Blad logowania (HTTP ${requestError.response.status})`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <form className="card auth-card" onSubmit={handleSubmit}>
        <h2>Logowanie</h2>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Haslo
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="button" type="submit" disabled={loading}>
          {loading ? 'Logowanie...' : 'Zaloguj'}
        </button>
        <p>
          Nie masz konta? <Link to="/register">Rejestracja</Link>
        </p>
      </form>
    </div>
  );
}

export default Login;
