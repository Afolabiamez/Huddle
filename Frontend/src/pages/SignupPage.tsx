import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { ApiError } from "../api/types";
import { useAuth } from "../context/AuthContext";

export default function SignupPage() {
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
      const user = await api.signup(email, password);
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
      <div className="auth-hero">
        <button
          type="button"
          className="auth-hero-back"
          aria-label="Back"
          onClick={() => navigate(-1)}
        >
          ‹
        </button>
        <div className="auth-hero-brand">Huddle</div>
        <div className="auth-hero-tagline">Effortless team collaboration, built for remote speed.</div>
      </div>
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1>Enter details</h1>
        <p className="auth-subtitle">Get your team talking in a couple of minutes.</p>

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
          minLength={6}
          placeholder="Enter password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={submitting}
        />

        {error && <div className="form-error" role="alert">{error}</div>}

        <button type="submit" className="primary-button" disabled={submitting}>
          {submitting ? "Creating account…" : "Create account"}
        </button>

        <p className="auth-switch">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </div>
  );
}
