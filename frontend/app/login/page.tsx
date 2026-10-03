'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { 
  Shield, 
  ArrowRight, 
  Loader2, 
  CheckCircle2, 
  UserCheck, 
  RefreshCw, 
  AlertCircle,
  Satellite,
  Lock,
  ArrowLeft,
  Smartphone,
  ChevronRight
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

function LoginContent() {
  const searchParams = useSearchParams();
  const roleParam = searchParams.get('role');

  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState<string>('');
  const [otp, setOtp] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isNetworkError, setIsNetworkError] = useState<boolean>(false);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [timer, setTimer] = useState<number>(300); // 5 minutes

  // Auto-fill phone based on URL role param
  useEffect(() => {
    if (roleParam === 'officer') {
      setPhone('9876543299');
    } else if (roleParam === 'farmer') {
      setPhone('9876543210');
    }
  }, [roleParam]);

  // Countdown timer logic when on OTP step
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (step === 'otp' && timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [step, timer]);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 10);
    setPhone(value);
    if (error) {
      setError(null);
      setIsNetworkError(false);
    }
  };

  const handleOtpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    setOtp(value);
    if (error) {
      setError(null);
      setIsNetworkError(false);
    }
  };

  const selectRolePhone = (selectedPhone: string) => {
    setPhone(selectedPhone);
    setError(null);
    setIsNetworkError(false);
    setInfoMessage(null);
  };

  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setIsNetworkError(false);
    setInfoMessage(null);

    const cleanPhone = phone.replace(/\D/g, '').slice(0, 10);

    if (cleanPhone.length !== 10) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }

    setLoading(true);

    try {
      // 1. Check if phone exists
      const checkRes = await fetch(`${API_BASE}/auth/check-phone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: cleanPhone }),
      }).catch(() => null);

      if (!checkRes) {
        setIsNetworkError(true);
        setError('Backend server offline. Start it with: uvicorn app.main:app --reload --port 8000');
        setLoading(false);
        return;
      }

      const checkData = await checkRes.json();

      if (!checkRes.ok || !checkData.exists) {
        setError(checkData.detail || 'Mobile number not registered. Contact your block agriculture officer.');
        setLoading(false);
        return;
      }

      // 2. Send OTP
      const sendRes = await fetch(`${API_BASE}/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: cleanPhone }),
      }).catch(() => null);

      if (!sendRes) {
        setIsNetworkError(true);
        setError('Backend server offline. Start it with: uvicorn app.main:app --reload --port 8000');
        setLoading(false);
        return;
      }

      const sendData = await sendRes.json();

      if (!sendRes.ok) {
        setError(sendData.detail || 'Failed to dispatch OTP. Please try again.');
        setLoading(false);
        return;
      }

      const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
      const displayMsg = (isDemoMode && sendData.otp_code) 
        ? `OTP dispatched! Code: ${sendData.otp_code} (or use master code 123456)`
        : 'OTP sent to your registered mobile number.';
      setInfoMessage(displayMsg);
      setStep('otp');
      if (isDemoMode && sendData.otp_code) {
        setOtp(sendData.otp_code);
      }
      setTimer(300);
    } catch (err: any) {
      setIsNetworkError(true);
      setError('Backend server offline. Start it with: uvicorn app.main:app --reload --port 8000');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setIsNetworkError(false);

    if (otp.length !== 6) {
      setError('Please enter the 6-digit OTP code.');
      return;
    }

    setLoading(true);

    try {
      const verifyRes = await fetch(`${API_BASE}/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otp }),
      }).catch(() => null);

      if (!verifyRes) {
        setIsNetworkError(true);
        setError('Backend server offline. Start it with: uvicorn app.main:app --reload --port 8000');
        setLoading(false);
        return;
      }

      const data = await verifyRes.json();

      if (!verifyRes.ok) {
        setError(data.detail || 'Invalid OTP code. Check backend console for the generated code.');
        setLoading(false);
        return;
      }

      // Store tokens and user details in localStorage
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('refresh_token', data.refresh_token);
      localStorage.setItem('user_role', data.user.role);
      localStorage.setItem('user_name', data.user.full_name || data.user.phone);

      // Store cookies so Next.js middleware recognizes authenticated session
      document.cookie = `access_token=${data.access_token}; path=/; max-age=604800; SameSite=Lax`;
      document.cookie = `user_role=${data.user.role}; path=/; max-age=604800; SameSite=Lax`;

      // Redirect to correct dashboard
      if (data.user.role === 'officer' || data.user.role === 'admin') {
        window.location.href = '/dashboard/officer/claims';
      } else {
        window.location.href = '/dashboard/farmer';
      }
    } catch (err: any) {
      setIsNetworkError(true);
      setError('Backend server offline. Start it with: uvicorn app.main:app --reload --port 8000');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (timer > 240) return;
    setError(null);
    setIsNetworkError(false);
    setLoading(true);
    try {
      const sendRes = await fetch(`${API_BASE}/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      }).catch(() => null);

      if (!sendRes) {
        setIsNetworkError(true);
        setError('Backend server offline. Start it with: uvicorn app.main:app --reload --port 8000');
        return;
      }

      const sendData = await sendRes.json();
      if (sendRes.ok) {
        setInfoMessage('New OTP dispatched to your registered mobile number.');
        setTimer(300);
      } else {
        setError(sendData.detail || 'Failed to resend OTP.');
      }
    } catch (err) {
      setIsNetworkError(true);
      setError('Backend server offline. Start it with: uvicorn app.main:app --reload --port 8000');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F9F5] flex flex-col justify-between font-sans selection:bg-emerald-100">
      
      {/* Top Navigation Bar */}
      <header className="py-4 px-6 md:px-12 border-b border-emerald-950/10 bg-white">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <Link href="/" className="flex items-center gap-2.5 text-slate-700 hover:text-slate-900 transition-colors font-medium text-xs">
            <ArrowLeft className="w-4 h-4 text-emerald-700" />
            <span>Back to AgriSense Portal</span>
          </Link>

          <div className="text-xs font-semibold text-emerald-900 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-emerald-700" />
            <span>NIC Encrypted Auth</span>
          </div>
        </div>
      </header>

      {/* Main Split Layout */}
      <main className="flex-1 flex items-center justify-center py-10 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-5xl bg-white rounded-3xl border border-slate-200/80 shadow-xl overflow-hidden grid grid-cols-1 lg:grid-cols-12">
          
          {/* Left Dark Emerald Showcase Panel (5-Cols) */}
          <div className="hidden lg:flex lg:col-span-5 bg-gradient-to-br from-[#0c2a15] via-[#103a1e] to-[#05180c] text-white p-10 flex-col justify-between relative overflow-hidden">
            <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

            <div className="space-y-6 relative z-10">
              <div className="inline-flex items-center gap-2 bg-emerald-500/20 text-emerald-300 text-[11px] font-mono font-bold px-3 py-1 rounded-full border border-emerald-500/30">
                <Satellite className="w-3.5 h-3.5" />
                PMFBY Digital Identity Gateway
              </div>

              <h2 className="text-3xl font-extrabold text-white tracking-tight leading-snug">
                Instant Verification & Parametric Payouts
              </h2>

              <p className="text-xs text-emerald-100/80 leading-relaxed font-normal">
                Sign in with your registered PMFBY mobile number to view satellite NDVI vegetation health, claim statuses, and automated Direct Benefit Transfers.
              </p>
            </div>

            {/* Platform Security Badge Cards */}
            <div className="space-y-3 relative z-10 text-xs font-mono">
              <div className="bg-slate-900/80 border border-emerald-500/30 p-3.5 rounded-xl space-y-1">
                <span className="text-[10px] text-slate-400 block uppercase">SHA-256 Cryptographic Audit</span>
                <span className="text-emerald-400 font-bold">100% Immutable Verification</span>
              </div>
              <div className="bg-slate-900/80 border border-emerald-500/30 p-3.5 rounded-xl space-y-1">
                <span className="text-[10px] text-slate-400 block uppercase">EXIF Timestamp & GPS Gate</span>
                <span className="text-white font-bold">48-Hr Photo Freshness Active</span>
              </div>
            </div>

            <div className="text-[10px] font-mono text-emerald-300/60 pt-4 border-t border-emerald-900">
              Department of Agriculture & Farmers Welfare, Govt of India
            </div>
          </div>

          {/* Right Form Panel (7-Cols) */}
          <div className="lg:col-span-7 p-6 sm:p-10 flex flex-col justify-between space-y-6">
            
            <div className="space-y-6">
              <div>
                <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                  Sign In to AgriSense
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Select your role account or enter your registered 10-digit mobile number.
                </p>
              </div>

              {/* Role Quick Selector */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 space-y-2.5">
                <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-emerald-700" /> Demo Account Role Shortcuts:
                </p>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => selectRolePhone('9876543210')}
                    className={`py-2.5 px-3 text-xs font-semibold rounded-xl border transition-all flex items-center justify-center gap-1.5 ${
                      phone === '9876543210'
                        ? 'bg-[#15803d] text-white border-[#15803d] shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-600'
                    }`}
                  >
                    🌾 Farmer (9876543210)
                  </button>
                  <button
                    type="button"
                    onClick={() => selectRolePhone('9876543299')}
                    className={`py-2.5 px-3 text-xs font-semibold rounded-xl border transition-all flex items-center justify-center gap-1.5 ${
                      phone === '9876543299'
                        ? 'bg-[#0f172a] text-white border-[#0f172a] shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-slate-800'
                    }`}
                  >
                    👮 Officer (9876543299)
                  </button>
                </div>
              </div>

              {/* Error Alert Box */}
              {error && (
                <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-medium space-y-2.5">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                  {isNetworkError && (
                    <div>
                      <button
                        type="button"
                        onClick={() => {
                          if (step === 'phone') handleSendOtp();
                          else handleVerifyOtp();
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-700 text-white text-xs font-semibold rounded-lg hover:bg-red-800 transition"
                      >
                        <RefreshCw className="w-3 h-3" />
                        Retry Connection
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Success Info Message Box */}
              {infoMessage && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl font-medium flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-700" />
                  <span>{infoMessage}</span>
                </div>
              )}

              {step === 'phone' ? (
                <form onSubmit={handleSendOtp} className="space-y-5">
                  <div>
                    <label htmlFor="phone" className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Registered Mobile Number
                    </label>
                    <div className="relative rounded-xl shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500 font-bold text-sm">
                        +91
                      </div>
                      <input
                        type="tel"
                        id="phone"
                        value={phone}
                        onChange={handlePhoneChange}
                        placeholder="Enter 10-digit mobile number"
                        className="block w-full pl-14 pr-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:border-emerald-700 text-slate-900 text-sm font-semibold font-mono tracking-wide"
                        maxLength={10}
                        required
                      />
                    </div>
                    <p className="mt-1.5 text-[11px] text-slate-500">
                      OTP code will be dispatched to your phone via GSM SMS gateway.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || phone.length !== 10}
                    className="w-full flex items-center justify-center py-3.5 px-4 rounded-xl text-sm font-bold text-white bg-[#15803d] hover:bg-[#166534] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg transition-all cursor-pointer"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Dispatching OTP...
                      </>
                    ) : (
                      <>
                        Request OTP Code
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp} className="space-y-5">
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label htmlFor="otp" className="block text-xs font-semibold text-slate-700">
                        6-Digit OTP Security Code
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setStep('phone');
                          setError(null);
                          setIsNetworkError(false);
                        }}
                        className="text-xs text-emerald-700 hover:underline font-bold"
                      >
                        Change Number
                      </button>
                    </div>

                    <p className="text-xs text-slate-500 mb-2">
                      Code dispatched to <span className="font-bold text-slate-900">+91 {phone}</span>
                    </p>

                    <input
                      type="text"
                      id="otp"
                      value={otp}
                      onChange={handleOtpChange}
                      placeholder="Enter 6-digit OTP"
                      className="block w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-700 text-center text-xl tracking-[0.3em] font-mono text-emerald-900 font-extrabold bg-emerald-50/40"
                      maxLength={6}
                      required
                    />

                    <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                      <span>
                        Expires in: <strong className="text-slate-900 font-mono font-bold">{formatTimer(timer)}</strong>
                      </span>
                      <button
                        type="button"
                        onClick={handleResendOtp}
                        disabled={timer > 240 || loading}
                        className="text-emerald-700 hover:underline disabled:text-slate-400 disabled:no-underline font-bold"
                      >
                        Resend Code
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || otp.length !== 6}
                    className="w-full flex items-center justify-center py-3.5 px-4 rounded-xl text-sm font-bold text-white bg-[#15803d] hover:bg-[#166534] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg transition-all cursor-pointer"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Authenticating...
                      </>
                    ) : (
                      <>
                        Verify & Access Dashboard
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>

            <div className="text-[11px] text-slate-400 pt-4 border-t border-slate-100 flex items-center justify-between">
              <span>Protected by DPDP Act 2023</span>
              <span className="font-mono text-emerald-800 font-bold">Government of India</span>
            </div>

          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-[11px] text-slate-400 border-t border-slate-200 bg-white">
        AgriSense AI Portal — National e-Governance Modernization Stack
      </footer>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#F7F9F5] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#15803d]" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
