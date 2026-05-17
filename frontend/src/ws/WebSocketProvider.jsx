import { useEffect, useMemo, useState } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { apiBaseUrl } from '../services/api';
import { WebSocketContext } from './WebSocketContext';

const buildOrderEventKey = (event = {}) =>
  [event.orderId ?? event.id ?? '', event.status ?? '', event.filledPrice ?? '', event.symbol ?? ''].join('|');

const appendOrderEvent = (previousEvents, nextEvent) => {
  const nextKey = buildOrderEventKey(nextEvent);
  const deduped = previousEvents.filter((event) => buildOrderEventKey(event) !== nextKey);
  return [nextEvent, ...deduped].slice(0, 50);
};

const buildPaymentEventKey = (event = {}) =>
  [
    event.type ?? '',
    event.correlationId ?? '',
    event.status ?? '',
    event.amount ?? '',
    event.balanceAfter ?? '',
    event.createdAt ?? '',
  ].join('|');

const appendPaymentEvent = (previousEvents, nextEvent) => {
  const nextKey = buildPaymentEventKey(nextEvent);
  const deduped = previousEvents.filter((event) => buildPaymentEventKey(event) !== nextKey);
  return [nextEvent, ...deduped].slice(0, 80);
};

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
  const [paymentEvents, setPaymentEvents] = useState([]);

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
          setOrderEvents((prev) => appendOrderEvent(prev, event));
        });

        client.subscribe('/user/queue/payments', (message) => {
          const event = JSON.parse(message.body);
          setPaymentEvents((prev) => appendPaymentEvent(prev, event));
        });

        if (email) {
          client.subscribe(`/topic/orders/${email}`, (message) => {
            const event = JSON.parse(message.body);
            setOrderEvents((prev) => appendOrderEvent(prev, event));
          });

          client.subscribe(`/topic/payments/${email}`, (message) => {
            const event = JSON.parse(message.body);
            setPaymentEvents((prev) => appendPaymentEvent(prev, event));
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
    () => ({ connected, latestPrices, orderEvents, paymentEvents }),
    [connected, latestPrices, orderEvents, paymentEvents],
  );

  return <WebSocketContext.Provider value={value}>{children}</WebSocketContext.Provider>;
}
