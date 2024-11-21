import { useEffect, useState } from "react";
import { socket } from "./socket";

function App() {
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [authToken, setAuthToken] = useState('');
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    decodeJwtPayload();

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('event', onEvent);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('event', onEvent);
    }
  }, []);

  const onConnect = () => {
    setIsConnected(true);
  }

  const onDisconnect = () => {
    setIsConnected(false);
  }

  const onEvent = (value: any) => {
    setEvents((prev) => ([...prev, value]));
  }

  const connect = () => {
    if (!authToken) {
      console.warn('The auth token has not been set.');
      return;
    }

    socket.auth = { token: authToken };
    socket.connect();
  }

  const decodeJwtPayload = () => {
    const queryParams = new URLSearchParams(window.location.search);
    const authToken = queryParams.get("auth_token");

    if (!authToken) return;

    setAuthToken(authToken);

    const base64UrlEncodedPayload = authToken.split('.')[1];
    const base64EncodedPayload = base64UrlEncodedPayload
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    const jsonPayload = atob(base64EncodedPayload);
    const payload = JSON.parse(jsonPayload);

    console.log({ payload });
  }

  return (
    <div>
      <h1>OAuth practice</h1>

      <a href="http://localhost:4000/v1/auth/google/signin">Sign in with Google</a>
      <p>WebSocket connection established: {'' + isConnected}</p>

      <button
        disabled={isConnected}
        onClick={connect}
      >
        Connect
      </button>
      <button
        disabled={!isConnected}
        onClick={() => socket.disconnect()}
      >
        Disconnect
      </button>
    </div>
  )
}

export default App
