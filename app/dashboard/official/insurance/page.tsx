"use client";

import { useState, useEffect } from "react";
import {
  ArrowLeft,
  Shield,
  CheckCircle,
  AlertTriangle,
  FileText,
  Send,
  ChevronRight,
  Activity,
  IndianRupee,
  Users,
  Clock,
  Database,
} from "lucide-react";
import Link from "next/link";

// Mock data - replace with your actual API calls
const MOCK_STATS = {
  totalDisbursed: 2450000,
  successRate: 94.2,
  processedCount: 50,
  approvedCount: 47,
  pendingAmount: 325000,
  pendingCount: 8,
  avgProcessingDays: 2.3,
};

const MOCK_TRANSACTIONS = [
  {
    id: "12",
    farmer: "Ramesh Patel",
    amount: 25000,
    batch: "PFMS-2847",
    status: "Credited",
    time: "Today, 10:42 AM",
  },
  {
    id: "11",
    farmer: "Sunita Devi",
    amount: 18500,
    batch: "PFMS-2847",
    status: "Processing",
    time: "Today, 09:15 AM",
  },
  {
    id: "09",
    farmer: "Rajesh Kumar",
    amount: 32000,
    batch: "PFMS-2846",
    status: "Credited",
    time: "Yesterday, 04:30 PM",
  },
];

const MOCK_RULES = [
  {
    id: 1,
    name: "NDVI Drop Payout",
    trigger: "NDVI decline > 40% from 5-year baseline",
    payout: "50% of sum insured (max ₹1,00,000)",
    season: "Kharif season (Jun - Oct)",
    status: "active",
    lastTriggered: "25/07/2026 (Claim #12)",
  },
  {
    id: 2,
    name: "Flood Index Payout",
    trigger: "Flood index > 0.8",
    payout: "₹15,000 per hectare (max ₹2,00,000)",
    season: "All seasons",
    status: "active",
    lastTriggered: "25/07/2026 (Claim #12)",
  },
  {
    id: 3,
    name: "Rainfall Deficit",
    trigger: "Rainfall anomaly < -60% for 45 consecutive days",
    payout: "Tiered: 25% / 50% / 75% of sum insured",
    season: "Rabi season (Nov - Apr)",
    status: "active",
    lastTriggered: "Not triggered yet",
  },
];

const MOCK_LAST_SMS =
  "Claim #12 approved. ₹25,000 credited to your account ending in 4521. - AgriSense PMFBY";

