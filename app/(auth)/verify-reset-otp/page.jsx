"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { PublicGuard } from "@/components/guards/AuthGuard";

/**
 * Step 2 of the password-reset flow — OTP entry only. On success, the
 * backend returns a short-lived resetToken; this page's ONLY job is to
 * hand that token to /reset-password?token=... and go there. It never
 * knows or cares about the eventual new password, and /reset-password
 * never sees the email or the OTP — the token is the sole handoff.
 */
function VerifyResetOtpContent() {
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isResending, setIsResending] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const emailParam = searchParams.get("email");
    const storedEmail = typeof window !== "undefined" ? localStorage.getItem("resetPasswordEmail") : null;
    if (emailParam) {
      setEmail(emailParam);
    } else if (storedEmail) {
      setEmail(storedEmail);
    } else {
      // No email in the URL or storage — this page was reached directly,
      // not via Forgot Password. Bounce back to where a code can actually
      // be requested rather than showing a form that can never succeed.
      router.replace("/forgot-password");
    }
  }, [searchParams, router]);

  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [timeLeft]);

  const handleOtpChange = (index, value) => {
    if (value.length > 1) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    if (value && index < 5) {
      const nextInput = document.getElementById(`reset-otp-${index + 1}`);
      if (nextInput) nextInput.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      const prevInput = document.getElementById(`reset-otp-${index - 1}`);
      if (prevInput) prevInput.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    const newOtp = pastedData.split("").concat(Array(6 - pastedData.length).fill(""));
    setOtp(newOtp);
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setError("");

    const otpString = otp.join("");
    if (otpString.length !== 6) {
      setError("Please enter all 6 digits");
      return;
    }

    setIsLoading(true);
    try {
      const apiService = (await import("@/lib/apiService")).default;
      const result = await apiService.verifyResetOtp(email, otpString);
      const resetToken = result?.data?.resetToken;

      if (!resetToken) {
        setError("Something went wrong. Please try again.");
        setIsLoading(false);
        return;
      }

      localStorage.removeItem("resetPasswordEmail");
      // The token — never the email — is what /reset-password accepts.
      router.push(`/reset-password?token=${encodeURIComponent(resetToken)}`);
    } catch (err) {
      setError(err?.message || "Invalid code. Please try again.");
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (timeLeft > 0 || !email) return;
    setError("");
    setIsResending(true);
    try {
      const apiService = (await import("@/lib/apiService")).default;
      await apiService.forgotPassword(email);
      setTimeLeft(60);
    } catch (err) {
      setError(err?.message || "Failed to resend code. Please try again.");
    }
    setIsResending(false);
  };

  return (
    <div className="min-h-screen bg-black text-[#dee2f0] flex flex-col">
      <main className="flex min-h-screen w-full">
        <section className="hidden lg:flex w-1/2 relative flex-col justify-between p-16 overflow-hidden bg-black">
          <div className="absolute inset-0 noise-bg pointer-events-none"></div>
          <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-[#4cd6ff]/5 rounded-full blur-[120px] pointer-events-none"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-[#afc6ff]/5 rounded-full blur-[100px] pointer-events-none"></div>

          <div className="relative z-10">
            <Link href="/">
              <img
                src="/logo/odito-logo-on-dark.png"
                alt="Odito AI"
                className="h-16 w-auto object-contain hover:scale-105 hover:opacity-90 transition-all duration-300"
              />
            </Link>
          </div>

          <div className="relative z-10 max-w-xl">
            <h1 className="text-5xl font-bold tracking-[-0.04em] leading-[1.1] mb-6">
              <span className="text-gradient-teal">Verify</span> It's <span className="text-gradient-teal">You</span>
            </h1>
            <p className="text-[#c6c6cc] text-lg leading-relaxed mb-12 max-w-md">
              Enter the code we sent you to continue resetting your password.
            </p>

            <div className="grid gap-6">
              <div className="glass-panel p-6 rounded-xl border border-[#45474b]/15 flex gap-5 items-start">
                <div className="w-12 h-12 rounded-lg bg-[#4cd6ff]/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-[#4cd6ff] text-2xl">⚡</span>
                </div>
                <div>
                  <h3 className="text-white font-bold mb-1">Fast Verification</h3>
                  <p className="text-[#c6c6cc] text-sm">Instant 6-digit code delivery to your registered inbox.</p>
                </div>
              </div>

              <div className="glass-panel p-6 rounded-xl border border-[#45474b]/15 flex gap-5 items-start">
                <div className="w-12 h-12 rounded-lg bg-[#afc6ff]/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-[#afc6ff] text-2xl">🔒</span>
                </div>
                <div>
                  <h3 className="text-white font-bold mb-1">Secure by Design</h3>
                  <p className="text-[#c6c6cc] text-sm">This code alone can't reset your password — it only unlocks a short-lived, single-use link.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="relative z-10">
            <p className="text-xs text-[#8f9096] font-medium tracking-widest uppercase">Precision Engineering for the Kinetic Nebula</p>
          </div>
        </section>

        <section className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 relative overflow-hidden">
          <div className="absolute inset-0 noise-bg pointer-events-none"></div>

          <div className="lg:hidden absolute top-8 left-8">
            <Link href="/">
              <img
                src="/logo/odito-logo-on-dark.png"
                alt="Odito AI"
                className="h-12 w-auto object-contain hover:scale-105 hover:opacity-90 transition-all duration-300"
              />
            </Link>
          </div>

          <div className="w-full max-w-md glass-panel p-6 sm:p-8 rounded-xl border border-[#45474b]/15 shadow-[0_20px_50px_rgba(0,0,0,0.3)] relative z-10">
            <div className="text-center mb-10">
              <div className="w-16 h-16 bg-[#252a34] rounded-full flex items-center justify-center mx-auto mb-6 border border-[#45474b]/20">
                <span className="text-[#4cd6ff] text-3xl">✉️</span>
              </div>
              <h2 className="text-3xl font-bold tracking-tight text-white mb-3">Enter Reset Code</h2>
              <p className="text-[#c6c6cc] leading-relaxed">
                Enter the 6-digit code sent to<br />
                <span className="text-[#4cd6ff] font-medium">{email || "your email"}</span>
              </p>
            </div>

            <form onSubmit={handleVerify} className="space-y-8">
              <div className="flex justify-between gap-2 sm:gap-3">
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    id={`reset-otp-${index}`}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    onPaste={handlePaste}
                    className="w-full h-14 sm:h-16 text-center text-xl font-bold bg-[#090e17] border border-[#45474b]/30 rounded-xl text-white focus:ring-2 focus:ring-[#4cd6ff]/40 focus:border-[#4cd6ff] transition-all duration-200 outline-none"
                    required
                  />
                ))}
              </div>

              {error && (
                <div className="p-3 text-sm text-red-400 bg-red-900/20 border border-red-800/30 rounded-lg">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-14 kinetic-gradient text-white font-bold rounded-full flex items-center justify-center gap-2 group hover:shadow-[0_0_25px_rgba(29,116,245,0.4)] transition-all duration-300 transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? "Verifying..." : "Verify Code"}
                {!isLoading && <span className="group-hover:translate-x-1 transition-transform">→</span>}
              </button>
            </form>

            <div className="mt-8 text-center">
              <p className="text-[#c6c6cc] text-sm">
                Didn't receive the code?
                <button
                  onClick={handleResend}
                  disabled={isResending || timeLeft > 0}
                  className="text-[#4cd6ff] hover:text-[#4cd6ff]/80 font-semibold ml-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isResending ? "Sending..." : timeLeft > 0 ? `Resend in ${timeLeft}s` : "Resend Code"}
                </button>
              </p>
            </div>

            <div className="mt-12 flex flex-col items-center gap-6">
              <Link className="flex items-center gap-2 text-[#c6c6cc] hover:text-white transition-colors text-sm font-medium" href="/login">
                <span>←</span>
                Back to Login
              </Link>
              <div className="flex items-start gap-2 max-w-[280px] text-center">
                <span className="text-[#8f9096] text-lg">ℹ️</span>
                <p className="text-[#8f9096] text-xs leading-relaxed">
                  Codes expire after 5 minutes for your security.
                </p>
              </div>
            </div>
          </div>

          <div className="absolute bottom-[-20%] left-[-20%] w-[600px] h-[600px] bg-[#1d74f5]/5 rounded-full blur-[140px] pointer-events-none"></div>
        </section>
      </main>

      <footer className="w-full py-12 bg-black border-t border-[#45474b]/15 px-8 flex flex-col md:flex-row justify-between items-center gap-6">
        <p className="text-[#aeb2b7] text-xs tracking-normal uppercase">© 2024 Odito AI. Precision Engineering for the Kinetic Nebula.</p>
        <div className="flex gap-8">
          <Link className="text-[#aeb2b7] hover:text-[#afc6ff] transition-colors text-xs tracking-normal uppercase" href="/privacy-policy">Privacy Policy</Link>
          <Link className="text-[#aeb2b7] hover:text-[#afc6ff] transition-colors text-xs tracking-normal uppercase" href="/terms">Terms of Service</Link>
          <Link className="text-[#aeb2b7] hover:text-[#afc6ff] transition-colors text-xs tracking-normal uppercase" href="#">Status</Link>
        </div>
      </footer>
    </div>
  );
}

export default function VerifyResetOtpPage() {
  return (
    <PublicGuard>
      <Suspense fallback={<div className="min-h-screen bg-black" />}>
        <VerifyResetOtpContent />
      </Suspense>
    </PublicGuard>
  );
}
