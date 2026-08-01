"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { QueryClient, QueryClientProvider, useQuery, useMutation } from "@tanstack/react-query";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import * as THREE from "three";
import { ShieldAlert, CheckCircle, RefreshCw, Send, Users, AlertCircle, FileText, ChevronRight } from "lucide-react";
import Payout3D from "@/components/payments/Payout3D";

const queryClient = new QueryClient();

// Subcomponent: 3D Fraud Network Node
function FraudNode({
  position,
  label,
  riskColor,
  onHover
}: {
  position: [number, number, number];
  label: string;
  riskColor: string;
  onHover: (info: any) => void;
}) {
  return (
    <group position={position}>
      <mesh
        onPointerOver={(e) => {
          e.stopPropagation();
          onHover({ label, riskColor, visible: true, x: e.clientX, y: e.clientY });
        }}
        onPointerOut={() => onHover({ visible: false })}
      >
        <sphereGeometry args={[0.3, 16, 16]} />
        <meshStandardMaterial color={riskColor} emissive={riskColor} emissiveIntensity={0.6} />
      </mesh>
      <Html position={[0, -0.4, 0]} center>
        <div className="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-800/90 text-[7px] text-slate-700 font-bold uppercase whitespace-nowrap pointer-events-none">
          {label}
        </div>
      </Html>
    </group>
  );
}

// Subcomponent: 3D Connection line between nodes
function FraudConnection({ start, end }: { start: [number, number, number]; end: [number, number, number] }) {
  const points = useMemo(() => [new THREE.Vector3(...start), new THREE.Vector3(...end)], [start, end]);
  const lineGeometry = useMemo(() => new THREE.BufferGeometry().setFromPoints(points), [points]);

  return (
    <line geometry={lineGeometry}>
      <lineBasicMaterial color="#ef4444" opacity={0.6} transparent linewidth={2} />
    </line>
  );
}

// Subcomponent: R3F Fraud Graph canvas
function FraudNetworkGraph() {
  const [hoverNode, setHoverNode] = useState<any>({ visible: false });
  
  const nodes = [
    { pos: [0, 0, 0] as [number, number, number], label: "Ramesh Patel (Farm #1)", color: "#ef4444" },
    { pos: [-2, 1.5, -1] as [number, number, number], label: "Suresh Kumar (Farm #2)", color: "#fbbf24" },
    { pos: [2, 1, 1.5] as [number, number, number], label: "Rajesh Singh (Farm #3)", color: "#34d399" },
    { pos: [-1.5, -1.8, 1] as [number, number, number], label: "Bank Account #4219 (Shared)", color: "#ef4444" },
    { pos: [2.5, -1.2, -1.5] as [number, number, number], label: "Co-op Agent ID #88", color: "#fbbf24" }
  ];

  const connections = [
    { start: nodes[0].pos, end: nodes[3].pos },
    { start: nodes[1].pos, end: nodes[3].pos },
    { start: nodes[0].pos, end: nodes[4].pos },
    { start: nodes[1].pos, end: nodes[4].pos },
    { start: nodes[2].pos, end: nodes[4].pos }
  ];

  return (
    <div className="relative w-full h-[220px] bg-white border border-slate-200 text-slate-800 rounded-xl overflow-hidden border border-slate-100">
      <Canvas camera={{ position: [0, 0, 6], fov: 45 } as any}>
        <ambientLight intensity={0.7} />
        <directionalLight position={[2, 5, 2]} />
        
        {connections.map((c, idx) => (
          <FraudConnection key={`conn-${idx}`} start={c.start} end={c.end} />
        ))}
        {nodes.map((n, idx) => (
          <FraudNode key={`node-${idx}`} position={n.pos} label={n.label} riskColor={n.color} onHover={setHoverNode} />
        ))}
        
        <OrbitControls enableDamping maxDistance={10} minDistance={3} />
      </Canvas>

      {hoverNode.visible && (
        <div
          className="absolute z-20 pointer-events-none p-2 rounded bg-white border border-slate-200 text-slate-800 border border-slate-200 text-[9px] text-slate-800 flex flex-col gap-0.5"
          style={{ left: `${hoverNode.x - 140}px`, top: `${hoverNode.y - 480}px` }}
        >
          <span className="font-bold text-slate-700">{hoverNode.label}</span>
          <span className="text-red-400">Shared entity relationship link</span>
        </div>
      )}
    </div>
  );
}

