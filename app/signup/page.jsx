"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { signIn } from "next-auth/react";
import { PublicGuard } from "@/components/guards/AuthGuard";
import { User, Mail, Lock, Eye, EyeOff, ArrowRight, Sparkles, Brain, Zap } from "lucide-react";

// Reusable Input Field Component
function InputField({ icon: Icon, type, placeholder, value, onChange, name, showToggle, onToggle, showPassword }) {
  return (
    <div className="relative group">
      <Icon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-primary transition-all duration-300 w-5 h-5" />
      <input
        type={showToggle ? (showPassword ? "text" : "password") : type}
        value={value}
        onChange={onChange}
        name={name}
        placeholder={placeholder}
        className="w-full h-11 bg-surface-light/50 border border-white/5 rounded-xl pl-12 pr-4 text-white placeholder:text-slate-600 focus:outline-none focus:border-primary/50 focus:ring-0 transition-all duration-300 teal-glow text-base"
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
      className="w-full h-11 flex items-center justify-center space-x-3 rounded-xl border border-white/10 bg-white/0 hover:bg-white/5 transition-all duration-300 group"
    >
      {icon}
      <span className="text-base font-semibold text-white group-hover:text-primary transition-all duration-300">
        {children}
      </span>
    </button>
  );
}

// Left Panel Hero Component
function SignupHero() {
  return (
    <section className="hidden lg:flex w-1/2 relative bg-black overflow-hidden items-center justify-center border-r border-white/5">
      <div className="neural-net absolute inset-0 z-0"></div>

      {/* Logo Top Left */}
      <div className="absolute top-10 left-10 z-30 flex items-center">
        <Link href="/">
          <img 
            src="/logo/odito-logo-on-dark.png" 
            alt="Odito AI" 
            className="h-16 w-auto object-contain hover:scale-105 hover:opacity-90 transition-all duration-300"
          />
        </Link>
      </div>

      {/* Gradient Blobs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[120px]"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-secondary/20 rounded-full blur-[120px]"></div>

      {/* Abstract Content */}
      <div className="relative z-10 p-16 max-w-xl">
        <h2 className="text-4xl font-extrabold text-white leading-tight mb-6">
          Redefine Your <br />
          <span className="bg-gradient-to-r from-teal-400 to-cyan-500 bg-clip-text text-transparent">
            SEO Strategy
          </span>{" "}
          <br />
          with Intelligence.
        </h2>
        <p className="text-base text-slate-400 mb-8 leading-relaxed">
          Harness the power of neural networks to audit, optimize, and dominate search rankings in real-time.
        </p>
        <div className="grid grid-cols-2 gap-6">
          <div className="p-6 rounded-2xl glass-card">
            <Brain className="text-primary mb-3 w-8 h-8" />
            <h4 className="font-bold text-white">AI Audits</h4>
            <p className="text-sm text-slate-500 mt-1">Deep analysis of 200+ ranking factors.</p>
          </div>
          <div className="p-6 rounded-2xl glass-card">
            <Zap className="text-secondary mb-3 w-8 h-8" />
            <h4 className="font-bold text-white">Instant Fixes</h4>
            <p className="text-sm text-slate-500 mt-1">Automated code & content optimizations.</p>
          </div>
        </div>
      </div>

      <div className="absolute bottom-10 left-10 z-20 text-slate-600 text-sm">
        © 2024 Odito AI. All rights reserved.
      </div>
    </section>
  );
}

