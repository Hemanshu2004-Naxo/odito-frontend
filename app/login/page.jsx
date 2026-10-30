"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { signIn } from "next-auth/react";
import { PublicGuard } from "@/components/guards/AuthGuard";
import { Mail, Lock, Eye, EyeOff, Sparkles, ShieldAlert } from "lucide-react";

// Reusable Input Field Component
function InputField({ icon: Icon, type, placeholder, value, onChange, name, showToggle, onToggle, showPassword }) {
  return (
    <div className="relative group">
      <Icon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-primary transition-all duration-300 w-5 h-5" />
      <input
        type={showToggle ? (showPassword ? "text" : "password") : type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full h-[56px] bg-surface-variant/50 border border-white/5 text-slate-200 rounded-xl pl-12 pr-4 transition-all duration-300 focus:ring-2 focus:ring-primary/20 focus:border-primary/50 focus:bg-surface-variant outline-none placeholder:text-slate-600"
      />
      {showToggle && (
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 cursor-pointer hover:text-white transition-all duration-300"
        >
          {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
        </button>
      )}
    </div>
  );
}

// Social Button Component
function SocialButton({ icon, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-center gap-3 h-[52px] rounded-xl bg-transparent border border-white/10 hover:border-white/20 hover:bg-white/5 transition-all duration-300 text-slate-200 text-sm font-semibold w-full"
    >
      {icon}
      <span>{children}</span>
    </button>
  );
}

// Left Panel Hero Component
function LoginHero() {
  return (
    <section className="hidden lg:flex lg:w-1/2 relative bg-background overflow-hidden border-r border-white/5">
      {/* Dynamic AI Patterns */}
      <div className="absolute inset-0 neural-bg"></div>
      
      {/* Animated Blobs */}
      <div className="absolute top-[10%] left-[10%] w-96 h-96 bg-primary/10 rounded-full blur-[120px] animate-pulse-slow"></div>
      <div className="absolute bottom-[10%] right-[10%] w-[500px] h-[500px] bg-secondary/10 rounded-full blur-[160px] animate-pulse-slow" style={{ animationDelay: '-2s' }}></div>
      
      <div className="z-10 flex flex-col justify-between p-12 w-full">
        {/* Top Left Logo */}
        <div>
          <Link href="/">
            <img 
              src="/logo/odito-logo-on-dark.png" 
              alt="Odito AI" 
              className="h-16 w-auto object-contain hover:scale-105 hover:opacity-90 transition-all duration-300"
            />
          </Link>
        </div>
        
        {/* Hero Content */}
        <div className="max-w-md">
          <h1 className="text-4xl font-bold leading-[1.1] text-white mb-6">
            The Future of <span className="gradient-text">Search Intelligence</span>
          </h1>
          <p className="text-slate-400 text-base leading-relaxed">
            Scale your organic growth with enterprise-grade AI technical audits and real-time insights.
          </p>
        </div>
        
        {/* Subtle Footer Reference */}
        <div className="text-sm text-slate-600 font-medium">
          © 2024 Odito AI. Powered by Neural Search Architecture.
        </div>
      </div>
      
      {/* Floating Abstract Element */}
      <div className="absolute right-[-10%] top-1/2 -translate-y-1/2 opacity-20 pointer-events-none">
        <svg height="600" viewBox="0 0 200 200" width="600" xmlns="http://www.w3.org/2000/svg">
          <path d="M100,20 C144,20 180,56 180,100 C180,144 144,180 100,180 C56,180 20,144 20,100 C20,56 56,20 100,20 Z" fill="none" stroke="url(#teal_grad)" strokeWidth="0.5"></path>
          <circle cx="100" cy="100" fill="none" r="40" stroke="url(#teal_grad)" strokeWidth="0.2"></circle>
          <defs>
            <linearGradient id="teal_grad" x1="0%" x2="100%" y1="0%" y2="100%">
              <stop offset="0%" stopColor="#2DD4BF"></stop>
              <stop offset="100%" stopColor="#06B6D4"></stop>
            </linearGradient>
          </defs>
        </svg>
      </div>
    </section>
  );
}

// Right Panel Form Component
function LoginForm({ formData, setFormData, error, setError, isLoading, setIsLoading }) {
  const { login } = useAuth();
  // Local, not lifted to the parent like `error` — only this form's submit
  // handler sets it and only this form's render reads it. Deliberately
  // separate from the generic `error` string so the suspended panel and
  // the plain error banner are mutually exclusive and never render both.
  const [isSuspended, setIsSuspended] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsSuspended(false);
    setIsLoading(true);

    // Basic validation
    if (!formData.email || !formData.password) {
      setError("Please fill in all fields");
      setIsLoading(false);
      return;
    }

    try {
      const result = await login(formData.email, formData.password, formData.rememberMe);
      console.log("✅ Login successful!", result.user);

      // AuthContext handles token/session storage
      // Redirect will happen automatically via existing flow
    } catch (error) {
      console.error("❌ Login failed:", error.message);
      if (error.code === "ACCOUNT_SUSPENDED") {
        setIsSuspended(true);
      } else {
        setError(error.message || "Login failed. Please check your credentials and try again.");
      }
    }

    setIsLoading(false);
  };

  const handleGoogleLogin = async () => {
    try {
      await signIn("google", {
        callbackUrl: "/app/domain-overview",
        redirect: true,
      });
    } catch (error) {
      console.error("Google login error:", error);
      setError("Google login failed. Please try again.");
    }
  };

  const handleGitHubLogin = async () => {
    try {
      await signIn("github", {
        callbackUrl: "/app/domain-overview",
        redirect: true,
      });
    } catch (error) {
      console.error("GitHub login error:", error);
      setError("GitHub login failed. Please try again.");
    }
  };

  return (
    <section className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 bg-background">
      <div className="w-full max-w-[440px]">
        {/* Mobile Branding */}
        <div className="lg:hidden mb-12 flex justify-center">
          <Link href="/">
            <img 
              src="/logo/odito-logo-on-dark.png" 
              alt="Odito AI" 
              className="h-16 w-auto object-contain hover:scale-105 hover:opacity-90 transition-all duration-300"
            />
          </Link>
        </div>

        <div className="mb-10">
          <h2 className="text-3xl font-bold text-white mb-2">Welcome Back</h2>
          <p className="text-slate-400">Sign in to manage your AI search projects.</p>
        </div>

        {/* Glass Login Card */}
        <div className="glass-card rounded-xl p-6 shadow-2xl relative overflow-hidden">
          {/* Subtle top highlight */}
          <div className="absolute top-0 left-0 w-full h-1 btn-gradient opacity-50"></div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email Input */}
            <div className="space-y-2">
              <label className="block text-[0.75rem] font-bold tracking-widest text-slate-500 uppercase ml-1" htmlFor="email">
                Email Address
              </label>
              <InputField
                icon={Mail}
                type="email"
                placeholder="name@company.com"
                name="email"
                value={formData.email}
                onChange={handleChange}
              />
            </div>

            {/* Password Input */}
            <div className="space-y-2">
              <div className="flex justify-between items-center ml-1">
                <label className="block text-[0.75rem] font-bold tracking-widest text-slate-500 uppercase" htmlFor="password">
                  Password
                </label>
                <Link className="text-[0.75rem] font-bold text-primary hover:text-secondary transition-all duration-300 uppercase tracking-tighter" href="/forgot-password">
                  Forgot Password?
                </Link>
              </div>
              <InputField
                icon={Lock}
                type="password"
                placeholder="••••••••"
                name="password"
                value={formData.password}
                onChange={handleChange}
                showToggle={true}
                onToggle={() => setFormData((prev) => ({ ...prev, showPassword: !prev.showPassword }))}
                showPassword={formData.showPassword}
              />
            </div>

            {/* Remember Me Checkbox */}
            <div className="flex items-center ml-1">
              <input
                className="h-5 w-5 rounded border-white/10 bg-surface-variant text-primary focus:ring-primary/30 focus:ring-offset-background transition-all duration-300 cursor-pointer"
                id="remember-me"
                name="rememberMe"
                type="checkbox"
                checked={formData.rememberMe}
                onChange={handleChange}
              />
              <label className="ml-3 block text-sm text-slate-400 font-medium select-none cursor-pointer" htmlFor="remember-me">
                Keep me signed in
              </label>
            </div>

            {/* Account Suspended — dedicated panel, distinct from the generic
                error banner below. Deliberately shows only the fact that the
                account is suspended plus how to get help — never who
                suspended it, why, admin notes, or timestamps, none of which
                the backend response even includes. */}
            {isSuspended && (
              <div className="p-4 text-sm bg-red-950/20 border border-red-900/30 rounded-lg space-y-2">
                <div className="flex items-center gap-2 text-red-400 font-semibold">
                  <ShieldAlert className="w-4 h-4" />
                  Account Suspended
                </div>
                <p className="text-slate-300">
                  Your account has been suspended. If you believe this is a mistake or need
                  assistance, please contact our support team.
                </p>
                <a
                  href="mailto:support@oditoai.com"
                  className="inline-block text-primary hover:underline font-medium"
                >
                  support@oditoai.com
                </a>
              </div>
            )}

            {/* Error Display */}
            {!isSuspended && error && (
              <div className="p-3 text-sm text-red-400 bg-red-950/20 border border-red-900/30 rounded-lg">
                {error}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-[56px] btn-gradient py-4 rounded-xl text-white font-bold tracking-tight hover:opacity-95 hover:scale-[1.01] active:scale-[0.99] transition-all duration-300 shadow-[0_10px_30px_-10px_rgba(45,212,191,0.4)] teal-glow disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {isLoading ? "Signing In..." : "Sign In to Dashboard"}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-8">
            <div aria-hidden="true" className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/5"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-4 bg-transparent text-slate-500 font-bold uppercase tracking-widest">
                Or continue with
              </span>
            </div>
          </div>

          {/* Social Login Buttons */}
          <div className="grid grid-cols-2 gap-4">
            <SocialButton
              onClick={handleGoogleLogin}
              icon={
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"></path>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"></path>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"></path>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"></path>
                </svg>
              }
            >
              Google
            </SocialButton>
            <SocialButton
              onClick={handleGitHubLogin}
              icon={
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"></path>
                </svg>
              }
            >
              GitHub
            </SocialButton>
          </div>
        </div>

        <div className="mt-8 text-center">
          <p className="text-slate-400 font-medium">
            New to Odito AI?{" "}
            <Link className="text-primary font-bold hover:text-secondary transition-all duration-300 ml-1" href="/signup">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}

// Main Page Component
function LoginContent() {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    rememberMe: false,
    showPassword: false,
  });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  return (
    <main className="flex min-h-screen w-full bg-background text-slate-200 antialiased">
      <div className="max-w-[1600px] mx-auto w-full flex min-h-screen">
        <LoginHero />
        <LoginForm
          formData={formData}
          setFormData={setFormData}
          error={error}
          setError={setError}
          isLoading={isLoading}
          setIsLoading={setIsLoading}
        />
      </div>
    </main>
  );
}

export default function Login() {
  return (
    <PublicGuard>
      <LoginContent />
    </PublicGuard>
  );
}
