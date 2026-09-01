"use client";

import React, { useState, useRef } from "react";

interface HoloCardProps {
  title?: string;
  className?: string;
  children: React.ReactNode;
  flippable?: boolean;
  backContent?: React.ReactNode;
}

export const HoloCard: React.FC<HoloCardProps> = ({
  title,
  className = "",
  children,
  flippable = false,
  backContent,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isFlipped, setIsFlipped] = useState(false);
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);
  const [glowX, setGlowX] = useState(50);
  const [glowY, setGlowY] = useState(50);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Calculate tilt angles (max 10 degrees)
    const xc = rect.width / 2;
    const yc = rect.height / 2;
    setRotateY((x - xc) / (rect.width / 10));
    setRotateX((yc - y) / (rect.height / 10));
    
    // Map glow center percentage
    setGlowX((x / rect.width) * 100);
    setGlowY((y / rect.height) * 100);
  };

  const handleMouseLeave = () => {
    setRotateX(0);
    setRotateY(0);
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={() => flippable && setIsFlipped(!isFlipped)}
      style={{
        perspective: "1000px",
        transform: `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`,
        transition: "transform 0.15s ease-out, border-color 0.3s ease, box-shadow 0.3s ease",
      }}
      className={`relative rounded-2xl border border-white/10 bg-slate-900/60 p-6 backdrop-blur-xl shadow-2xl hover:shadow-emerald-500/10 hover:border-emerald-500/30 cursor-pointer overflow-hidden ${className}`}
    >
      {/* Background radial gradient tracker */}
      <div
        className="absolute inset-0 pointer-events-none transition-opacity duration-300"
        style={{
          background: `radial-gradient(circle 200px at ${glowX}% ${glowY}%, rgba(16, 185, 129, 0.15), transparent)`,
        }}
      />
      
      <div className={`transition-all duration-300 ${isFlipped ? "opacity-0 pointer-events-none scale-95" : "opacity-100"}`}>
        {title && <h3 className="mb-4 text-lg font-semibold tracking-wider text-emerald-400">{title}</h3>}
        {children}
      </div>

      {flippable && backContent && (
        <div className={`absolute inset-0 p-6 flex flex-col justify-between transition-all duration-300 rounded-2xl bg-slate-950/90 border border-emerald-500/40 ${isFlipped ? "opacity-100 scale-100" : "opacity-0 pointer-events-none scale-95"}`}>
          {backContent}
        </div>
      )}
    </div>
  );
};
