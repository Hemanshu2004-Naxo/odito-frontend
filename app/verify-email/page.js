"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { CheckCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { PublicGuard } from "@/components/guards/AuthGuard";

function EmailVerificationContent() {
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isResending, setIsResending] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isVerified, setIsVerified] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  // Get email from localStorage or query params
  useEffect(() => {
    const storedEmail = localStorage.getItem('verificationEmail');
    const urlParams = new URLSearchParams(window.location.search);
    const emailParam = urlParams.get('email');
    
    if (emailParam) {
      setEmail(emailParam);
      localStorage.setItem('verificationEmail', emailParam);
    } else if (storedEmail) {
      setEmail(storedEmail);
    }
  }, []);

  // Countdown timer for resend OTP
  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [timeLeft]);

  // Handle OTP input changes
  const handleOtpChange = (index, value) => {
    if (value.length > 1) return; // Only allow single digit
    
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      const nextInput = document.getElementById(`otp-${index + 1}`);
      if (nextInput) nextInput.focus();
    }
  };

  // Handle key press for backspace navigation
  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      const prevInput = document.getElementById(`otp-${index - 1}`);
      if (prevInput) prevInput.focus();
    }
  };

  // Handle paste event
  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').slice(0, 6);
    const newOtp = pastedData.split('').concat(Array(6 - pastedData.length).fill(''));
    setOtp(newOtp);
  };

  // Verify OTP
  const handleVerify = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    const otpString = otp.join('');
    
    if (otpString.length !== 6) {
      setError("Please enter all 6 digits");
      setIsLoading(false);
      return;
    }

    try {
      const apiService = (await import('@/lib/apiService')).default;
      const result = await apiService.verifyEmailOTP(email, otpString);
      
      setIsVerified(true);
      console.log("✅ Email verified successfully!", result.data.user);
      
      // Clean up temporary data
      localStorage.removeItem('verificationEmail');
      localStorage.removeItem('tempPassword');
      
      // Redirect to login page after successful verification
      setTimeout(() => {
        router.push('/login');
      }, 2000);
      
    } catch (error) {
      console.error("❌ OTP verification failed:", error.message);
      setError(error.message || "Invalid OTP. Please try again.");
    }

    setIsLoading(false);
  };

  // Resend OTP
  const handleResend = async () => {
    if (timeLeft > 0) return;
    
    setError("");
    setIsResending(true);

    try {
      const apiService = (await import('@/lib/apiService')).default;
      await apiService.generateEmailOTP(email);
      
      // Start countdown (60 seconds)
      setTimeLeft(60);
      console.log("✅ OTP resent successfully");
      
    } catch (error) {
      console.error("❌ Failed to resend OTP:", error.message);
      setError(error.message || "Failed to resend OTP. Please try again.");
    }

    setIsResending(false);
  };

  if (isVerified) {
    return (
      <div className="min-h-screen bg-black text-[#dee2f0] flex flex-col">
        <main className="flex min-h-screen w-full">
          <section className="hidden lg:flex w-1/2 relative flex-col justify-between p-16 overflow-hidden bg-black">
            <div className="absolute inset-0 noise-bg pointer-events-none"></div>
            <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-[#4cd6ff]/5 rounded-full blur-[120px] pointer-events-none"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-[#afc6ff]/5 rounded-full blur-[100px] pointer-events-none"></div>
            <div className="relative z-10">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 kinetic-gradient rounded-xl flex items-center justify-center">
                  <span className="text-white text-2xl">🚀</span>
                </div>
                <span className="text-2xl font-bold tracking-tighter text-white">Odito AI</span>
              </div>
            </div>
            <div className="relative z-10">
              <p className="text-xs text-[#8f9096] font-medium tracking-widest uppercase">Precision Engineering for the Kinetic Nebula</p>
            </div>
          </section>
          <section className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 relative overflow-hidden">
            <div className="absolute inset-0 noise-bg pointer-events-none"></div>
            <div className="lg:hidden absolute top-8 left-8 flex items-center gap-2">
              <div className="w-8 h-8 kinetic-gradient rounded-lg flex items-center justify-center">
                <span className="text-white text-xl">🚀</span>
              </div>
              <span className="text-xl font-bold tracking-tighter text-white">Odito AI</span>
            </div>
            <div className="w-full max-w-md glass-panel p-6 sm:p-8 rounded-xl border border-[#45474b]/15 shadow-[0_20px_50px_rgba(0,0,0,0.3)] relative z-10">
              <div className="text-center mb-10">
                <div className="mx-auto w-16 h-16 bg-[#252a34] rounded-full flex items-center justify-center mb-6 border border-[#45474b]/20">
                  <CheckCircle className="w-8 h-8 text-[#4cd6ff]" />
                </div>
                <h2 className="text-3xl font-bold tracking-tight text-white mb-3">Email Verified!</h2>
                <p className="text-[#c6c6cc] leading-relaxed">
                  Your email has been successfully verified. Redirecting to login page...
                </p>
              </div>
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#afc6ff] mx-auto"></div>
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

  return (
    <div className="min-h-screen bg-black text-[#dee2f0] flex flex-col">
      <main className="flex min-h-screen w-full">
        {/* LEFT SIDE: Branding & Features */}
        <section className="hidden lg:flex w-1/2 relative flex-col justify-between p-16 overflow-hidden bg-black">
          {/* Noise and Glow Effects */}
          <div className="absolute inset-0 noise-bg pointer-events-none"></div>
          <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-[#4cd6ff]/5 rounded-full blur-[120px] pointer-events-none"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-[#afc6ff]/5 rounded-full blur-[100px] pointer-events-none"></div>
          
          {/* Brand Logo */}
          <div className="relative z-10">
            <Link href="/">
              <img 
                src="/logo/odito-logo-on-dark.png" 
                alt="Odito AI" 
                className="h-16 w-auto object-contain hover:scale-105 hover:opacity-90 transition-all duration-300"
              />
            </Link>
          </div>
          
          {/* Hero Content */}
          <div className="relative z-10 max-w-xl">
            <h1 className="text-5xl font-bold tracking-[-0.04em] leading-[1.1] mb-6">
              <span className="text-gradient-teal">Secure</span> Your Account with Intelligent <span className="text-gradient-teal">Verification</span>
            </h1>
            <p className="text-[#c6c6cc] text-lg leading-relaxed mb-12 max-w-md">
              We use smart verification to ensure your account stays protected and trusted.
            </p>
            
            {/* Feature Cards */}
            <div className="grid gap-6">
              {/* Fast Verification Card */}
              <div className="glass-panel p-6 rounded-xl border border-[#45474b]/15 flex gap-5 items-start">
                <div className="w-12 h-12 rounded-lg bg-[#4cd6ff]/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-[#4cd6ff] text-2xl">⚡</span>
                </div>
                <div>
                  <h3 className="text-white font-bold mb-1">Fast Verification</h3>
                  <p className="text-[#c6c6cc] text-sm">Instant 6-digit code delivery to your registered inbox.</p>
                </div>
              </div>
              
              {/* Secure Access Card */}
              <div className="glass-panel p-6 rounded-xl border border-[#45474b]/15 flex gap-5 items-start">
                <div className="w-12 h-12 rounded-lg bg-[#afc6ff]/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-[#afc6ff] text-2xl">🔒</span>
                </div>
                <div>
                  <h3 className="text-white font-bold mb-1">Secure Access</h3>
                  <p className="text-[#c6c6cc] text-sm">Advanced protection and multi-layer encryption for your account.</p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Decorative Footer Info */}
          <div className="relative z-10">
            <p className="text-xs text-[#8f9096] font-medium tracking-widest uppercase">Precision Engineering for the Kinetic Nebula</p>
          </div>
        </section>
        
        {/* RIGHT SIDE: OTP Interaction */}
        <section className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 relative overflow-hidden">
          <div className="absolute inset-0 noise-bg pointer-events-none"></div>
          
          {/* Mobile Brand Header (Hidden on Desktop) */}
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
              <h2 className="text-3xl font-bold tracking-tight text-white mb-3">Verify Your Email</h2>
              <p className="text-[#c6c6cc] leading-relaxed">
                Enter the 6-digit code sent to<br />
                <span className="text-[#4cd6ff] font-medium">{email}</span>
              </p>
            </div>
            
            <form onSubmit={handleVerify} className="space-y-8">
              {/* OTP Input Group */}
              <div className="flex justify-between gap-2 sm:gap-3">
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    id={`otp-${index}`}
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

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-14 kinetic-gradient text-white font-bold rounded-full flex items-center justify-center gap-2 group hover:shadow-[0_0_25px_rgba(29,116,245,0.4)] transition-all duration-300 transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? "Verifying..." : "Verify Email"}
                {!isLoading && <span className="group-hover:translate-x-1 transition-transform">→</span>}
              </button>
            </form>
            
            {/* Resend Section */}
            <div className="mt-8 text-center">
              <p className="text-[#c6c6cc] text-sm">
                Didn't receive the code?
                <button
                  onClick={handleResend}
                  disabled={isResending || timeLeft > 0}
                  className="text-[#4cd6ff] hover:text-[#4cd6ff]/80 font-semibold ml-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isResending ? 'Sending...' :
                   timeLeft > 0 ? `Resend in ${timeLeft}s` : 'Resend Code'}
                </button>
              </p>
            </div>
            
            {/* Footer Links & Helpers */}
            <div className="mt-12 flex flex-col items-center gap-6">
              <Link className="flex items-center gap-2 text-[#c6c6cc] hover:text-white transition-colors text-sm font-medium" href="/login">
                <span>←</span>
                Back to Login
              </Link>
              <div className="flex items-start gap-2 max-w-[280px] text-center">
                <span className="text-[#8f9096] text-lg">ℹ️</span>
                <p className="text-[#8f9096] text-xs leading-relaxed">
                  Check your spam folder if you don't see the email within a few minutes.
                </p>
              </div>
            </div>
          </div>
          
          {/* Background Gradient for Right Side (Subtle) */}
          <div className="absolute bottom-[-20%] left-[-20%] w-[600px] h-[600px] bg-[#1d74f5]/5 rounded-full blur-[140px] pointer-events-none"></div>
        </section>
      </main>
      
      {/* Footer */}
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

export default function EmailVerification() {
  return (
    <PublicGuard>
      <EmailVerificationContent />
    </PublicGuard>
  );
}
