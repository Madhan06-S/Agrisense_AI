"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Phone, ArrowRight, Loader2, Shield } from "lucide-react";
import { auth } from "@/lib/firebase";
import { signInWithPhoneNumber, RecaptchaVerifier } from "firebase/auth";

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
  const [message, setMessage] = useState("");
  
  // CRITICAL: Store confirmation result and verifier in refs
  const confirmationResultRef = useRef<any>(null);
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);
  const recaptchaContainerId = "recaptcha-container";

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const clearRecaptcha = () => {
    if (recaptchaVerifierRef.current) {
      recaptchaVerifierRef.current.clear();
      recaptchaVerifierRef.current = null;
    }
  };

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const cleanPhone = phone.replace(/\D/g, "");
      
      // 1. Check if phone exists in your DB
      const checkRes = await fetch("/api/v1/auth/check-phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: cleanPhone })
      });
      
      const checkData = await checkRes.json();
      if (!checkData.exists) {
        throw new Error("Mobile number not registered. Contact your block agriculture officer.");
      }

      setPhoneRole(checkData.role);

      // Check if it's a test number for mock bypass
      if (cleanPhone === "9876543210" || cleanPhone === "9876543211" || cleanPhone === "9876543299") {
        console.log("Mock bypass activated for test account:", cleanPhone);
        confirmationResultRef.current = {
          confirm: async (code: string) => {
            if (code !== "123456") {
              throw { code: "auth/invalid-verification-code", message: "Invalid OTP" };
            }
            return {
              user: {
                getIdToken: async () => `mock-token-${cleanPhone}`
              }
            };
          }
        };
        setMessage("OTP sent successfully. (Mock Bypass)");
        setStep("otp");
        setCountdown(60);
        setLoading(false);
        return;
      }

      // 2. Clear any old reCAPTCHA
      clearRecaptcha();

      // 3. Create new reCAPTCHA verifier (visible is more reliable than invisible)
      const verifier = new RecaptchaVerifier(auth, recaptchaContainerId, {
        size: 'normal',
        callback: () => {
          console.log("reCAPTCHA solved");
        },
        'expired-callback': () => {
          setError("reCAPTCHA expired. Please try again.");
          setLoading(false);
        }
      });
      
      recaptchaVerifierRef.current = verifier;

      // 4. Send OTP via Firebase (MUST include +91)
      const formattedPhone = `+91${cleanPhone}`;
      console.log("Sending OTP to:", formattedPhone);
      
      const confirmation = await signInWithPhoneNumber(auth, formattedPhone, verifier);
      confirmationResultRef.current = confirmation;
      
      setMessage("OTP sent successfully. Check your SMS.");
      setStep("otp");
      setCountdown(60);

    } catch (err: any) {
      console.error("Send OTP error:", err);
      const errorMsg = err?.message || "Failed to send OTP";
      
      // Map Firebase errors to user-friendly messages
      if (errorMsg.includes("auth/internal-error")) {
        setError("Service temporarily unavailable. Please try again in a moment.");
      } else if (errorMsg.includes("auth/invalid-phone-number")) {
        setError("Invalid phone number format.");
      } else if (errorMsg.includes("auth/too-many-requests")) {
        setError("Too many attempts. Please try again later.");
      } else {
        setError(errorMsg);
      }
      
      clearRecaptcha();
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (!confirmationResultRef.current) {
        throw new Error("Session expired. Please request a new OTP.");
      }

      if (phoneRole === "officer" && !pin) {
        throw new Error("Security PIN is required for Official login.");
      }

      // Confirm with Firebase
      const result = await confirmationResultRef.current.confirm(otp.trim());
      const idToken = await result.user.getIdToken();

      // Send to your backend
      const payload: any = { 
        id_token: idToken,
        phone: phone.replace(/\D/g, "")
      };
      if (phoneRole === "officer") {
        payload.pin = pin;
      }

      const res = await fetch("/api/v1/auth/verify-firebase-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Authentication failed");
      }

      // Store everything
      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem("refresh_token", data.refresh_token);
      localStorage.setItem("user", JSON.stringify(data.user));
      localStorage.setItem("user_role", data.user.role);
      localStorage.setItem("user_name", data.user.full_name || "User");

      // HARD redirect based on role
      const role = data.user.role;
      if (role === "farmer") {
        window.location.href = "/dashboard/farmer";
      } else if (role === "officer") {
        window.location.href = "/dashboard/officer/claims";
      } else {
        window.location.href = "/dashboard";
      }

    } catch (err: any) {
      console.error("Verify OTP error:", err);
      const msg = err?.message || "Invalid OTP";
      if (msg.includes("auth/invalid-verification-code")) {
        setError("Invalid OTP. Please enter the correct code.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    // Reset to phone step to regenerate reCAPTCHA
    setStep("phone");
    setOtp("");
    setPin("");
    setError("");
    setMessage("");
    clearRecaptcha();
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Government Header */}
      <div className="bg-[#1a4d2e] text-white text-xs py-2 px-4 text-center">
        भारत सरकार | Government of India | Ministry of Agriculture & Farmers Welfare
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
              <Shield className="w-8 h-8 text-green-700" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">AgriSense AI</h1>
            <p className="text-sm text-slate-500 mt-1">
              PMFBY Digital Claim Settlement Portal
            </p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            {step === "phone" ? (
              <form onSubmit={handleSendOTP} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Mobile Number
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-medium">
                      +91
                    </span>
                    <input
                      type="tel"
                      autoFocus
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                      placeholder="9876543210"
                      maxLength={10}
                      className="w-full pl-12 pr-4 py-3 border border-slate-300 rounded-lg 
                               focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500
                               text-slate-900 placeholder:text-slate-400"
                      required
                    />
                  </div>
                  <p className="text-xs text-slate-500 mt-1.5">
                    Enter your registered 10-digit mobile number.
                  </p>
                </div>

                {/* reCAPTCHA container - MUST exist in DOM */}
                <div id={recaptchaContainerId} className="flex justify-center"></div>

                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                    {error}
                  </div>
                )}

                {message && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
                    {message}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || phone.length !== 10}
                  className="w-full flex items-center justify-center gap-2 bg-green-700 hover:bg-green-800 
                           disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-medium 
                           py-3 rounded-lg transition-colors"
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

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    6-Digit Verification Code
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoFocus
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="000000"
                    maxLength={6}
                    className="w-full text-center text-2xl font-semibold tracking-[0.5em] py-3 
                             border border-slate-300 rounded-lg 
                             focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-slate-900"
                  />
                </div>

                {phoneRole === "officer" && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                      Security PIN
                    </label>
                    <input
                      type="password"
                      inputMode="numeric"
                      value={pin}
                      onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                      placeholder="••••"
                      maxLength={4}
                      className="w-full text-center text-2xl font-semibold tracking-[0.5em] py-3 
                               border border-slate-300 rounded-lg 
                               focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 text-slate-900"
                      required
                    />
                  </div>
                )}

                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 text-center">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || otp.length !== 6 || (phoneRole === "officer" && pin.length !== 4)}
                  className="w-full flex items-center justify-center gap-2 bg-green-700 hover:bg-green-800 
                           disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-medium 
                           py-3 rounded-lg transition-colors"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify OTP"}
                </button>

                <div className="flex items-center justify-between text-sm">
                  <button
                    type="button"
                    onClick={handleResend}
                    className="text-slate-500 hover:text-slate-700"
                  >
                    Change number
                  </button>
                  
                  {countdown > 0 ? (
                    <span className="text-slate-400">
                      Resend in 00:{countdown.toString().padStart(2, '0')}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResend}
                      className="text-green-700 hover:text-green-800 font-medium"
                    >
                      Resend OTP
                    </button>
                  )}
                </div>

                <p className="text-center text-xs text-slate-400">
                  Helpline: 1800-180-1551 (Kisan Call Centre)
                </p>
              </form>
            )}
          </div>

          <p className="text-center text-xs text-slate-400 mt-6">
            © Department of Agriculture & Farmers Welfare, Government of India
          </p>
        </div>
      </div>
    </div>
  );
}
