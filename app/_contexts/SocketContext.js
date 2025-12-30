import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';

import { readTokenFromCookie, WEB_SOCKET_URL } from '@/app/_components/utils/Constants';

const defaultValue = {
  socket: null,
  isLoading: true,
  isConnected: false,
  error: null,
  subscribe: () => { },
  unsubscribe: () => { },
  disconnect: () => { },
  reconnect: () => { },
};

const SocketContext = createContext(defaultValue);

export function SocketProvider({ children }) {
  const socketRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setIsLoading(true);
    setError(null);

    console.log('SocketProvider: connecting to socket at', WEB_SOCKET_URL, 'with token', readTokenFromCookie());
    const socket = io(WEB_SOCKET_URL, {
      transports: ['websocket'],
      auth: readTokenFromCookie() ? { token: readTokenFromCookie() } : {},
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      setIsLoading(false);
    });

    socket.on('connect_error', (err) => {
      setError(err?.message || 'Socket connect error');
      setIsConnected(false);
      setIsLoading(false);
    });

    socket.on('error', (err) => {
      setError(typeof err === 'string' ? err : (err?.message || 'Socket error'));
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    return () => {
      try { socket.off(); } catch { }
      try { socket.close(); } catch { }
      socketRef.current = null;
    };
  }, []);

  const subscribe = (jobId) => {
    try { socketRef.current?.emit('subscribe', { jobId }); } catch { }
  };
  const unsubscribe = (jobId) => {
    try { socketRef.current?.emit('unsubscribe', { jobId }); } catch { }
  };

  const disconnect = () => {
    try { socketRef.current?.disconnect(); } catch { }
  };

  const reconnect = () => {
    try {
      socketRef.current.auth = { token: readTokenFromCookie() };
      socketRef.current?.connect();
    } catch { }
  };

  const value = useMemo(() => ({
    socket: socketRef.current,
    isLoading,
    isConnected,
    error,
    subscribe,
    unsubscribe,
    disconnect,
    reconnect,
  }), [isLoading, isConnected, error]);

  return (
    <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
