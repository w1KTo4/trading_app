import api from './api';

export async function resolvePrimaryAccountId(accessToken, fallbackAccountId = 1) {
  try {
    const profile = await api.get('/api/auth/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return Number(profile.data.accountIds?.[0] || fallbackAccountId);
  } catch {
    return Number(fallbackAccountId || 1);
  }
}

export function storeAuthSession({ accessToken, refreshToken, email }, fallbackEmail, accountId) {
  localStorage.setItem('accessToken', accessToken);
  localStorage.setItem('refreshToken', refreshToken);
  localStorage.setItem('userEmail', email || fallbackEmail);
  localStorage.setItem('accountId', String(Number(accountId || 1)));
}
