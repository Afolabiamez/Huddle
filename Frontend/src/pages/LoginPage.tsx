import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { ApiError } from "../api/types";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { setUser } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const user = await api.login(email, password);
      setUser(user);
      navigate("/channels");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-shell">
        <div className="auth-hero">
          <button
            type="button"
            className="auth-hero-back"
            aria-label="Back"
            onClick={() => navigate(-1)}
          />
          <div className="auth-hero-brand">Huddle</div>
          <div className="auth-hero-tagline">Sign in to join your team's workspace.</div>
        </div>
        <form className="auth-card" onSubmit={handleSubmit}>
          <h1>Enter login details</h1>
          <p className="auth-subtitle">Log in to jump back into your channels.</p>

          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            required
            placeholder="Enter email address"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={submitting}
          />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            required
            placeholder="Enter password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={submitting}
          />

          {error && <div className="form-error" role="alert">{error}</div>}

          <button type="submit" className="primary-button" disabled={submitting}>
            {submitting ? "Logging in…" : "Login"}
          </button>

          <p className="auth-switch">
            Don't have an account? <Link to="/signup">Create one</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
