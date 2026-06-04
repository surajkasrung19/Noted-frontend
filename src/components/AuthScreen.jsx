import { useEffect, useRef, useState } from "react";
import { Eye, EyeOff, KeyRound, Lock, LogIn, MailCheck, NotebookPen, UserPlus } from "lucide-react";
import {
  forgotPassword,
  login,
  resendVerification,
  resetPassword,
  signup,
  verifyEmail
} from "../api/client.js";
import FloatingNotesScene from "./three/LazyFloatingNotesScene.jsx";

export default function AuthScreen({ onAuthed }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [needsVerification, setNeedsVerification] = useState(false);
  const [busy, setBusy] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const resetTokenRef = useRef(new URLSearchParams(window.location.search).get("resetToken") || "");

  const isSignup = mode === "signup";
  const isForgot = mode === "forgot";
  const isReset = mode === "reset";

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const verifyToken = params.get("verifyToken");
    const resetToken = params.get("resetToken");

    if (resetToken) {
      resetTokenRef.current = resetToken;
      setMode("reset");
      return;
    }

    if (!verifyToken) return;

    let cancelled = false;
    async function confirmEmail() {
      setBusy(true);
      setError("");
      try {
        const result = await verifyEmail({ token: verifyToken });
        if (cancelled) return;
        window.history.replaceState({}, "", window.location.pathname);
        onAuthed(result);
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError?.response?.data?.message || requestError.message || "Email verification failed");
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    }

    confirmEmail();
    return () => {
      cancelled = true;
    };
  }, [onAuthed]);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    setNeedsVerification(false);

    try {
      if (isForgot) {
        const result = await forgotPassword({ email: form.email });
        setMessage(result.message);
        return;
      }

      if (isReset) {
        const result = await resetPassword({ token: resetTokenRef.current, password: form.password });
        window.history.replaceState({}, "", window.location.pathname);
        onAuthed(result);
        return;
      }

      if (isSignup) {
        const result = await signup(form);
        setMessage(result.message || "Account created. Please verify your email before logging in.");
        setNeedsVerification(result.emailSent === false);
        setMode("login");
        setForm((current) => ({ ...current, name: "", password: "" }));
        setPasswordVisible(false);
        return;
      }

      const result = await login({ email: form.email, password: form.password });
      onAuthed(result);
    } catch (requestError) {
      if (requestError?.response?.status === 403) {
        setNeedsVerification(true);
      }
      setError(requestError?.response?.data?.message || requestError.message || "Authentication failed");
    } finally {
      setBusy(false);
    }
  };

  const sendVerificationAgain = async () => {
    setBusy(true);
    setError("");
    setMessage("");

    try {
      const result = await resendVerification({ email: form.email });
      setMessage(result.message);
      setNeedsVerification(result.emailSent === false);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || requestError.message || "Could not send verification email");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-page">
      <FloatingNotesScene variant="auth" className="auth-3d-scene" />
      <section className="auth-hero">
        <div className="auth-brand">
          <NotebookPen size={34} />
          <div>
            <h1>Noted</h1>
            <p>Your private place for drafts, days, reminders, and stories.</p>
          </div>
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <div className="auth-card-header">
            {isForgot || isReset ? <KeyRound size={22} /> : isSignup ? <UserPlus size={22} /> : <Lock size={22} />}
            <div>
              <h2>{isReset ? "Reset password" : isForgot ? "Recover access" : isSignup ? "Create account" : "Welcome back"}</h2>
              <p>
                {isReset
                  ? "Create a new password for your workspace."
                  : isForgot
                    ? "Get a secure reset link in your inbox."
                    : isSignup
                      ? "Start a private notes workspace."
                      : "Sign in to open your notes."}
              </p>
            </div>
          </div>

          <form onSubmit={submit} className="auth-form">
            {isSignup ? (
              <label>
                Name
                <input
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Your name"
                  required
                />
              </label>
            ) : null}

            {!isReset ? (
              <label>
                Email
                <input
                  value={form.email}
                  onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                  placeholder="you@example.com"
                  type="email"
                  required
                />
              </label>
            ) : null}

            {!isForgot ? (
              <label>
                Password
                <div className="password-field">
                  <input
                    value={form.password}
                    onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                    placeholder="At least 8 characters"
                    type={passwordVisible ? "text" : "password"}
                    minLength={8}
                    required
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setPasswordVisible((visible) => !visible)}
                    aria-label={passwordVisible ? "Hide password" : "Show password"}
                    title={passwordVisible ? "Hide password" : "Show password"}
                  >
                    {passwordVisible ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </label>
            ) : null}

            {error ? <div className="auth-error">{error}</div> : null}
            {message ? (
              <div className="auth-message">
                <MailCheck size={16} />
                {message}
              </div>
            ) : null}

            {needsVerification ? (
              <button type="button" className="auth-secondary-action" onClick={sendVerificationAgain} disabled={busy}>
                <MailCheck size={16} />
                Resend verification email
              </button>
            ) : null}

            <button className="primary-action" disabled={busy}>
              {isReset || isForgot ? <KeyRound size={18} /> : isSignup ? <UserPlus size={18} /> : <LogIn size={18} />}
              {busy
                ? "Please wait"
                : isReset
                  ? "Update password"
                  : isForgot
                    ? "Send reset link"
                    : isSignup
                      ? "Sign up"
                      : "Log in"}
            </button>
          </form>

          <button
            className="auth-switch"
            onClick={() => {
              setError("");
              setMessage("");
              setNeedsVerification(false);
              setPasswordVisible(false);
              setMode(isSignup || isForgot || isReset ? "login" : "signup");
            }}
          >
            {isSignup || isForgot || isReset ? "Back to log in" : "New here? Create an account"}
          </button>

          {!isSignup && !isForgot && !isReset ? (
            <button
              className="auth-link-button"
              onClick={() => {
                setError("");
                setMessage("");
                setNeedsVerification(false);
                setPasswordVisible(false);
                setMode("forgot");
              }}
            >
              Forgot password?
            </button>
          ) : null}
        </div>
      </section>
    </main>
  );
}
