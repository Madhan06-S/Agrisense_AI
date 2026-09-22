'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Shield, ArrowRight, Loader2, KeyRound, CheckCircle, UserCheck } from 'lucide-react';

function LoginContent() {
  const searchParams = useSearchParams();
  const roleParam = searchParams.get('role');

  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState<string>('');
  const [otp, setOtp] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
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
    if (error) setError(null);
  };

  const handleOtpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    setOtp(value);
    if (error) setError(null);
  };

  const quickFillDemo = (demoPhone: string) => {
    setPhone(demoPhone);
    setError(null);
    setInfoMessage(`Pre-filled demo number ${demoPhone}. Click Send OTP or use Master OTP 123456.`);
  };

  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setInfoMessage(null);

    const cleanPhone = phone.replace(/\D/g, '').slice(0, 10);

    if (cleanPhone.length !== 10) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }

    setLoading(true);

    try {
      // 1. Check if phone exists
      const checkRes = await fetch('/api/v1/auth/check-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: cleanPhone }),
      });

      const checkData = await checkRes.json();

      if (!checkRes.ok || !checkData.exists) {
        setError(checkData.detail || 'Mobile number not registered. Contact your block agriculture officer.');
        setLoading(false);
        return;
      }

      // 2. Send OTP
      const sendRes = await fetch('/api/v1/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: cleanPhone }),
      });

      const sendData = await sendRes.json();

      if (!sendRes.ok) {
        setError(sendData.detail || 'Failed to dispatch OTP. Please try again.');
        setLoading(false);
        return;
      }

      setInfoMessage(sendData.message || 'OTP sent to your registered mobile number. Use Demo OTP: 123456');
      setStep('otp');
      setOtp('123456'); // Auto-fill demo OTP for developer convenience
      setTimer(300);
    } catch (err: any) {
      setError('Network error. Unable to communicate with AgriSense authentication server.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);

    if (otp.length !== 6) {
      setError('Please enter the 6-digit OTP code.');
      return;
    }

    setLoading(true);

    try {
      const verifyRes = await fetch('/api/v1/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otp }),
      });

      const data = await verifyRes.json();

      if (!verifyRes.ok) {
        setError(data.detail || 'Invalid OTP verification.');
        setLoading(false);
        return;
      }

      // Store tokens and user details in localStorage
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('refresh_token', data.refresh_token);
      localStorage.setItem('user_role', data.user.role);
      localStorage.setItem('user_name', data.user.full_name || data.user.phone);

      // Hard redirect to correct dashboard
      if (data.user.role === 'officer' || data.user.role === 'admin') {
        window.location.href = '/dashboard/officer/claims';
      } else {
        window.location.href = '/dashboard/farmer';
      }
    } catch (err: any) {
      setError('Connection failed. Please check network connectivity.');
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (timer > 240) return;
    setError(null);
    setLoading(true);
    try {
      const sendRes = await fetch('/api/v1/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const sendData = await sendRes.json();
      if (sendRes.ok) {
        setInfoMessage('New OTP dispatched. Use Demo OTP: 123456');
        setTimer(300);
      } else {
        setError(sendData.detail || 'Failed to resend OTP.');
      }
    } catch (err) {
      setError('Failed to resend OTP.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F9F5] flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
      {/* Header Bar */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center mb-6">
        <div className="inline-flex items-center justify-center p-3 bg-[#E8F5E9] border border-[#2E7D32]/30 rounded-xl text-[#1B5E20] shadow-md mb-3">
          <Shield className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-[#1B5E20]">
          AgriSense AI Government Portal
        </h2>
        <p className="mt-1 text-sm text-[#5B6B5B]">
          Ministry of Agriculture & Farmers Welfare
        </p>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-sm border border-[#E5EBE3] sm:rounded-lg sm:px-10 space-y-5">
          
          {/* Quick Demo Fill Selector */}
          <div className="bg-[#F7F9F5] border border-[#E5EBE3] rounded-lg p-3 space-y-2">
            <p className="text-[11px] font-bold text-[#1B5E20] uppercase tracking-wider flex items-center gap-1">
              <UserCheck className="w-3.5 h-3.5 text-[#2E7D32]" /> Select Demo Login Account:
            </p>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => quickFillDemo('9876543210')}
                className={`py-1.5 px-2 text-[11px] font-semibold rounded border transition ${
                  phone === '9876543210'
                    ? 'bg-[#2E7D32] text-white border-[#2E7D32]'
                    : 'bg-white text-[#374151] border-[#E5EBE3] hover:border-[#2E7D32]'
                }`}
              >
                🌾 Farmer 1
              </button>
              <button
                type="button"
                onClick={() => quickFillDemo('9876543211')}
                className={`py-1.5 px-2 text-[11px] font-semibold rounded border transition ${
                  phone === '9876543211'
                    ? 'bg-[#2E7D32] text-white border-[#2E7D32]'
                    : 'bg-white text-[#374151] border-[#E5EBE3] hover:border-[#2E7D32]'
                }`}
              >
                🌾 Farmer 2
              </button>
              <button
                type="button"
                onClick={() => quickFillDemo('9876543299')}
                className={`py-1.5 px-2 text-[11px] font-semibold rounded border transition ${
                  phone === '9876543299'
                    ? 'bg-[#2E7D32] text-white border-[#2E7D32]'
                    : 'bg-white text-[#374151] border-[#E5EBE3] hover:border-[#2E7D32]'
                }`}
              >
                👮 Officer
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-[#fef2f2] border border-[#fecaca] text-[#b91c1c] text-xs rounded-md font-medium">
              {error}
            </div>
          )}

          {infoMessage && (
            <div className="p-3 bg-[#E8F5E9] border border-[#2E7D32]/30 text-[#1B5E20] text-xs rounded-md font-medium flex items-start gap-2">
              <CheckCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#2E7D32]" />
              <span>{infoMessage}</span>
            </div>
          )}

          {step === 'phone' ? (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div>
                <label htmlFor="phone" className="block text-xs font-semibold text-[#374151] mb-1">
                  Mobile Number
                </label>
                <div className="relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 font-medium text-sm">
                    +91
                  </div>
                  <input
                    type="tel"
                    id="phone"
                    value={phone}
                    onChange={handlePhoneChange}
                    placeholder="Enter 10-digit mobile number"
                    className="block w-full pl-12 pr-3 py-2.5 border border-[#E5EBE3] rounded-md focus:outline-none focus:ring-2 focus:ring-[#2E7D32] focus:border-[#166534] text-[#1B5E20] text-sm font-medium"
                    maxLength={10}
                    required
                  />
                </div>
                <p className="mt-1.5 text-[11px] text-slate-500">
                  OTP will be sent to your registered mobile number via SMS (Demo OTP: <strong className="text-[#1B5E20]">123456</strong>)
                </p>
              </div>

              <button
                type="submit"
                disabled={loading || phone.length !== 10}
                className="w-full flex items-center justify-center py-2.5 px-4 border border-transparent rounded-md text-sm font-semibold text-white bg-[#2E7D32] hover:bg-[#1B5E20] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#2E7D32] disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Sending OTP...
                  </>
                ) : (
                  <>
                    Send OTP
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label htmlFor="otp" className="block text-xs font-semibold text-[#374151]">
                    6-Digit OTP Code
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setStep('phone');
                      setError(null);
                    }}
                    className="text-xs text-[#2E7D32] hover:underline font-medium"
                  >
                    Change Number
                  </button>
                </div>

                <p className="text-xs text-[#5B6B5B] mb-2">
                  Sent to <span className="font-semibold text-slate-800">+91 {phone}</span>
                </p>

                <div className="p-2.5 bg-[#FFF8E7] border border-[#F1C40F] rounded-md text-[11px] text-[#B45309] font-medium mb-3 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 shrink-0" />
                  <span>Demo OTP pre-filled: <strong>123456</strong></span>
                </div>

                <input
                  type="text"
                  id="otp"
                  value={otp}
                  onChange={handleOtpChange}
                  placeholder="Enter 6-digit OTP"
                  className="block w-full px-3 py-2.5 border border-[#E5EBE3] rounded-md focus:outline-none focus:ring-2 focus:ring-[#2E7D32] focus:border-[#166534] text-center text-lg tracking-widest font-mono text-[#1B5E20] font-bold"
                  maxLength={6}
                  required
                />

                <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                  <span>
                    Expires in: <strong className="text-[#374151] font-mono">{formatTimer(timer)}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={timer > 240 || loading}
                    className="text-[#2E7D32] hover:underline disabled:text-slate-400 disabled:no-underline font-medium"
                  >
                    Resend OTP
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="w-full flex items-center justify-center py-2.5 px-4 border border-transparent rounded-md text-sm font-semibold text-white bg-[#2E7D32] hover:bg-[#1B5E20] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#2E7D32] disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    Verify OTP & Sign In
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#F7F9F5] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#1B5E20]" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