// Right Panel Form Component
function SignupForm({ formData, setFormData, error, setError, isLoading, setIsLoading }) {
  const { register } = useAuth();

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
    setIsLoading(true);

    // Basic validation
    if (!formData.name || !formData.email || !formData.password || !formData.confirmPassword) {
      setError("Please fill in all fields");
      setIsLoading(false);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      setIsLoading(false);
      return;
    }

    if (formData.password.length < 8) {
      setError("Password must be at least 8 characters long");
      setIsLoading(false);
      return;
    }

    if (!formData.termsAccepted) {
      setError("You must accept the Terms of Service and Privacy Policy");
      setIsLoading(false);
      return;
    }

    try {
      // Split name into firstName and lastName
      const nameParts = formData.name.trim().split(" ");
      const firstName = nameParts[0] || "";
      const lastName = nameParts.slice(1).join(" ") || "";

      const result = await register({
        firstName,
        lastName,
        email: formData.email,
        password: formData.password,
        termsAccepted: formData.termsAccepted,
      });

      console.log("✅ Registration successful!", result.user);

      // Continue with verification flow
      // Store email and password for verification flow
      localStorage.setItem("verificationEmail", formData.email);
      localStorage.setItem("tempPassword", formData.password);

      alert("Registration successful! Please check your email to verify your account.");
      if (typeof window !== "undefined") {
        window.location.href = "/verify-email";
      }
    } catch (error) {
      console.error("❌ Signup failed:", error.message);
      setError(error.message || "Registration failed. Please try again.");
    }

    setIsLoading(false);
  };

  const handleGoogleSignup = async () => {
    try {
      await signIn("google", {
        callbackUrl: "/app/dashboard",
        redirect: true,
      });
    } catch (error) {
      console.error("Google signup error:", error);
      setError("Google signup failed. Please try again.");
    }
  };

  return (
    <section className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-black">
      <div className="w-full max-w-md">
        {/* Mobile Logo */}
        <div className="lg:hidden flex justify-center mb-8">
          <img 
            src="/logo/odito-logo-on-dark.png" 
            alt="Odito AI" 
            className="h-16 w-auto object-contain hover:scale-105 hover:opacity-90 transition-all duration-300"
          />
        </div>

        <div className="mb-8 text-center lg:text-left">
          <h1 className="text-3xl font-bold text-white mb-2">Create your account</h1>
          <p className="text-base text-slate-400">Experience the future of SEO for free.</p>
        </div>

        {/* Signup Card */}
        <div className="glass-card rounded-xl p-6 shadow-2xl relative overflow-hidden">
          {/* Subtle top glow */}
          <div className="absolute top-0 left-0 w-full h-1 btn-gradient opacity-50"></div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name Input */}
            <InputField
              icon={User}
              type="text"
              placeholder="Full Name"
              name="name"
              value={formData.name}
              onChange={handleChange}
            />

            {/* Email Input */}
            <InputField
              icon={Mail}
              type="email"
              placeholder="Email Address"
              name="email"
              value={formData.email}
              onChange={handleChange}
            />

            {/* Password Input */}
            <InputField
              icon={Lock}
              type="password"
              placeholder="Password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              showToggle={true}
              onToggle={() => setFormData((prev) => ({ ...prev, showPassword: !prev.showPassword }))}
              showPassword={formData.showPassword}
            />

            {/* Confirm Password Input */}
            <InputField
              icon={Lock}
              type="password"
              placeholder="Confirm Password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              showToggle={true}
              onToggle={() => setFormData((prev) => ({ ...prev, showConfirmPassword: !prev.showConfirmPassword }))}
              showPassword={formData.showConfirmPassword}
            />

            {/* Terms */}
            <div className="flex items-start space-x-3 py-2">
              <div className="flex items-center h-5">
                <input
                  type="checkbox"
                  id="terms"
                  name="termsAccepted"
                  checked={formData.termsAccepted}
                  onChange={handleChange}
                  className="h-5 w-5 rounded border-white/10 bg-surface-light text-primary focus:ring-primary focus:ring-offset-background transition-all duration-300 cursor-pointer"
                />
              </div>
              <label htmlFor="terms" className="text-sm text-slate-400 select-none cursor-pointer">
                I agree to the{" "}
                <Link href="/terms" className="text-primary hover:underline">
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link href="/privacy" className="text-primary hover:underline">
                  Privacy Policy
                </Link>
              </label>
            </div>

            {/* Error Display */}
            {error && (
              <div className="p-3 text-sm text-red-400 bg-red-950/20 border border-red-900/30 rounded-lg">
                {error}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || !formData.termsAccepted}
              className="w-full h-11 btn-gradient text-background font-bold rounded-xl shadow-[0_0_20px_rgba(45,212,191,0.2)] hover:shadow-[0_0_30px_rgba(45,212,191,0.4)] hover:scale-[1.01] active:scale-[0.99] transition-all duration-300 flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 text-base"
            >
              <span>{isLoading ? "Creating Account..." : "Get Started Free"}</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/5"></div>
            </div>
            <div className="relative flex justify-center">
              <span className="bg-[#0C1420] px-4 text-[10px] font-bold tracking-widest text-slate-500 uppercase">
                OR
              </span>
            </div>
          </div>

          {/* Google Login */}
          <SocialButton
            onClick={handleGoogleSignup}
            icon={
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"></path>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"></path>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"></path>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"></path>
              </svg>
            }
          >
            Continue with Google
          </SocialButton>
        </div>

        <div className="mt-6 text-center">
          <p className="text-slate-400 text-base">
            Already have an account?{" "}
            <Link href="/login" className="text-primary font-bold hover:text-cyan-400 transition-all duration-300 ml-1">
              Login
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}

// Main Page Component
function SignupContent() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    termsAccepted: false,
    showPassword: false,
    showConfirmPassword: false,
  });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  return (
    <main className="flex min-h-screen w-full bg-background text-slate-200 antialiased overflow-hidden">
      <div className="max-w-[1600px] mx-auto w-full flex min-h-screen">
        <SignupHero />
        <SignupForm
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

export default function Signup() {
  return (
    <PublicGuard>
      <SignupContent />
    </PublicGuard>
  );
}
