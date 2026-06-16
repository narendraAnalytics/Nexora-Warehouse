"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import "./transition.css";

const PANORAMA_URL =
  "https://res.cloudinary.com/dkqbzwicr/image/upload/q_auto/f_auto/v1781588257/transitionbannerimage_xm62xf.png";

const STATUS_MSGS = [
  { delay: 0,    text: "Initializing systems…",        color: "#7C3AED" },
  { delay: 1200, text: "Loading inventory data…",      color: "#A855F7" },
  { delay: 2400, text: "Syncing warehouse locations…", color: "#EC4899" },
  { delay: 3500, text: "Preparing your dashboard…",    color: "#7C3AED" },
  { delay: 5200, text: "✓ Dashboard Ready!",           color: "#16a34a" },
];

const PIN_DATA = [
  { id: "pinHyd", delay: 1700 },
  { id: "pinBlr", delay: 2250 },
  { id: "pinChe", delay: 2800 },
  { id: "pinMum", delay: 3350 },
  { id: "pinPun", delay: 3900 },
];

const PARTICLE_COLORS = [
  "rgba(168,85,247,0.55)", "rgba(62,232,194,0.55)",
  "rgba(255,79,163,0.50)", "rgba(255,122,89,0.50)",
  "rgba(255,255,255,0.45)",
];