const TABS = [
  { id: "rules", label: "Rules" },
  { id: "payouts", label: "Payouts" },
  { id: "fraud", label: "Fraud Detection" },
  { id: "reconciliation", label: "Reconciliation" },
  { id: "audit", label: "Audit Trail" },
];

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function InsuranceDashboard() {
  const [activeTab, setActiveTab] = useState("rules");
  const [currentTime, setCurrentTime] = useState("");

  useEffect(() => {
    const now = new Date();
    setCurrentTime(
      now.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    );
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Government Header Bar */}
      <div className="bg-[#1a4d2e] text-white text-xs py-1.5 px-4 flex justify-between items-center">
        <span className="font-medium tracking-wide">
          भारत सरकार | Government of India
        </span>
        <span>Ministry of Agriculture & Farmers Welfare</span>
      </div>

      {/* Top Navigation */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/official"
              className="p-1.5 hover:bg-slate-100 rounded-md transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </Link>
            <div>
              <h1 className="text-base font-semibold text-slate-900 leading-tight">
                PMFBY Claim Settlement Dashboard
              </h1>
              <p className="text-xs text-slate-500">
                Department of Agriculture & Farmers Welfare
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-600">
            <span className="flex items-center gap-1.5 bg-green-50 text-green-700 px-2.5 py-1 rounded-full border border-green-200">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              System Operational
            </span>
            <span>{currentTime}</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Disbursed (MTD)"
            value={formatCurrency(MOCK_STATS.totalDisbursed)}
            subtext={`${MOCK_STATS.approvedCount} claims processed`}
            icon={<IndianRupee className="w-4 h-4" />}
            color="green"
          />
          <StatCard
            title="Success Rate"
            value={`${MOCK_STATS.successRate}%`}
            subtext={`${MOCK_STATS.processedCount} total processed`}
            icon={<CheckCircle className="w-4 h-4" />}
            color="blue"
          />
          <StatCard
            title="Pending Settlement"
            value={formatCurrency(MOCK_STATS.pendingAmount)}
            subtext={`${MOCK_STATS.pendingCount} claims awaiting`}
            icon={<Clock className="w-4 h-4" />}
            color="amber"
          />
          <StatCard
            title="Avg Processing Time"
            value={`${MOCK_STATS.avgProcessingDays} days`}
            subtext="Target: Under 5 days"
            icon={<Activity className="w-4 h-4" />}
            color="slate"
          />
        </div>

        {/* Tab Navigation */}
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="border-b border-slate-200 px-2">
            <nav className="flex gap-1">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? "border-green-700 text-green-800"
                      : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {activeTab === "rules" && <RulesTab />}
            {activeTab === "payouts" && <PayoutsTab />}
            {activeTab === "fraud" && <FraudTab />}
            {activeTab === "reconciliation" && <ReconciliationTab />}
            {activeTab === "audit" && <AuditTab />}
          </div>
        </div>

        {/* Bottom Grid: Transactions + SMS */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Live Transaction Feed */}
          <div className="lg:col-span-2 bg-white rounded-lg border border-slate-200">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-slate-400" />
                <h3 className="text-sm font-semibold text-slate-900">
                  Recent Disbursements
                </h3>
              </div>
              <button className="text-xs text-green-700 hover:text-green-800 font-medium flex items-center gap-1">
                View All <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            <div className="divide-y divide-slate-100">
              {MOCK_TRANSACTIONS.map((tx) => (
                <div
                  key={tx.id}
                  className="px-5 py-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        tx.status === "Credited"
                          ? "bg-green-500"
                          : "bg-amber-500"
                      }`}
                    />
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        Claim #{tx.id} — {tx.farmer}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {tx.time} · Batch {tx.batch}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-900">
                      {formatCurrency(tx.amount)}
                    </p>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full border ${
                        tx.status === "Credited"
                          ? "bg-green-50 text-green-700 border-green-200"
                          : "bg-amber-50 text-amber-700 border-amber-200"
                      }`}
                    >
                      {tx.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* SMS Notification Center */}
          <div className="bg-white rounded-lg border border-slate-200">
            <div className="px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Send className="w-4 h-4 text-slate-400" />
                <h3 className="text-sm font-semibold text-slate-900">
                  Farmer Notification Center
                </h3>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-slate-50 rounded-md p-3 border border-slate-200">
                <p className="text-xs text-slate-500 mb-1.5">
                  Last sent message
                </p>
                <p className="text-sm text-slate-800 leading-relaxed">
                  {MOCK_LAST_SMS}
                </p>
                <p className="text-xs text-slate-400 mt-2">
                  Today, 10:42 AM · Delivered
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-700">
                  Message Template
                </label>
                <select className="w-full text-sm border border-slate-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500">
                  <option>Claim Approved (Hindi)</option>
                  <option>Claim Rejected (Hindi)</option>
                  <option>Additional Evidence Required (Hindi)</option>
                  <option>Weather Advisory (Hindi)</option>
                </select>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-600 bg-slate-50 px-3 py-2 rounded-md">
                <span className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />
                  Recipients
                </span>
                <span className="font-medium">1 farmer selected</span>
              </div>

              <button className="w-full bg-[#166534] hover:bg-[#14532d] text-white text-sm font-medium py-2.5 rounded-md transition-colors flex items-center justify-center gap-2">
                <Send className="w-4 h-4" />
                Send Notification
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Government Footer */}
      <footer className="bg-white border-t border-slate-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-2 text-xs text-slate-500">
            <span>
              AgriSense AI — PMFBY Digital Claim Settlement Platform
            </span>
            <span className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <Database className="w-3 h-3" />
                Database Connected
              </span>
              <span>Version 1.0.0</span>
              <span>© Government of India</span>
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* Stat Card Component */
function StatCard({
  title,
  value,
  subtext,
  icon,
  color,
}: {
  title: string;
  value: string;
  subtext: string;
  icon: React.ReactNode;
  color: "green" | "blue" | "amber" | "slate";
}) {
  const colorClasses = {
    green: "bg-green-50 text-green-700 border-green-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    slate: "bg-slate-100 text-slate-700 border-slate-200",
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
            {title}
          </p>
          <p className="text-xl font-bold text-slate-900 mt-1">{value}</p>
          <p className="text-xs text-slate-500 mt-0.5">{subtext}</p>
        </div>
        <div
          className={`p-2 rounded-md border ${colorClasses[color]}`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

/* Rules Tab */
function RulesTab() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">
          Parametric Rules Configuration
        </h2>
        <button className="text-xs bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-3 py-1.5 rounded-md font-medium transition-colors">
          Add New Rule
        </button>
      </div>

      <div className="space-y-3">
        {MOCK_RULES.map((rule) => (
          <div
            key={rule.id}
            className="border border-slate-200 rounded-lg p-5 bg-white hover:border-slate-300 transition-colors"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  {rule.name}
                </h3>
                <span
                  className={`inline-flex items-center gap-1 text-xs mt-1 px-2 py-0.5 rounded-full border ${
                    rule.status === "active"
                      ? "bg-green-50 text-green-700 border-green-200"
                      : "bg-slate-100 text-slate-600 border-slate-200"
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      rule.status === "active" ? "bg-green-500" : "bg-slate-400"
                    }`}
                  />
                  Active
                </span>
              </div>
              <button className="text-xs text-green-700 hover:text-green-800 font-medium border border-green-200 hover:bg-green-50 px-3 py-1.5 rounded-md transition-colors">
                Edit Rule
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-xs text-slate-500 mb-1">Trigger Condition</p>
                <p className="text-slate-900 font-medium">{rule.trigger}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Payout Structure</p>
                <p className="text-slate-900">{rule.payout}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">Applicable Season</p>
                <p className="text-slate-900">{rule.season}</p>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-4 text-xs">
              <span className="text-slate-500">
                Last triggered:{" "}
                <span className="text-slate-700 font-medium">
                  {rule.lastTriggered}
                </span>
              </span>
              <button className="text-slate-500 hover:text-slate-700 underline">
                View trigger history
              </button>
              <button className="text-red-600 hover:text-red-700">
                Disable rule
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* Payouts Tab */
function PayoutsTab() {
  return (
    <div className="text-center py-12 text-slate-500">
      <IndianRupee className="w-8 h-8 mx-auto mb-3 text-slate-300" />
      <p className="text-sm">Payout monitoring interface</p>
      <p className="text-xs mt-1">Select a batch to view PFMS transaction details</p>
    </div>
  );
}

/* Fraud Tab */
function FraudTab() {
  return (
    <div className="text-center py-12 text-slate-500">
      <Shield className="w-8 h-8 mx-auto mb-3 text-slate-300" />
      <p className="text-sm">No active fraud alerts</p>
      <p className="text-xs mt-1">Last scan: Today, 10:30 AM</p>
    </div>
  );
}

/* Reconciliation Tab */
function ReconciliationTab() {
  return (
    <div className="text-center py-12 text-slate-500">
      <FileText className="w-8 h-8 mx-auto mb-3 text-slate-300" />
      <p className="text-sm">Bank reconciliation pending</p>
      <p className="text-xs mt-1">Last reconciled: Yesterday, 06:00 PM</p>
    </div>
  );
}

/* Audit Tab */
function AuditTab() {
  return (
    <div className="text-center py-12 text-slate-500">
      <AlertTriangle className="w-8 h-8 mx-auto mb-3 text-slate-300" />
      <p className="text-sm">Audit trail available for all processed claims</p>
      <p className="text-xs mt-1">SHA-256 hash chain integrity: Verified</p>
    </div>
  );
}
