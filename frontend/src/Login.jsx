import { useState } from "react";

function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = (e) => {
    e.preventDefault();

    if (!username || !password) {
      setError("Please enter username and password.");
      return;
    }

    // Demo login credentials
    if (
      username === "admin" &&
      password === "route123"
    ) {
      setError("");
      onLogin();
    } else {
      setError("Invalid username or password.");
    }
  };

  return (
    <div className="login-page">
      <div className="login-box">

        <div className="login-logo">
          RS
        </div>

        <h1>ROUTE SHARE</h1>

        <p className="login-subtitle">
          DELIVERY MANAGEMENT PLATFORM
        </p>

        <div className="login-status">
          ● SYSTEM ONLINE
        </div>

        <form onSubmit={handleLogin}>

          <label>USERNAME</label>

          <input
            type="text"
            placeholder="Enter username"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              setError("");
            }}
          />

          <label>PASSWORD</label>

          <input
            type="password"
            placeholder="Enter password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError("");
            }}
          />

          {error && (
            <div className="login-error">
              {error}
            </div>
          )}

          <button type="submit">
            LOGIN
          </button>

        </form>

        <div className="login-footer">
          ROUTE SHARE • DELIVERY OPERATIONS
        </div>

      </div>
    </div>
  );
}

export default Login;