"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { PublicGuard } from "@/components/guards/AuthGuard";
import { Zap, ShieldCheck, Lock, RotateCcw, CheckCircle, XCircle, ArrowRight, ArrowLeft } from "lucide-react";

// Left Panel Hero Component
function ResetPasswordHero() {
  return (
    <section className="hidden md:flex flex-1 flex-col justify-between p-10 overflow-hidden relative">
      {/* Mesh Gradient Background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(175,198,255,0.1)_0%,transparent_50%),radial-gradient(circle_at_100%_100%,rgba(29,116,245,0.1)_0%,transparent_50%)]"></div>

      {/* Decorative Glow */}
      <div className="absolute -top-20 -left-20 w-80 h-80 bg-primary/10 rounded-full blur-[100px]"></div>
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-secondary/5 rounded-full blur-[120px]"></div>

      {/* Brand Logo */}
      <div className="z-10">
        <img
          src="/logo/odito-logo-on-dark.png"
          alt="Odito AI"
          className="h-12 w-auto object-contain hover:scale-105 hover:opacity-90 transition-all duration-300"
        />
      </div>

      {/* Main Content */}
      <div className="z-10 max-w-lg mt-10">
        <h1 className="text-4xl font-extrabold tracking-[-0.04em] leading-[1.1] mb-5 bg-gradient-to-br from-primary via-secondary to-onprimary bg-clip-text text-transparent">
          Secure Your Account with Intelligent Verification
        </h1>
        <p className="text-base text-on-surface-variant leading-relaxed mb-10">
          This link is single-use and expires automatically — a real security boundary, not just a UI check.
        </p>

        {/* Feature Cards */}
        <div className="space-y-4">
          <div className="p-5 rounded-2xl bg-surface-container-high/40 backdrop-blur-sm border border-outline-variant/10 flex gap-4 items-start">
            <div className="bg-primary/10 p-2.5 rounded-lg">
              <Zap className="text-primary" size={20} />
            </div>
            <div>
              <h3 className="font-bold text-white mb-1 text-sm">Single-Use Link</h3>
              <p className="text-xs text-on-surface-variant">This reset link can only ever be used once, by design.</p>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-surface-container-high/40 backdrop-blur-sm border border-outline-variant/10 flex gap-4 items-start">
            <div className="bg-secondary/10 p-2.5 rounded-lg">
              <ShieldCheck className="text-secondary" size={20} />
            </div>
            <div>
              <h3 className="font-bold text-white mb-1 text-sm">Time-Limited</h3>
              <p className="text-xs text-on-surface-variant">Expires shortly after it's issued to minimize exposure.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="z-10">
        <div className="flex items-center gap-4">
          <span className="text-xs text-on-surface-variant/80 font-medium tracking-tight">Trusted by 10k+ security professionals</span>
        </div>
      </div>
    </section>
  );
}