export default function TransitionPage() {
  const router = useRouter();
  const sceneRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const add = (fn: () => void, ms: number) => {
      timers.current.push(setTimeout(fn, ms));
    };

    // Status messages
    STATUS_MSGS.forEach(({ delay, text, color }) => {
      add(() => {
        const el = statusRef.current;
        if (!el) return;
        el.style.opacity = "0";
        add(() => {
          if (!el) return;
          el.textContent = text;
          el.style.color = color;
          el.style.opacity = "1";
        }, 250);
      }, delay + 1350);
    });

    // Floating data particles
    const scene = sceneRef.current;
    if (scene) {
      for (let i = 0; i < 14; i++) {
        const d = document.createElement("div");
        d.className = "data-particle";
        const sz  = (Math.random() * 8 + 3).toFixed(1);
        const c   = PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)];
        const dur = (Math.random() * 10 + 7).toFixed(2);
        const del = (Math.random() * 6).toFixed(2);
        d.style.cssText = `
          width:${sz}px; height:${sz}px; background:${c};
          left:${(Math.random() * 96).toFixed(1)}%;
          top:${(Math.random() * 80).toFixed(1)}%;
          animation-duration:${dur}s; animation-delay:-${del}s;
          box-shadow: 0 0 ${parseFloat(sz) * 2.2}px ${c};
          filter: blur(0.5px);
        `;
        scene.appendChild(d);
      }
    }

    // City pin sequence
    PIN_DATA.forEach(({ id, delay }) => {
      add(() => {
        document.getElementById(id)?.classList.add("visible");
      }, delay);
    });

    // Feature bar
    add(() => {
      document.getElementById("featBar")?.classList.add("show");
    }, 4400);

    // Success ring
    add(() => {
      document.getElementById("successRing")?.classList.add("active");
    }, 6200);

    // Flash
    add(() => {
      document.getElementById("flashOut")?.classList.add("go");
    }, 6600);

    // Navigate to dashboard
    add(() => {
      router.push("/dashboard");
    }, 7300);

    return () => timers.current.forEach(clearTimeout);
  }, [router]);

  return (
    <div className="page">
      {/* Ambient orbs */}
      <div className="ambient-orb ao1" />
      <div className="ambient-orb ao2" />
      <div className="ambient-orb ao3" />

      {/* Top section */}
      <div className="top">
        {/* Logo */}
        <div className="logo-block">
          <svg className="logo-svg" viewBox="0 0 100 92" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="lhg" x1="8" y1="4" x2="92" y2="88" gradientUnits="userSpaceOnUse">
                <stop offset="0%"   stopColor="#FF8C00"/>
                <stop offset="55%"  stopColor="#FFB700"/>
                <stop offset="100%" stopColor="#FFD700"/>
              </linearGradient>
              <linearGradient id="lng" x1="11" y1="36" x2="52" y2="82" gradientUnits="userSpaceOnUse">
                <stop offset="0%"   stopColor="#FF4FA3"/>
                <stop offset="44%"  stopColor="#3EE8C2"/>
                <stop offset="100%" stopColor="#7C3AED"/>
              </linearGradient>
            </defs>
            <path d="M50 4 L92 34 L92 88 L8 88 L8 34 Z" fill="white"/>
            <path d="M50 4 L92 34 L92 88 L8 88 L8 34 Z" fill="none" stroke="url(#lhg)" strokeWidth="4.5" strokeLinejoin="round"/>
            <rect x="11" y="36" width="10" height="46" rx="2" fill="url(#lng)"/>
            <polygon points="21,36 31,36 51,82 41,82" fill="url(#lng)"/>
            <rect x="42" y="36" width="10" height="46" rx="2" fill="url(#lng)"/>
            <rect x="56" y="36" width="2.5" height="46" rx="1.2" fill="#ddd"/>
            <rect x="87.5" y="36" width="2.5" height="46" rx="1.2" fill="#ddd"/>
            <rect x="57" y="37"  width="30" height="11" rx="3" fill="#FF6B35"/>
            <rect x="57" y="52"  width="30" height="11" rx="3" fill="#FFD700"/>
            <rect x="57" y="67"  width="30" height="11" rx="3" fill="#18D8C3"/>
          </svg>
          <div className="logo-name">NEXORA</div>
          <div className="logo-sub">Warehouse</div>
        </div>

        <h1 className="heading">
          Welcome to <span className="hl">Your Dashboard</span>
        </h1>
        <p className="sub-text">Powering Smarter Warehouse Operations Across India</p>

        {/* Progress bar */}
        <div className="prog-wrap">
          <div className="prog-track">
            <div className="prog-fill" />
          </div>
          <div className="prog-status" ref={statusRef} style={{ transition: "opacity 0.28s ease, color 0.28s ease" }}>
            Initializing systems…
          </div>
        </div>
      </div>

      {/* Scene */}
      <div className="scene" ref={sceneRef}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={PANORAMA_URL} className="scene-img" alt="Nexora India Journey" />
        <div className="scan-line" />
        <div className="portal-glow" />
        <div className="road-lines">
          <div className="road-dash" />
          <div className="road-dash" />
          <div className="road-dash" />
        </div>
        <div className="success-ring" id="successRing" />

        {/* Location Pins */}
        <div className="pins-layer">
          {/* Hyderabad */}
          <div className="loc-pin pin-hyd" id="pinHyd">
            <div className="pin-label">Hyderabad</div>
            <div className="pin-body">
              <svg viewBox="0 0 30 40" width="24" height="32" style={{ filter: "drop-shadow(0 3px 9px rgba(255,107,53,0.55))" }}>
                <path d="M15 0C6.716 0 0 6.716 0 15c0 9.7 15 25 15 25S30 24.7 30 15C30 6.716 23.284 0 15 0z" fill="#FF6B35"/>
                <circle cx="15" cy="14.5" r="7" fill="rgba(255,255,255,0.92)"/>
                <circle cx="15" cy="14.5" r="3.5" fill="#FF6B35"/>
              </svg>
            </div>
            <div className="pin-shadow" />
          </div>

          {/* Bangalore */}
          <div className="loc-pin pin-blr" id="pinBlr">
            <div className="pin-label">Bangalore</div>
            <div className="pin-body" style={{ animationDelay: "0.35s" }}>
              <svg viewBox="0 0 30 40" width="24" height="32" style={{ filter: "drop-shadow(0 3px 9px rgba(62,232,194,0.55))" }}>
                <path d="M15 0C6.716 0 0 6.716 0 15c0 9.7 15 25 15 25S30 24.7 30 15C30 6.716 23.284 0 15 0z" fill="#3EE8C2"/>
                <circle cx="15" cy="14.5" r="7" fill="rgba(255,255,255,0.92)"/>
                <circle cx="15" cy="14.5" r="3.5" fill="#3EE8C2"/>
              </svg>
            </div>
            <div className="pin-shadow" />
          </div>

          {/* Chennai */}
          <div className="loc-pin pin-che" id="pinChe">
            <div className="pin-label">Chennai</div>
            <div className="pin-body" style={{ animationDelay: "0.7s" }}>
              <svg viewBox="0 0 30 40" width="24" height="32" style={{ filter: "drop-shadow(0 3px 9px rgba(168,85,247,0.55))" }}>
                <path d="M15 0C6.716 0 0 6.716 0 15c0 9.7 15 25 15 25S30 24.7 30 15C30 6.716 23.284 0 15 0z" fill="#A855F7"/>
                <circle cx="15" cy="14.5" r="7" fill="rgba(255,255,255,0.92)"/>
                <circle cx="15" cy="14.5" r="3.5" fill="#A855F7"/>
              </svg>
            </div>
            <div className="pin-shadow" />
          </div>

          {/* Mumbai */}
          <div className="loc-pin pin-mum" id="pinMum">
            <div className="pin-label">Mumbai</div>
            <div className="pin-body" style={{ animationDelay: "1.05s" }}>
              <svg viewBox="0 0 30 40" width="24" height="32" style={{ filter: "drop-shadow(0 3px 9px rgba(236,72,153,0.55))" }}>
                <path d="M15 0C6.716 0 0 6.716 0 15c0 9.7 15 25 15 25S30 24.7 30 15C30 6.716 23.284 0 15 0z" fill="#EC4899"/>
                <circle cx="15" cy="14.5" r="7" fill="rgba(255,255,255,0.92)"/>
                <circle cx="15" cy="14.5" r="3.5" fill="#EC4899"/>
              </svg>
            </div>
            <div className="pin-shadow" />
          </div>

          {/* Pune */}
          <div className="loc-pin pin-pun" id="pinPun">
            <div className="pin-label">Pune</div>
            <div className="pin-body" style={{ animationDelay: "1.4s" }}>
              <svg viewBox="0 0 30 40" width="24" height="32" style={{ filter: "drop-shadow(0 3px 9px rgba(255,79,163,0.55))" }}>
                <path d="M15 0C6.716 0 0 6.716 0 15c0 9.7 15 25 15 25S30 24.7 30 15C30 6.716 23.284 0 15 0z" fill="#FF4FA3"/>
                <circle cx="15" cy="14.5" r="7" fill="rgba(255,255,255,0.92)"/>
                <circle cx="15" cy="14.5" r="3.5" fill="#FF4FA3"/>
              </svg>
            </div>
            <div className="pin-shadow" />
          </div>
        </div>

        {/* Feature bar */}
        <div className="feat-bar" id="featBar">
          <div className="feat-item">
            <div className="feat-icon-box fib-violet">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <polyline points="3.27 6.96 12 12.01 20.73 6.96" stroke="#7C3AED" strokeWidth="2"/>
                <line x1="12" y1="22.08" x2="12" y2="12" stroke="#7C3AED" strokeWidth="2"/>
              </svg>
            </div>
            <div className="feat-label">Multi-Warehouse<br/>Visibility</div>
          </div>

          <div className="feat-item">
            <div className="feat-icon-box fib-pink">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" stroke="#EC4899" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="feat-label">Real-time<br/>Insights</div>
          </div>

          <div className="feat-item">
            <div className="feat-icon-box fib-orange">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
                <rect x="1"  y="3" width="6" height="6" rx="1.2" stroke="#FF7A59" strokeWidth="1.8"/>
                <rect x="17" y="3" width="6" height="6" rx="1.2" stroke="#FF7A59" strokeWidth="1.8"/>
                <rect x="9"  y="15" width="6" height="6" rx="1.2" stroke="#FF7A59" strokeWidth="1.8"/>
                <path d="M4 9v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9" stroke="#FF7A59" strokeWidth="1.8"/>
                <line x1="12" y1="13" x2="12" y2="15" stroke="#FF7A59" strokeWidth="1.8"/>
              </svg>
            </div>
            <div className="feat-label">Intelligent Supply<br/>Chain</div>
          </div>

          <div className="feat-item">
            <div className="feat-icon-box fib-teal">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="#18D8C3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <polyline points="9 12 11 14 15 10" stroke="#18D8C3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="feat-label">Secure &amp;<br/>Reliable</div>
          </div>
        </div>
      </div>

      {/* White portal flash */}
      <div className="flash-out" id="flashOut" />
    </div>
  );
}
