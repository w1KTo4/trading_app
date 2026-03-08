import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { apiBaseUrl } from '../services/api';

const WebSocketContext = createContext(null);

const resolveWsUrl = () => {
  const normalizeForSockJs = (url = '') => {
    const trimmed = String(url).trim().replace(/\/+$/, '');
    if (!trimmed) {
      return '';
    }

    let normalized = trimmed;
    if (normalized.startsWith('wss://')) {
      normalized = normalized.replace('wss://', 'https://');
    } else if (normalized.startsWith('ws://')) {
      normalized = normalized.replace('ws://', 'http://');
    }

    if (normalized.endsWith('/api')) {
      normalized = normalized.slice(0, -4);
    }

    return normalized;
  };

  const direct =
    (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_WS_URL) ||
    localStorage.getItem('wsUrl');

  if (direct) {
    const normalizedDirect = normalizeForSockJs(direct);
    if (normalizedDirect.endsWith('/ws')) {
      return normalizedDirect;
    }
    return `${normalizedDirect}/ws`;
  }

  const base = normalizeForSockJs(apiBaseUrl);
  if (base.startsWith('https://') || base.startsWith('http://')) {
    return `${base}/ws`;
  }
  return 'http://localhost:8080/ws';
};

export function WebSocketProvider({ children }) {
  const [connected, setConnected] = useState(false);
  const [latestPrices, setLatestPrices] = useState({});
  const [orderEvents, setOrderEvents] = useState([]);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    const email = localStorage.getItem('userEmail');

    const client = new Client({
      reconnectDelay: 3000,
      webSocketFactory: () => new SockJS(resolveWsUrl()),
      connectHeaders: token ? { Authorization: `Bearer ${token}` } : {},
      onConnect: () => {
        setConnected(true);

        client.subscribe('/topic/prices', (message) => {
          const tick = JSON.parse(message.body);
          setLatestPrices((prev) => ({ ...prev, [tick.symbol]: tick }));
        });

        client.subscribe('/user/queue/orders', (message) => {
          const event = JSON.parse(message.body);
          setOrderEvents((prev) => [event, ...prev].slice(0, 50));
        });

        if (email) {
          client.subscribe(`/topic/orders/${email}`, (message) => {
            const event = JSON.parse(message.body);
            setOrderEvents((prev) => [event, ...prev].slice(0, 50));
          });
        }
      },
      onDisconnect: () => setConnected(false),
      onStompError: () => setConnected(false),
      onWebSocketError: () => setConnected(false),
      onWebSocketClose: () => setConnected(false),
    });

    client.activate();
    return () => {
      setConnected(false);
      client.deactivate();
    };
  }, []);

  const value = useMemo(
    () => ({ connected, latestPrices, orderEvents }),
    [connected, latestPrices, orderEvents],
  );

  return <WebSocketContext.Provider value={value}>{children}</WebSocketContext.Provider>;
}

export const useWebSocketData = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocketData must be used within WebSocketProvider');
  }
  return context;
};
