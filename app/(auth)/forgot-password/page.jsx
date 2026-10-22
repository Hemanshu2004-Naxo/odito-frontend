"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PublicGuard } from "@/components/guards/AuthGuard";
import { Zap, ShieldCheck, Shield, Mail, ArrowRight, ArrowLeft } from "lucide-react";

// Left Panel Hero Component
function ForgotPasswordHero() {
  return (
    <section className="hidden lg:flex lg:w-1/2 relative bg-black flex-col justify-between p-12 overflow-hidden">
      {/* Decorative Background Element */}
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-[#afc6ff]/5 rounded-full blur-[100px]"></div>
      <div className="absolute bottom-1/4 right-0 w-64 h-64 bg-[#4cd6ff]/5 rounded-full blur-[80px]"></div>
      
      <div className="relative z-10">
        <div className="mb-24">
          <img 
            src="/logo/odito-logo-on-dark.png" 
            alt="Odito AI" 
            className="h-16 w-auto object-contain hover:scale-105 hover:opacity-90 transition-all duration-300"
          />
        </div>
        
        <div className="max-w-xl">
          <h1 className="text-5xl font-bold tracking-[-0.04em] leading-[1.1] mb-6 text-[#dee2f0]">
            Secure Your Account with Intelligent Verification
          </h1>
          <p className="text-[#c6c6cc] text-lg leading-relaxed mb-12">
            Experience the next generation of security. Our AI-driven verification systems ensure that your data stays private while maintaining effortless access.
          </p>
          
          <div className="grid grid-cols-1 gap-6">
            {/* Feature Card 1 */}
            <div className="flex items-start gap-4 p-6 rounded-2xl bg-[#1a2029]/50 border border-[#45474b]/10">
              <div className="w-12 h-12 rounded-lg bg-[#4cd6ff]/10 flex items-center justify-center shrink-0">
                <ShieldCheck className="text-[#4cd6ff]" />
              </div>
              <div>
                <h3 className="font-bold text-[#dee2f0] mb-1">Fast Verification</h3>
                <p className="text-sm text-[#c6c6cc]">Instant link delivery to your registered email for seamless recovery.</p>
              </div>
            </div>
            
            {/* Feature Card 2 */}
            <div className="flex items-start gap-4 p-6 rounded-2xl bg-[#1a2029]/50 border border-[#45474b]/10">
              <div className="w-12 h-12 rounded-lg bg-[#afc6ff]/10 flex items-center justify-center shrink-0">
                <Shield className="text-[#afc6ff]" />
              </div>
              <div>
                <h3 className="font-bold text-[#dee2f0] mb-1">Secure Access</h3>
                <p className="text-sm text-[#c6c6cc]">End-to-end encrypted recovery protocols protecting your digital identity.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="relative z-10">
        <div className="flex items-center gap-4 text-xs font-bold uppercase tracking-widest text-[#c6c6cc]/50">
          <span>Precision Security</span>
          <div className="w-12 h-px bg-[#45474b]/30"></div>
          <span>Global Standards</span>
        </div>
      </div>
      
      {/* Absolute Image Overlay (Subtle) */}
      <div className="absolute bottom-0 left-0 w-full h-1/2 opacity-20 pointer-events-none">
        <img
          alt="Security Concept"
          className="w-full h-full object-cover"
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuDE0a8h8c3uig2I6oglR0JQdwN0uPy2loxDRDS6c5N_VTc77FCsHIm4QGCHBjBvxT0yh7OT2kALvfe3agV8L5m8b6ZZz4vaktOVGVAdHl3b7JIR8dXz9Pqdmcgd6jTbcNRDxGTtgnc0WeR7ASzH5zcOZDvTTsRhII0TywHxexLYQYlniE7iy6Sibz0r0MYoi1WAqJMyFjRK3gO9Jw2uYQ3dhWcLuB66JezJNRopa0axPiN1sMlaEWTGlb15uxeiyv2c2GaEKu_yCWM"
        />
      </div>
    </section>
  );
}

// Right Panel Form Component
function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!email) {
      setError("Please enter your email address");
      return;
    }

    if (!validateEmail(email)) {
      setError("Please enter a valid email address");
      return;
    }

    setIsLoading(true);

    try {
      const apiService = (await import("@/lib/apiService")).default;
      await apiService.forgotPassword(email);

      // The endpoint's response is deliberately generic (never reveals
      // whether the account exists) — so navigation always proceeds the
      // same way regardless of what the backend actually did. This goes to
      // the OTP verification step, never directly to /reset-password — a
      // reset-password URL is only ever reachable with a token minted
      // after that OTP is verified (see verify-reset-otp/page.jsx).
      localStorage.setItem("resetPasswordEmail", email);
      router.push(`/verify-reset-otp?email=${encodeURIComponent(email)}`);
    } catch (err) {
      setError(err?.message || "Something went wrong. Please try again.");
      setIsLoading(false);
    }
  };

  const isFormValid = email && validateEmail(email);

  return (
    <section className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 bg-black">
      {/* Mobile Branding (Hidden on desktop) */}
      <div className="absolute top-8 left-8 lg:hidden">
        <img 
          src="/logo/odito-logo-on-dark.png" 
          alt="Odito AI" 
          className="h-12 w-auto object-contain hover:scale-105 hover:opacity-90 transition-all duration-300"
        />
      </div>
      
      <div className="w-full max-w-md relative">
        {/* Glass Panel */}
        <div className="p-8 sm:p-10 rounded-[2rem] border border-[#45474b]/20 shadow-2xl relative overflow-hidden bg-[#30353f]/60 backdrop-blur-20">
          {/* Background Glow inside Card */}
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-[#4cd6ff]/10 rounded-full blur-[60px]"></div>
          
          <div className="relative z-10">
            <div className="mb-10">
              <h2 className="text-3xl font-bold tracking-[-0.04em] text-[#dee2f0] mb-2">
                Forgot Password
              </h2>
              <p className="text-[#c6c6cc] font-medium">
                Enter your email to receive a password reset link
              </p>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="block text-sm font-bold text-[#c6c6cc] tracking-wide px-1" htmlFor="email">
                  Email address
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail className="text-[#8f9096] group-focus-within:text-[#4cd6ff] transition-colors w-5 h-5" />
                  </div>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="block w-full pl-12 pr-4 py-4 bg-[#161c25] border-transparent focus:border-[#45474b]/40 focus:ring-0 rounded-xl text-[#dee2f0] placeholder-[#8f9096] transition-all duration-300 outline-none"
                  />
                </div>
              </div>

              {error && (
                <div className="p-3 text-sm text-red-400 bg-red-900/20 border border-red-800/30 rounded-lg">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={!isFormValid || isLoading}
                className="w-full bg-gradient-to-br from-[#4cd6ff] to-[#0085a3] hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 py-4 px-6 rounded-xl text-[#dee2f0] font-bold flex items-center justify-center gap-2 shadow-lg shadow-[#4cd6ff]/20"
              >
                <span>{isLoading ? "Sending..." : "Send OTP on Mail"}</span>
                <ArrowRight className="text-lg" />
              </button>
            </form>
            
            <div className="mt-8 text-center">
              <Link
                className="inline-flex items-center gap-2 text-sm font-bold text-[#4cd6ff] hover:text-[#4cd6ff] transition-colors group"
                href="/login"
              >
                <ArrowLeft className="text-base transition-transform group-hover:-translate-x-1" />
                <span>Back to Login</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// Main Page Component
function ForgotPasswordContent() {
  return (
    <main className="flex min-h-screen w-full bg-black text-[#dee2f0] antialiased relative">
      {/* Noise Texture Layer */}
      <div className="fixed inset-0 opacity-3 pointer-events-none z-0" style={{
        backgroundImage: 'url(https://lh3.googleusercontent.com/aida-public/AB6AXuAAju95ejAef_0CtOk8-dNzgRzKFlnOotX04_67oSp-bNNDtM-7PBJ-X1S0mJ2mDgSt6DoST62_68TX30P0yLCsKQYQIV5gxBN1UirmWJlWZ9gBodThKouVdKR7Oz05LsUzIQSWMP42UkJdsl9eGkXosLU74IkJCDgl4La9kaGbJN1JzHvB_-aMGAskGgeMXUOz_pUr4mRFMLeEVMJxZrFtoiDFuqbCIpt4JK4984BPEODM-P_5yKrsWT3_LxvGr6Va4vrdDyGGQpE)'
      }}></div>
      
      <div className="flex-grow flex h-screen overflow-hidden relative z-10">
        <ForgotPasswordHero />
        <ForgotPasswordForm />
      </div>
      
      {/* Simple Footer */}
      <footer className="fixed bottom-0 left-0 w-full z-20 pointer-events-none">
        <div className="w-full max-w-7xl mx-auto px-8 py-8 flex justify-between items-center">
          <p className="text-[0.6875rem] uppercase tracking-wider font-bold text-slate-500/50">
            © 2024 Odito AI. Kinetic Nebula Design System.
          </p>
          <div className="flex gap-6 pointer-events-auto">
            <Link className="text-[0.6875rem] uppercase tracking-wider font-bold text-slate-500 hover:text-[#afc6ff] transition-colors" href="/privacy-policy">
              Privacy Policy
            </Link>
            <Link className="text-[0.6875rem] uppercase tracking-wider font-bold text-slate-500 hover:text-[#afc6ff] transition-colors" href="/terms">
              Terms of Service
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}

export default function ForgotPasswordPage() {
  return (
    <PublicGuard>
      <ForgotPasswordContent />
    </PublicGuard>
  );
}
