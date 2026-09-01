'use client';

import React, { useState, useEffect } from 'react';
import { Shield, ArrowRight, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState<string>('');
  const [otp, setOtp] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [timer, setTimer] = useState<number>(300); // 5 minutes

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

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);

    if (phone.length !== 10) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }

    setLoading(true);

    try {
      // 1. Check if phone exists
      const checkRes = await fetch('/api/v1/auth/check-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });

      const checkData = await checkRes.json();

      if (!checkRes.ok || !checkData.exists) {
        setError('Mobile number not registered. Contact your block agriculture officer.');
        setLoading(false);
        return;
      }

      // 2. Send OTP
      const sendRes = await fetch('/api/v1/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });

      const sendData = await sendRes.json();

      if (!sendRes.ok) {
        setError(sendData.detail || 'Failed to dispatch OTP. Please try again.');
        setLoading(false);
        return;
      }

      setInfoMessage(sendData.message || 'OTP sent to your registered mobile number.');
      setStep('otp');
      setTimer(300);
    } catch (err: any) {
      setError('Network error. Unable to communicate with AgriSense authentication server.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
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
    if (timer > 240) return; // Prevent spamming resend
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
        setInfoMessage('New OTP dispatched to your mobile number.');
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
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
      {/* Header Bar */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center mb-6">
        <div className="inline-flex items-center justify-center p-3 bg-[#1a4d2e] rounded-xl text-white shadow-md mb-3">
          <Shield className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">
          AgriSense AI Government Portal
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Ministry of Agriculture & Farmers Welfare
        </p>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-sm border border-slate-200 sm:rounded-lg sm:px-10">
          {error && (
            <div className="mb-4 p-3 bg-[#fef2f2] border border-[#fecaca] text-[#b91c1c] text-sm rounded-md font-medium">
              {error}
            </div>
          )}

          {step === 'phone' ? (
            <form onSubmit={handleSendOtp} className="space-y-5">
              <div>
                <label htmlFor="phone" className="block text-sm font-semibold text-slate-700 mb-1">
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
                    className="block w-full pl-12 pr-3 py-2.5 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#166534] focus:border-[#166534] text-slate-900 text-sm"
                    maxLength={10}
                    required
                  />
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  OTP will be sent to your registered mobile number via SMS
                </p>
              </div>

              <button
                type="submit"
                disabled={loading || phone.length !== 10}
                className="w-full flex items-center justify-center py-2.5 px-4 border border-transparent rounded-md text-sm font-semibold text-white bg-[#166534] hover:bg-[#14532d] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#166534] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
            <form onSubmit={handleVerifyOtp} className="space-y-5">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label htmlFor="otp" className="block text-sm font-semibold text-slate-700">
                    6-Digit OTP Code
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setStep('phone');
                      setError(null);
                    }}
                    className="text-xs text-[#166534] hover:underline font-medium"
                  >
                    Change Number
                  </button>
                </div>

                <p className="text-xs text-slate-600 mb-2">
                  Sent to <span className="font-semibold text-slate-800">+91 {phone}</span>
                </p>

                <p className="text-xs text-slate-500 mb-3">
                  OTP sent to your mobile number. Please check your SMS inbox.
                </p>

                <input
                  type="text"
                  id="otp"
                  value={otp}
                  onChange={handleOtpChange}
                  placeholder="Enter 6-digit OTP"
                  className="block w-full px-3 py-2.5 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#166534] focus:border-[#166534] text-center text-lg tracking-widest font-mono text-slate-900"
                  maxLength={6}
                  required
                />

                <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                  <span>
                    Expires in: <strong className="text-slate-700 font-mono">{formatTimer(timer)}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={timer > 240 || loading}
                    className="text-[#166534] hover:underline disabled:text-slate-400 disabled:no-underline font-medium"
                  >
                    Resend OTP
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="w-full flex items-center justify-center py-2.5 px-4 border border-transparent rounded-md text-sm font-semibold text-white bg-[#166534] hover:bg-[#14532d] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#166534] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