// Shown when the token is missing, invalid, expired, or already used —
// i.e. every case where the password form must never render.
function TokenErrorState({ code, message }) {
  const title = code === 'RESET_TOKEN_EXPIRED'
    ? 'Link Expired'
    : code === 'RESET_TOKEN_USED'
      ? 'Link Already Used'
      : 'Invalid Link';

  return (
    <section className="flex flex-1 items-center justify-center p-6 sm:p-8 lg:p-10 bg-black">
      <div className="w-full max-w-[420px] text-center">
        <div className="p-7 sm:p-9 rounded-[1.75rem] shadow-2xl bg-[#30353f]/60 backdrop-blur-20 border border-[#45474b]/20">
          <XCircle className="mx-auto h-12 w-12 text-danger mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">{title}</h2>
          <p className="text-on-surface-variant text-sm mb-6">
            {message || 'This password reset link is no longer valid. Please request a new one.'}
          </p>
          <Link
            href="/forgot-password"
            className="inline-flex items-center justify-center gap-2 w-full bg-gradient-to-r from-primary to-secondary text-onprimary font-bold py-3.5 rounded-full transition-all duration-300 hover:opacity-90 active:scale-[0.98] text-sm"
          >
            Request New Link
            <ArrowRight size={18} />
          </Link>
          <div className="mt-6">
            <Link href="/login" className="text-sm font-medium text-on-surface-variant hover:text-primary transition-colors inline-flex items-center gap-2">
              <ArrowLeft size={16} />
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

// Right Panel Form Component
function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  // 'checking' | 'valid' | 'invalid' — the page NEVER shows the password
  // form until the backend has confirmed the token itself; a token in the
  // URL is not sufficient on its own (never trust a query param).
  const [tokenState, setTokenState] = useState('checking');
  const [tokenErrorCode, setTokenErrorCode] = useState(null);
  const [tokenErrorMessage, setTokenErrorMessage] = useState(null);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function checkToken() {
      if (!token) {
        setTokenErrorCode('RESET_TOKEN_INVALID');
        setTokenErrorMessage('This page can only be reached from a password reset email — there is no reset link here.');
        setTokenState('invalid');
        return;
      }
      try {
        const apiService = (await import("@/lib/apiService")).default;
        await apiService.validateResetToken(token);
        if (!cancelled) setTokenState('valid');
      } catch (err) {
        if (cancelled) return;
        setTokenErrorCode(err?.code || 'RESET_TOKEN_INVALID');
        setTokenErrorMessage(err?.message || null);
        setTokenState('invalid');
      }
    }

    checkToken();
    return () => { cancelled = true; };
  }, [token]);

  const validatePassword = (pwd) => pwd.length >= 8;
  const hasSymbol = (pwd) => /[!@#$%^&*(),.?":{}|<>]/.test(pwd);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!password) {
      setError("Please enter a new password");
      return;
    }
    if (!validatePassword(password)) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (!hasSymbol(password)) {
      setError("Password must contain at least one symbol");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords must match");
      return;
    }

    setIsLoading(true);
    try {
      const apiService = (await import("@/lib/apiService")).default;
      await apiService.resetPassword(token, password, confirmPassword);
      setIsSuccess(true);
      setTimeout(() => router.push("/login"), 2000);
    } catch (err) {
      // The token can become invalid between page load and submit (expired
      // mid-fill, used in another tab, a replay attempt) — the backend is
      // re-checked on every submit regardless of what validate-reset-token
      // said earlier, so this is caught here rather than trusting client
      // state from load time.
      if (err?.code === 'RESET_TOKEN_EXPIRED' || err?.code === 'RESET_TOKEN_USED' || err?.code === 'RESET_TOKEN_INVALID') {
        setTokenErrorCode(err.code);
        setTokenErrorMessage(err.message);
        setTokenState('invalid');
      } else {
        setError(err?.message || "Failed to reset password. Please try again.");
      }
      setIsLoading(false);
    }
  };

  const isFormValid = password && confirmPassword &&
                     validatePassword(password) &&
                     hasSymbol(password) &&
                     password === confirmPassword;

  if (tokenState === 'checking') {
    return (
      <section className="flex flex-1 items-center justify-center p-6 sm:p-8 lg:p-10 bg-black">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
      </section>
    );
  }

  if (tokenState === 'invalid') {
    return <TokenErrorState code={tokenErrorCode} message={tokenErrorMessage} />;
  }

  if (isSuccess) {
    return (
      <section className="flex flex-1 items-center justify-center p-6 sm:p-8 lg:p-10 bg-black">
        <div className="w-full max-w-[420px] text-center">
          <div className="p-7 sm:p-9 rounded-[1.75rem] shadow-2xl bg-[#30353f]/60 backdrop-blur-20 border border-[#45474b]/20">
            <CheckCircle className="mx-auto h-12 w-12 text-emerald-400 mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Password Reset!</h2>
            <p className="text-on-surface-variant text-sm">Redirecting you to login...</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-1 items-center justify-center p-6 sm:p-8 lg:p-10 bg-black">
      {/* Mobile Logo (Visible only on mobile) */}
      <div className="absolute top-8 left-8 md:hidden">
        <img
          src="/logo/odito-logo-on-dark.png"
          alt="Odito AI"
          className="h-10 w-auto object-contain hover:scale-105 hover:opacity-90 transition-all duration-300"
        />
      </div>

      <div className="w-full max-w-[420px]">
        {/* Glass Card */}
        <div className="p-7 sm:p-9 rounded-[1.75rem] shadow-2xl relative overflow-hidden bg-[#30353f]/60 backdrop-blur-20 border border-[#45474b]/20">
          {/* Background Glow inside Card */}
          <div className="absolute -top-20 -right-20 w-40 h-40 bg-secondary/10 rounded-full blur-[50px]"></div>

          <div className="relative z-10">
            <div className="mb-8 text-center md:text-left">
              <h2 className="text-3xl font-bold tracking-tight text-white mb-2">Reset Password</h2>
              <p className="text-on-surface-variant text-sm">Enter your new password below</p>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-danger/10 border border-danger/20 text-danger text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Password Field */}
              <div className="space-y-2">
                <label className="block text-[0.6875rem] font-bold uppercase tracking-widest text-on-surface-variant px-1" htmlFor="password">
                  New Password
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="text-outline text-lg transition-colors group-focus-within:text-primary" size={20} />
                  </div>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="block w-full pl-11 pr-4 py-3.5 bg-surface-container-low border-none rounded-xl text-white placeholder-outline focus:ring-2 focus:ring-primary/20 focus:bg-surface-container transition-all duration-300 outline-none text-sm"
                    required
                    autoFocus
                  />
                </div>
              </div>

              {/* Confirm Password Field */}
              <div className="space-y-2">
                <label className="block text-[0.6875rem] font-bold uppercase tracking-widest text-on-surface-variant px-1" htmlFor="confirm_password">
                  Confirm Password
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <RotateCcw className="text-outline text-lg transition-colors group-focus-within:text-primary" size={20} />
                  </div>
                  <input
                    id="confirm_password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    className="block w-full pl-11 pr-4 py-3.5 bg-surface-container-low border-none rounded-xl text-white placeholder-outline focus:ring-2 focus:ring-primary/20 focus:bg-surface-container transition-all duration-300 outline-none text-sm"
                    required
                  />
                </div>
                {confirmPassword && password !== confirmPassword && (
                  <p className="text-danger text-[0.6875rem] mt-1 px-1">Passwords must match</p>
                )}
              </div>

              {/* Password Requirements (Visual Feedback) */}
              <div className="flex flex-wrap gap-2 pt-2">
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container text-[0.625rem] border border-outline-variant/10 ${validatePassword(password) ? 'text-emerald-400' : 'text-on-surface-variant'}`}>
                  <CheckCircle size={12} className={validatePassword(password) ? 'fill-current' : ''} />
                  Min 8 characters
                </div>
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container text-[0.625rem] border border-outline-variant/10 ${hasSymbol(password) ? 'text-emerald-400' : 'text-on-surface-variant'}`}>
                  <CheckCircle size={12} className={hasSymbol(password) ? 'fill-current' : ''} />
                  One symbol
                </div>
              </div>

              {/* Reset Button */}
              <button
                type="submit"
                disabled={!isFormValid || isLoading}
                className="w-full relative group overflow-hidden bg-gradient-to-r from-primary to-secondary text-onprimary font-bold py-3.5 rounded-full transition-all duration-300 hover:shadow-[0_0_30px_-5px_rgba(175,198,255,0.6)] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none mt-4 text-sm"
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {isLoading ? "Resetting..." : "Reset Password"}
                  {!isLoading && <ArrowRight size={20} />}
                </span>
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
              </button>
            </form>

            {/* Back to Login */}
            <div className="mt-8 text-center">
              <Link
                className="text-sm font-medium text-on-surface-variant hover:text-primary transition-colors inline-flex items-center gap-2 group"
                href="/login"
              >
                <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                Back to Login
              </Link>
            </div>
          </div>
        </div>

        {/* System Status Footer */}
        <div className="mt-8 flex justify-center items-center gap-6 text-[0.6875rem] text-on-surface-variant/40">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]"></span>
            System Status: Optimal
          </div>
          <div className="h-1 w-1 rounded-full bg-outline-variant"></div>
          <span>© 2024 Odito AI</span>
        </div>
      </div>
    </section>
  );
}

// Main Page Component
function ResetPasswordContent() {
  return (
    <main className="flex min-h-screen w-full bg-black text-on-surface antialiased">
      <ResetPasswordHero />
      <Suspense fallback={<div>Loading...</div>}>
        <ResetPasswordForm />
      </Suspense>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <PublicGuard>
      <ResetPasswordContent />
    </PublicGuard>
  );
}
