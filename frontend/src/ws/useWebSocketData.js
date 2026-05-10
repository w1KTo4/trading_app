import { useContext } from 'react';
import { WebSocketContext } from './WebSocketContext';

export function useWebSocketData() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocketData must be used within WebSocketProvider');
  }
  return context;
}
