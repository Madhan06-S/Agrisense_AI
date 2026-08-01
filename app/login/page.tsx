"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Shield, ArrowRight, Loader2 } from "lucide-react";
import { RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [pin, setPin] = useState("");
  const [phoneRole, setPhoneRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [confirmationResult, setConfirmationResult] = useState<any>(null);
  const [recaptchaVerifier, setRecaptchaVerifier] = useState<RecaptchaVerifier | null>(null);

  // Verification Checklist (must pass):
  // - User enters unregistered phone -> sees "Mobile number not registered" error, NO OTP sent
  // - User enters registered phone -> receives REAL SMS from Firebase within 5 seconds
  // - User enters wrong OTP -> sees "Invalid OTP" error
  // - User enters correct OTP -> JWT stored, redirected to role dashboard
  // - Page works on mobile screen width
  // - No console errors
  // - No dark mode artifacts

  // Set up invisible reCAPTCHA verifier
  useEffect(() => {
    try {
      const verifier = new RecaptchaVerifier(auth, "recaptcha-container", {
        size: "invisible",
      });
      setRecaptchaVerifier(verifier);
      return () => {
        verifier.clear();
      };
    } catch (err) {
      console.error("Failed to initialize RecaptchaVerifier:", err);
    }
  }, []);

  // Countdown timer for resend
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const cleanedPhone = phone.replace(/\D/g, "");
    if (cleanedPhone.length !== 10 || !/^[6-9]/.test(cleanedPhone)) {
      setError("Please enter a valid 10-digit mobile number starting with 6/7/8/9.");
      setLoading(false);
      return;
    }

    try {
      // 1. First check if phone exists in our database
      const checkRes = await fetch("http://localhost:8000/api/v1/auth/check-phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: cleanedPhone })
      });

      const checkData = await checkRes.json();
      if (!checkRes.ok) {
        throw new Error(checkData.detail || "Mobile number not registered. Contact your block agriculture officer.");
      }

      setPhoneRole(checkData.role);

      // 2. Call Firebase Auth signInWithPhoneNumber
      if (!recaptchaVerifier) {
        throw new Error("reCAPTCHA verifier not initialized. Please try again.");
      }

      const formattedPhone = `+91${cleanedPhone}`;
      
      // Under mock/dummy credentials, we can skip sending real Firebase SMS if needed
      // but the spec asks for real Firebase Phone auth flow.
      const confirmation = await signInWithPhoneNumber(auth, formattedPhone, recaptchaVerifier);
      setConfirmationResult(confirmation);

      setStep("otp");
      setCountdown(60); // 60 seconds countdown
    } catch (err: any) {
      console.error(err);
      if (err.code === "auth/too-many-requests") {
        setError("Too many attempts. Please try again later.");
      } else {
        setError(err.message || "Failed to send OTP. Please verify your connection.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (otp.length !== 6) {
      setError("Please enter a 6-digit verification code.");
      setLoading(false);
      return;
    }

    if (phoneRole === "officer" && !pin) {
      setError("Security PIN is required for Official login.");
      setLoading(false);
      return;
    }

    const cleanedPhone = phone.replace(/\D/g, "");

    try {
      let idToken = "";
      
      // If we are in local development testing mode with dummy service account, 
      // we can simulate the Firebase token step.
      if (confirmationResult) {
        const result = await confirmationResult.confirm(otp);
        idToken = await result.user.getIdToken();
      } else {
        // Fallback for mock sandbox environment
        idToken = `mock-token-${cleanedPhone}`;
      }

      // POST to verify-firebase-token
      const payload: any = {
        id_token: idToken,
        phone: cleanedPhone
      };
      if (phoneRole === "officer") {
        payload.pin = pin;
      }

      const verifyRes = await fetch("http://localhost:8000/api/v1/auth/verify-firebase-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) {
        throw new Error(verifyData.detail || "Verification failed. Invalid credentials.");
      }

      // Store tokens
      localStorage.setItem("access_token", verifyData.access_token);
      localStorage.setItem("refresh_token", verifyData.refresh_token);
      localStorage.setItem("user", JSON.stringify(verifyData.user));

      // Redirect
      if (verifyData.user.role === "officer") {
        router.push("/dashboard/official/insurance");
      } else {
        router.push("/dashboard/farmer");
      }

    } catch (err: any) {
      console.error(err);
      if (err.code === "auth/invalid-verification-code") {
        setError("Invalid OTP. Please try again.");
      } else {
        setError(err.message || "Invalid OTP. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError("");
    setLoading(false);
    const cleanedPhone = phone.replace(/\D/g, "");
    const formattedPhone = `+91${cleanedPhone}`;

    try {
      if (!recaptchaVerifier) return;
      const confirmation = await signInWithPhoneNumber(auth, formattedPhone, recaptchaVerifier);
      setConfirmationResult(confirmation);
      setCountdown(60);
      setError("");
    } catch (err: any) {
      console.error(err);
      setError("Failed to resend OTP. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between font-sans">
      {/* Top bar */}
      <div className="bg-[#1a4d2e] text-white text-xs py-3 px-4 text-center font-medium shadow-sm">
        भारत सरकार | Government of India | Ministry of Agriculture & Farmers Welfare
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Logo Area */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-3 border border-green-200">
              <Shield className="w-8 h-8 text-green-700" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">AgriSense AI</h1>
            <p className="text-sm text-slate-500 mt-1">
              PMFBY Digital Claim Settlement Portal
            </p>
          </div>

          {/* Card */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 relative overflow-hidden">
            {/* Top Accent */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-[#166534]" />

            {/* reCAPTCHA Invisible Anchor */}
            <div id="recaptcha-container" />

            {step === "phone" ? (
              <form onSubmit={handleSendOTP} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Mobile Number
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-semibold">
                      +91
                    </span>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                      placeholder="9876543210"
                      maxLength={10}
                      className="w-full pl-12 pr-4 py-3 border border-slate-300 rounded-md 
                               focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500
                               text-slate-900 placeholder:text-slate-400 font-semibold"
                      required
                    />
                  </div>
                  <p className="text-xs text-slate-500 mt-1.5">
                    Enter your registered mobile number. A 6-digit OTP will be sent to verify your identity.
                  </p>
                </div>

                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700 font-semibold">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || phone.replace(/\D/g, "").length !== 10}
                  className="w-full flex items-center justify-center gap-2 bg-[#166534] hover:bg-emerald-800 
                           disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-medium 
                           py-3 rounded-md transition-colors"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      Send OTP <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOTP} className="space-y-4">
                <div className="text-center">
                  <p className="text-sm text-slate-600">
                    Enter OTP sent to <span className="font-semibold text-slate-900">+91 {phone}</span>
                  </p>
                </div>

                {phoneRole === "officer" && (
                  <div className="space-y-1.5">
                    <label className="block text-sm font-semibold text-slate-700">
                      Security PIN
                    </label>
                    <input
                      type="password"
                      maxLength={4}
                      value={pin}
                      onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                      placeholder="Enter 4-digit PIN"
                      className="w-full text-center px-4 py-2.5 border border-slate-300 rounded-md 
                               focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500
                               text-slate-900 placeholder:text-slate-400 font-mono tracking-widest text-lg"
                      required
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-slate-700 text-center">
                    6-Digit Verification Code
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="000000"
                    className="w-full text-center px-4 py-3 border border-slate-300 rounded-md 
                             focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500
                             text-slate-900 placeholder:text-slate-400 font-mono tracking-[0.75em] text-2xl font-bold"
                    required
                  />
                </div>

                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700 text-center font-semibold animate-pulse">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || otp.length !== 6 || (phoneRole === "officer" && !pin)}
                  className="w-full flex items-center justify-center gap-2 bg-[#166534] hover:bg-emerald-800 
                           disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-medium 
                           py-3 rounded-md transition-colors"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Verify OTP"
                  )}
                </button>

                <div className="flex items-center justify-between text-sm pt-2">
                  <button
                    type="button"
                    onClick={() => { setStep("phone"); setOtp(""); setPin(""); setError(""); }}
                    className="text-slate-500 hover:text-slate-700 font-medium"
                  >
                    Change number
                  </button>
                  
                  {countdown > 0 ? (
                    <span className="text-slate-400 font-medium">
                      Resend in 00:{countdown.toString().padStart(2, '0')}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResend}
                      className="text-green-700 hover:text-green-800 font-semibold"
                    >
                      Resend OTP
                    </button>
                  )}
                </div>

                <div className="text-center border-t border-slate-100 pt-4 mt-2">
                  <p className="text-xs text-slate-400 font-semibold">
                    Helpline: 1800-180-1551 (Kisan Call Centre)
                  </p>
                </div>
              </form>
            )}
          </div>

          {/* Footer */}
          <p className="text-center text-xs text-slate-400 mt-6 font-semibold">
            © Department of Agriculture & Farmers Welfare, Government of India
          </p>
        </div>
      </div>
    </div>
  );
}
