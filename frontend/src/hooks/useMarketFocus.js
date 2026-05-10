import { useEffect } from 'react';
import api from '../services/api';

const normalizeSymbols = (symbols = []) =>
  Array.from(
    new Set(
      symbols
        .map((symbol) => String(symbol ?? '').trim().toUpperCase())
        .filter(Boolean),
    ),
  ).slice(0, 8);

function useMarketFocus(symbols = []) {
  const symbolsKey = normalizeSymbols(symbols).join('|');

  useEffect(() => {
    if (!symbolsKey) {
      return undefined;
    }

    let disposed = false;
    const focusSymbols = symbolsKey.split('|');

    const syncFocus = async () => {
      try {
        await api.post('/api/market/focus', { symbols: focusSymbols });
      } catch {
        if (!disposed) {
          // Silently ignore focus sync failures to keep the UI responsive.
        }
      }
    };

    syncFocus();
    const intervalId = window.setInterval(syncFocus, 45000);

    return () => {
      disposed = true;
      window.clearInterval(intervalId);
    };
  }, [symbolsKey]);
}

export default useMarketFocus;
