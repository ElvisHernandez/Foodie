import { useEffect } from "react";

function App() {

  useEffect(() => {
    decodeJwtPayload();
  }, []);

  const decodeJwtPayload = () => {
    const queryParams = new URLSearchParams(window.location.search);
    const authToken = queryParams.get("auth_token");

    if (!authToken) return;

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

      <a href="http://localhost:4000/auth/google/signin">Sign in with Google</a>
    </div>
  )
}

export default App