function OfficialDashboardContent() {
  const [activeTab, setActiveTab] = useState<"rules" | "payouts" | "fraud" | "reconciliation">("rules");
  const [activePaymentRecord, setActivePaymentRecord] = useState<any>(null);

  // Fetch active insurance rules
  const { data: rules = [], refetch: refetchRules } = useQuery({
    queryKey: ["insurance_rules"],
    queryFn: async () => {
      try {
        const res = await fetch("http://localhost:8000/api/v1/insurance/rules");
        return await res.json();
      } catch {
        // mock rules fallback
        return [
          { name: "NDVI Drop Payout", condition: "ndvi_drop_percent > 40", payout_type: "percentage_of_sum_insured", payout_value: 0.5, max_payout: 100000.0, active: true },
          { name: "Flood Index Payout", condition: "flood_index > 0.8", payout_type: "fixed_per_hectare", payout_value: 15000.0, max_payout: 200000.0, active: true },
          { name: "Rainfall Deficit", condition: "rainfall_anomaly < -60", payout_type: "tiered", payout_value: 0.25, max_payout: 150000.0, active: false }
        ];
      }
    }
  });

  // Fetch daily payouts reconciliation
  const { data: recon = null, refetch: refetchRecon } = useQuery({
    queryKey: ["reconciliation_data"],
    queryFn: async () => {
      try {
        const res = await fetch("http://localhost:8000/api/v1/payments/reconciliation");
        return await res.json();
      } catch {
        return {
          status: "RECONCILED",
          total_settled_amount: 147000.0,
          completed_transactions: [
            { payment_id: "PAY-178495-1", claim_id: 1, amount: 72000.0, beneficiary: "Ramesh Patel", status: "COMPLETED", payment_mode: "NEFT" },
            { payment_id: "PAY-178495-2", claim_id: 2, amount: 75000.0, beneficiary: "Suresh Kumar", status: "COMPLETED", payment_mode: "UPI" }
          ],
          failed_transactions: []
        };
      }
    }
  });

  // Select first payment record by default for 3D view
  useEffect(() => {
    if (recon?.completed_transactions?.length > 0 && !activePaymentRecord) {
      setActivePaymentRecord(recon.completed_transactions[0]);
    }
  }, [recon, activePaymentRecord]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 p-6 font-sans">
      
      {/* Header */}
      <header className="mb-6 flex justify-between items-center border-b border-slate-200 pb-4"><div className="flex items-center gap-3"><a href="/dashboard/farmer" className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-slate-600">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
              </a><div>
        <div>
          <h1 className="text-xl font-bold text-slate-800 tracking-wide">AgriSense AI Insurer & Settlement Hub</h1>
          <p className="text-[10px] text-slate-500 mt-0.5">Configure rules, verify DBT payouts, monitor transaction hashes, and review fraud network charts.</p>
        </div>
      </div></div></header>

      {/* Tabs selectors */}
      <div className="flex gap-2 border-b border-slate-100 pb-4 mb-6">
        <button
          onClick={() => setActiveTab("rules")}
          className={`py-1.5 px-4 rounded text-xs font-bold uppercase tracking-wider transition ${
            activeTab === "rules" ? "bg-[#166534] text-white shadow" : "bg-slate-100 border border-slate-200 text-slate-600 text-slate-500 hover:bg-white/10"
          }`}
        >
          Rules configuration
        </button>
        <button
          onClick={() => setActiveTab("payouts")}
          className={`py-1.5 px-4 rounded text-xs font-bold uppercase tracking-wider transition ${
            activeTab === "payouts" ? "bg-[#166534] text-white shadow" : "bg-slate-100 border border-slate-200 text-slate-600 text-slate-500 hover:bg-white/10"
          }`}
        >
          Payout Monitor
        </button>
        <button
          onClick={() => setActiveTab("fraud")}
          className={`py-1.5 px-4 rounded text-xs font-bold uppercase tracking-wider transition ${
            activeTab === "fraud" ? "bg-[#166534] text-white shadow" : "bg-slate-100 border border-slate-200 text-slate-600 text-slate-500 hover:bg-white/10"
          }`}
        >
          Fraud Alerts
        </button>
        <button
          onClick={() => setActiveTab("reconciliation")}
          className={`py-1.5 px-4 rounded text-xs font-bold uppercase tracking-wider transition ${
            activeTab === "reconciliation" ? "bg-[#166534] text-white shadow" : "bg-slate-100 border border-slate-200 text-slate-600 text-slate-500 hover:bg-white/10"
          }`}
        >
          Ledger Matcher
        </button>
      </div>

      {/* Main tab switch content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Columns Content */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          
          {activeTab === "rules" && (
            <div className="bg-white border border-slate-200 shadow-sm text-slate-800 border border-slate-200 p-5 rounded-2xl flex flex-col gap-4">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Declarative Rule Engine</h3>
              
              <div className="flex flex-col gap-4">
                {rules.map((rule: any, idx: number) => (
                  <div key={idx} className="p-4 rounded-xl border border-slate-100 bg-white border border-slate-200 text-slate-800 flex justify-between items-center">
                    <div>
                      <h4 className="text-xs font-bold text-slate-200">{rule.name}</h4>
                      <p className="text-[10px] text-slate-500 mt-1">Condition: <code className="bg-white border border-slate-200 text-slate-800 px-1 py-0.5 rounded text-yellow-500">{rule.condition}</code></p>
                      <p className="text-[9px] text-slate-500 mt-0.5">Type: {rule.payout_type} | Val: {rule.payout_value}</p>
                    </div>
                    
                    <div className="flex gap-3 items-center">
                      <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase ${
                        rule.active !== false ? "bg-[#166534]/10 text-[#166534] border border-emerald-500/20" : "bg-slate-800 text-slate-500"
                      }`}>
                        {rule.active !== false ? "Active" : "Disabled"}
                      </span>
                      <button className="py-1 px-3 rounded bg-slate-100 border border-slate-200 text-slate-600 hover:bg-white/10 text-[9px] text-slate-700 transition">
                        Configure
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "payouts" && activePaymentRecord && (
            <Payout3D
              amount={activePaymentRecord.amount}
              farmerName={activePaymentRecord.beneficiary}
              status={activePaymentRecord.status}
            />
          )}

          {activeTab === "fraud" && (
            <div className="bg-white border border-slate-200 shadow-sm text-slate-800 border border-slate-200 p-5 rounded-2xl flex flex-col gap-4">
              <div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Syndicated Fraud Risk Network</h3>
                <p className="text-[10px] text-slate-500 mt-1">AI monitors matching bank codes, shared Aadhaar credentials, and clustered geographic claiming.</p>
              </div>
              
              <FraudNetworkGraph />
              
              {/* Alert list */}
              <div className="flex flex-col gap-3 mt-2">
                <div className="p-3.5 rounded-lg border border-red-500/20 bg-red-500/5 text-xs flex gap-2.5 items-start">
                  <ShieldAlert className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="font-bold text-red-400 block mb-0.5">High Risk Cluster Flagged (#AL-889)</span>
                    <p className="text-[10px] text-slate-500 leading-relaxed">
                      Farmers Ramesh Patel and Suresh Kumar linked to the same crop insurance bank agent code and registered survey bounds. Fraud risk rating: 88%.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "reconciliation" && (
            <div className="bg-white border border-slate-200 shadow-sm text-slate-800 border border-slate-200 p-5 rounded-2xl flex flex-col gap-4">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Daily Bank Reconciliation</h3>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 text-[10px] uppercase">
                      <th className="py-2">Tx ID</th>
                      <th className="py-2">Farmer</th>
                      <th className="py-2">Amount</th>
                      <th className="py-2">Method</th>
                      <th className="py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recon?.completed_transactions?.map((t: any, idx: number) => (
                      <tr key={idx} className="border-b border-slate-100 text-slate-700">
                        <td className="py-2.5 font-mono text-[10px]">{t.payment_id}</td>
                        <td className="py-2.5">{t.beneficiary}</td>
                        <td className="py-2.5 font-bold text-[#166534]">₹{t.amount.toLocaleString("en-IN")}</td>
                        <td className="py-2.5 uppercase text-[9px]">{t.payment_mode}</td>
                        <td className="py-2.5">
                          <span className="px-1.5 py-0.5 rounded text-[8px] bg-[#166534]/10 text-[#166534] border border-emerald-500/20 font-bold uppercase">
                            Reconciled
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>

        {/* Right Sidebar (1 Column) */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          
          {/* Quick Stats Ticker */}
          <div className="bg-white border border-slate-200 shadow-sm text-slate-800 border border-slate-200 p-5 rounded-2xl shadow-xl flex flex-col gap-4">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Total settled stats</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-lg border border-slate-100 bg-white border border-slate-200 text-slate-800">
                <span className="text-[8px] text-slate-500 uppercase block mb-0.5">Total Settled</span>
                <span className="font-extrabold text-slate-800 text-sm">₹{(recon?.total_settled_amount ?? 147000).toLocaleString("en-IN")}</span>
              </div>
              
              <div className="p-3 rounded-lg border border-slate-100 bg-white border border-slate-200 text-slate-800">
                <span className="text-[8px] text-slate-500 uppercase block mb-0.5">Success Rate</span>
                <span className="font-extrabold text-[#166534] text-sm">99.8%</span>
              </div>
            </div>

            {/* Real-time ticker list */}
            <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
              <span className="text-[9px] text-slate-500 uppercase tracking-wider">Live Transaction Feed</span>
              {recon?.completed_transactions?.map((t: any, idx: number) => (
                <div
                  key={idx}
                  onClick={() => setActivePaymentRecord(t)}
                  className={`p-2.5 rounded-lg border text-[10px] flex justify-between items-center cursor-pointer transition ${
                    activePaymentRecord?.payment_id === t.payment_id ? "bg-[#166534]/10 border-emerald-500/30" : "bg-white border border-slate-200 text-slate-800 border-slate-100 hover:border-white/15"
                  }`}
                >
                  <div>
                    <span className="font-semibold text-slate-800">{t.beneficiary}</span>
                    <span className="text-[8px] text-slate-500 block mt-0.5">ID: {t.payment_id}</span>
                  </div>
                  <span className="font-bold text-[#166534]">₹{t.amount.toLocaleString("en-IN")}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Farmer notification broadcast */}
          <div className="bg-white border border-slate-200 shadow-sm text-slate-800 border border-slate-200 p-5 rounded-2xl shadow-xl flex flex-col gap-3">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Users className="w-4 h-4 text-[#166534]" />
              Farmer SMS Broadcast
            </span>
            <p className="text-[10px] text-slate-500 leading-normal">
              Broadcast claim details and payout confirmations directly to farmers via WhatsApp and SMS alerts.
            </p>
            <div className="flex flex-col gap-2">
              <textarea
                placeholder="Enter SMS notification template..."
                className="w-full bg-white border border-slate-200 text-slate-800 border border-slate-200 rounded-lg p-2 text-xs text-slate-800 placeholder-slate-600 focus:outline-none focus:border-emerald-500 h-16 resize-none"
                defaultValue="Confirming crop payout ₹{amount} processed for your farm. Reference: {payment_id}."
              />
              <button className="w-full flex items-center justify-center gap-2 bg-[#22c55e] hover:bg-[#166534] text-white font-bold py-1.5 px-4 rounded-lg text-xs transition cursor-pointer">
                <Send className="w-3.5 h-3.5" /> Broadcast Alerts
              </button>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}

export default function Page() {
  return (
    <QueryClientProvider client={queryClient}>
      <OfficialDashboardContent />
    </QueryClientProvider>
  );
}
