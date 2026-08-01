"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Phone, Lock, ArrowRight, ShieldCheck, HelpCircle } from "lucide-react";
import SMSSimulator from "@/components/SMSSimulator";

export default function LoginPage() {
  const router = useRouter();
  const [role, setRole] = useState<"farmer" | "officer">("farmer");
  const [phone, setPhone] = useState("");
  const [step, setStep] = useState<1 | 2>(1);
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [pin, setPin] = useState("");
  const [timer, setTimer] = useState(30);
  const [canResend, setCanResend] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Timer countdown
  useEffect(() => {
    if (step === 2 && timer > 0) {
      const interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(interval);
    } else if (timer === 0) {
      setCanResend(true);
    }
  }, [step, timer]);

  const validatePhone = (num: string) => {
    return num.length === 10 && /^[6789]\d{9}$/.test(num);
  };

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validatePhone(phone)) {
      setError("Please enter a valid 10-digit mobile number starting with 6/7/8/9.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const res = await fetch("http://localhost:8000/api/v1/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, role }),
      });
      const data = await res.json();
      if (res.ok) {
        setStep(2);
        setTimer(30);
        setCanResend(false);
        setSuccess("OTP sent successfully to your mobile number.");
      } else {
        setError(data.detail || "Failed to send OTP. Please try again.");
      }
    } catch (err) {
      setError("Unable to connect to the authentication server.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    const otpCode = otp.join("");
    if (otpCode.length !== 6) {
      setError("Please enter a 6-digit OTP.");
      return;
    }
    if (role === "officer" && !pin) {
      setError("Please enter your 4-digit security PIN.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const res = await fetch("http://localhost:8000/api/v1/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, otp: otpCode, pin: role === "officer" ? pin : undefined }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess("Login successful! Redirecting...");
        // Store user in localstorage for state
        localStorage.setItem("user", JSON.stringify(data.user));
        
        setTimeout(() => {
          if (data.user.role === "officer") {
            router.push("/dashboard/official/insurance");
          } else {
            router.push("/dashboard/farmer");
          }
        }, 1000);
      } else {
        setError(data.detail || "Authentication failed. Invalid OTP or PIN.");
      }
    } catch (err) {
      setError("Verification failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!canResend) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("http://localhost:8000/api/v1/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, role }),
      });
      if (res.ok) {
        setTimer(30);
        setCanResend(false);
        setOtp(["", "", "", "", "", ""]);
        setSuccess("OTP resent successfully.");
      } else {
        const data = await res.json();
        setError(data.detail || "Failed to resend OTP.");
      }
    } catch (err) {
      setError("Unable to connect to the authentication server.");
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (isNaN(Number(value))) return;
    const newOtp = [...otp];
    newOtp[index] = value.substring(value.length - 1);
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 font-sans flex flex-col justify-between">
      {/* Top Gov Header */}
      <div className="bg-[#1a4d2e] text-white text-xs px-6 py-2 flex justify-between items-center border-b border-[#166534]">
        <div className="flex items-center gap-4">
          <span>भारत सरकार | Government of India</span>
          <span className="hidden md:inline text-slate-300">| Pradhan Mantri Fasal Bima Yojana (PMFBY)</span>
        </div>
        <div className="flex items-center gap-3">
          <button className="hover:text-emerald-300 transition-colors">English</button>
          <span className="text-slate-500">|</span>
          <button className="hover:text-emerald-300 transition-colors font-semibold">हिंदी</button>
        </div>
      </div>

      {/* Main Login Card */}
      <div className="flex-1 flex items-center justify-center py-12 px-6">
        <div className="bg-white border border-[#E2E8F0] rounded-xl shadow-lg max-w-md w-full p-8 relative overflow-hidden">
          {/* Top Border Accent */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-[#166534]" />

          {/* Logo & Scheme */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#166534]/10 mb-3">
              <ShieldCheck className="w-6 h-6 text-[#166534]" />
            </div>
            <h2 className="text-xl font-bold text-slate-800">AgriSense AI Portal</h2>
            <p className="text-xs text-slate-500 mt-1">PMFBY Claim Verification & Assessment</p>
          </div>

          {/* Tabs */}
          {step === 1 && (
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-lg mb-6">
              <button
                type="button"
                onClick={() => setRole("farmer")}
                className={`py-2 text-xs font-semibold rounded-md transition-all ${
                  role === "farmer"
                    ? "bg-white text-[#166534] shadow-sm border border-slate-200"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Farmer Login
              </button>
              <button
                type="button"
                onClick={() => setRole("officer")}
                className={`py-2 text-xs font-semibold rounded-md transition-all ${
                  role === "officer"
                    ? "bg-white text-[#166534] shadow-sm border border-slate-200"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Official Login
              </button>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-3 text-xs rounded mb-4 font-medium">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-emerald-50 border-l-4 border-[#166534] text-[#166534] p-3 text-xs rounded mb-4 font-medium">
              {success}
            </div>
          )}

          {step === 1 ? (
            /* STEP 1: Phone number */
            <form onSubmit={handleSendOTP} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">
                  Mobile Number
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 font-semibold text-sm">
                    +91
                  </div>
                  <input
                    type="tel"
                    maxLength={10}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                    placeholder="Enter 10-digit mobile number"
                    className="block w-full pl-12 pr-3 py-3 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#166534]/50 focus:border-[#166534] transition-all font-mono"
                    required
                  />
                  <Phone className="absolute right-3 top-3.5 w-4 h-4 text-slate-400" />
                </div>
                <p className="text-[10px] text-slate-400 mt-1.5">
                  Must start with 6, 7, 8, or 9. OTP will be sent to this number.
                </p>
              </div>

              <button
                type="submit"
                disabled={loading || !validatePhone(phone)}
                className="w-full bg-[#166534] hover:bg-emerald-800 disabled:bg-slate-300 text-white font-bold py-3 rounded-lg text-sm transition-all flex items-center justify-center gap-2 shadow-sm"
              >
                {loading ? "Sending OTP..." : "Get OTP Code"}
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          ) : (
            /* STEP 2: OTP Verification */
            <form onSubmit={handleVerifyOTP} className="space-y-5">
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide">
                    Enter 6-Digit OTP
                  </label>
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="text-[11px] text-[#166534] hover:underline font-semibold"
                  >
                    Change Number
                  </button>
                </div>
                <div className="grid grid-cols-6 gap-2 mb-2">
                  {otp.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => {
                        otpRefs.current[idx] = el;
                      }}
                      type="text"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(idx, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(idx, e)}
                      className="w-full text-center py-2.5 border border-slate-300 rounded-lg text-lg font-bold font-mono focus:outline-none focus:ring-2 focus:ring-[#166534]/50 focus:border-[#166534] transition-all bg-slate-50"
                    />
                  ))}
                </div>

                <div className="flex justify-between items-center text-xs mt-3">
                  <span className="text-slate-500">
                    {timer > 0 ? (
                      `Resend OTP in 00:${timer < 10 ? `0${timer}` : timer}`
                    ) : (
                      <button
                        type="button"
                        onClick={handleResend}
                        disabled={loading}
                        className="text-[#166534] font-bold hover:underline"
                      >
                        Resend OTP Code
                      </button>
                    )}
                  </span>
                  <span className="text-slate-400">Mobile: +91 {phone}</span>
                </div>
              </div>

              {role === "officer" && (
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wide">
                    Security PIN (4-Digit)
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      maxLength={4}
                      value={pin}
                      onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                      placeholder="Enter security PIN"
                      className="block w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#166534]/50 focus:border-[#166534] transition-all font-mono"
                      required
                    />
                    <Lock className="absolute right-3 top-3 w-4 h-4 text-slate-400" />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    *Officers require a 4-digit secure PIN for verification.
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || otp.join("").length !== 6 || (role === "officer" && !pin)}
                className="w-full bg-[#166534] hover:bg-emerald-800 disabled:bg-slate-300 text-white font-bold py-3 rounded-lg text-sm transition-all shadow-sm"
              >
                {loading ? "Verifying..." : "Verify & Log In"}
              </button>

              <div className="text-center pt-2">
                <p className="text-[11px] text-slate-500 flex items-center justify-center gap-1">
                  <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                  Didn't receive? Call 1800-180-1551 Helpline
                </p>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-slate-50 border-t border-slate-200 py-6 px-8 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-left">
            <p className="font-semibold text-slate-700">Ministry of Agriculture & Farmers Welfare</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Department of Agriculture & Farmers Welfare</p>
          </div>
          <div className="text-slate-400 max-w-md">
            Your data is protected under the Digital Personal Data Protection Act, 2023.
          </div>
        </div>
      </footer>

      {/* SMS Simulator Floating Phone */}
      <SMSSimulator />
    </div>
  );
}
