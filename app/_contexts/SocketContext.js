import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const defaultValue = {
  socket: null,
  isLoading: true,
  isConnected: false,
  error: null,
  subscribe: () => { },
  unsubscribe: () => { },
  endpoint: null,
};

const SocketContext = createContext(defaultValue);

function readTokenFromCookie() {
  try {
    if (typeof document === 'undefined') return null;
    const cookies = document.cookie.split(';').map(s => s.trim());
    for (const c of cookies) {
      if (c.startsWith('authToken=')) {
        return decodeURIComponent(c.substring('authToken='.length));
      }
    }
    return null;
  } catch {
    return null;
  }
}

export function SocketProvider({ children }) {
  const socketRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const [token] = useState(() => readTokenFromCookie());

  // derive endpoint
  const endpoint = useMemo(() => {
    const isProd = process.env.NODE_ENV === 'production';
    return isProd ? 'wss://edifacts.com' : 'ws://localhost:3010';
  }, []);

  useEffect(() => {
    setIsLoading(true);
    setError(null);

    console.log('SocketProvider: connecting to socket at', endpoint, 'with token', token);
    const socket = io(endpoint, {
      transports: ['websocket'],
      auth: token ? { token } : {},
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
  }, [endpoint, token]);

  const subscribe = (jobId) => {
    try { socketRef.current?.emit('subscribe', { jobId }); } catch { }
  };
  const unsubscribe = (jobId) => {
    try { socketRef.current?.emit('unsubscribe', { jobId }); } catch { }
  };

  const value = useMemo(() => ({
    socket: socketRef.current,
    isLoading,
    isConnected,
    error,
    subscribe,
    unsubscribe,
    endpoint,
  }), [isLoading, isConnected, error, endpoint]);

  return (
    <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
