import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { resolvePrimaryAccountId, storeAuthSession } from '../services/authSession';

function Register({ onAuthSuccess }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const normalizedEmail = email.trim().toLowerCase();
      const { data } = await api.post('/api/auth/register', { email: normalizedEmail, password });
      const accountId = await resolvePrimaryAccountId(data.accessToken, 1);
      storeAuthSession(data, normalizedEmail, accountId);
      onAuthSuccess?.({ token: data.accessToken, email: data.email || normalizedEmail, accountId });
      navigate('/dashboard');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Blad rejestracji');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <form className="card auth-card" onSubmit={handleSubmit}>
        <h2>Rejestracja</h2>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Haslo
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="button" type="submit" disabled={loading}>
          {loading ? 'Tworzenie...' : 'Utworz konto'}
        </button>
        <p>
          Masz konto? <Link to="/login">Logowanie</Link>
        </p>
      </form>
    </div>
  );
}

export default Register;
