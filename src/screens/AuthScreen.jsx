import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useApp } from "../hooks/useApp";
import { PrimaryButton } from "../components/PrimaryButton";
import { Banner } from "../components/Banner";

export function AuthScreen() {
  const { login, signUp } = useApp();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // The onboarding screen links here as /auth?mode=signup or ?mode=login,
  // so the URL itself carries which form to show -- this is one of the
  // concrete benefits of a real router over hand-rolled screen state: the
  // browser back button and page refresh both behave correctly for free.
  const isSignup = searchParams.get("mode") === "signup";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password) {
      setError("Enter both an email address and a password.");
      return;
    }

    setLoading(true);
    try {
      if (isSignup) {
        await signUp(email.trim(), password);
      } else {
        await login(email.trim(), password);
      }
      navigate("/channels");
    } catch (err) {
      // login()/signUp() reject with the exact user-facing message defined
      // in mockApi.js -- this screen doesn't need to know WHY it failed,
      // only that it did, and what to tell the person.
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="p-6 pt-10" style={{ background: "linear-gradient(160deg, var(--color-primary), #8fd0f5)" }}>
        <button onClick={() => navigate("/")} className="text-white text-xl">‹</button>
        <h1 className="text-white text-3xl font-bold font-heading mt-10">
          {isSignup ? "Create your account" : "Enter login details"}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-t-3xl -mt-4 flex-1 flex flex-col gap-4">
        <Banner message={error} onDismiss={() => setError("")} />

        <input
          type="email"
          placeholder="Enter email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-xl border border-border px-4 py-3.5 outline-none"
        />
        <input
          type="password"
          placeholder="Enter password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-xl border border-border px-4 py-3.5 outline-none"
        />

        <div className="mt-2 flex flex-col gap-3">
          <PrimaryButton type="submit" loading={loading}>
            {isSignup ? "Create account" : "Login"}
          </PrimaryButton>
          <button
            type="button"
            onClick={() => {
              setSearchParams({ mode: isSignup ? "login" : "signup" });
              setError("");
            }}
            className="text-sm text-center text-slate"
          >
            {isSignup ? "Have an account? " : "Don't have an account? "}
            <span className="text-primary font-semibold">{isSignup ? "Sign in" : "Create one"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
