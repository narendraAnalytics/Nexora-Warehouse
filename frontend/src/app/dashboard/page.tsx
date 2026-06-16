"use client";

import { useUser, UserButton } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

const LOGO_URL =
  "https://res.cloudinary.com/dkqbzwicr/image/upload/q_auto/f_auto/v1781526126/logoImage_nonxua.png";

const KPI_CARDS = [
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" stroke="#3EE8C2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" stroke="#3EE8C2" strokeWidth="2"/>
        <line x1="12" y1="22.08" x2="12" y2="12" stroke="#3EE8C2" strokeWidth="2"/>
      </svg>
    ),
    label: "Total Inventory",
    value: "24,891",
    unit: "units",
    change: "+3.2%",
    up: true,
    grad: "from-[#3EE8C2]/20 to-[#18D8C3]/10",
    border: "border-[#3EE8C2]/20",
    glow: "rgba(62,232,194,0.15)",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" stroke="#A855F7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    label: "Pending Orders",
    value: "142",
    unit: "orders",
    change: "+12",
    up: false,
    grad: "from-[#A855F7]/20 to-[#7C3AED]/10",
    border: "border-[#A855F7]/20",
    glow: "rgba(168,85,247,0.15)",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <line x1="12" y1="1" x2="12" y2="23" stroke="#FF4FA3" strokeWidth="2" strokeLinecap="round"/>
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" stroke="#FF4FA3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    label: "Revenue (MTD)",
    value: "₹48.6L",
    unit: "this month",
    change: "+8.4%",
    up: true,
    grad: "from-[#FF4FA3]/20 to-[#FF7A59]/10",
    border: "border-[#FF4FA3]/20",
    glow: "rgba(255,79,163,0.15)",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="3" width="7" height="7" rx="1" stroke="#FFB36A" strokeWidth="2"/>
        <rect x="14" y="3" width="7" height="7" rx="1" stroke="#FFB36A" strokeWidth="2"/>
        <rect x="3" y="14" width="7" height="7" rx="1" stroke="#FFB36A" strokeWidth="2"/>
        <rect x="14" y="14" width="7" height="7" rx="1" stroke="#FFB36A" strokeWidth="2"/>
      </svg>
    ),
    label: "Active Warehouses",
    value: "5",
    unit: "branches",
    change: "All Online",
    up: true,
    grad: "from-[#FFB36A]/20 to-[#FF7A59]/10",
    border: "border-[#FFB36A]/20",
    glow: "rgba(255,179,106,0.15)",
  },
];

const BRANCHES = [
  { city: "Hyderabad", status: "Online", stock: "8,241", orders: 38, color: "#FF6B35" },
  { city: "Bangalore", status: "Online", stock: "5,102", orders: 31, color: "#3EE8C2" },
  { city: "Chennai",   status: "Online", stock: "4,488", orders: 27, color: "#A855F7" },
  { city: "Mumbai",    status: "Online", stock: "4,190", orders: 29, color: "#EC4899" },
  { city: "Pune",      status: "Online", stock: "2,870", orders: 17, color: "#FF4FA3" },
];

export default function DashboardPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();

  const displayName = user?.username || user?.firstName || "CEO";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";

  return (
    <div
      className="min-h-screen"
      style={{
        background: "linear-gradient(135deg, #0f0a1e 0%, #130d2a 40%, #0d1a2e 100%)",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}
    >
      {/* ── NAVBAR ── */}
      <nav
        className="sticky top-0 z-50 flex items-center justify-between"
        style={{
          padding: "14px 32px",
          background: "rgba(15,10,30,0.85)",
          backdropFilter: "blur(24px)",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        {/* Back + Logo */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-2 rounded-xl font-semibold transition-all duration-200 hover:-translate-y-px"
            style={{
              padding: "8px 16px",
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.15)",
              color: "rgba(255,255,255,0.80)",
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back to Home
          </button>

          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={LOGO_URL} alt="Nexora" width={36} height={36} className="rounded-lg object-contain" style={{ background: "rgba(240,240,240,0.94)" }} />
            <div>
              <div className="font-extrabold text-white" style={{ fontSize: "15px", letterSpacing: "-0.2px" }}>Nexora</div>
              <div className="font-medium uppercase opacity-60 text-white" style={{ fontSize: "9px", letterSpacing: "1px" }}>Warehouse</div>
            </div>
          </div>
        </div>

        {/* User area */}
        {isLoaded && (
          <div className="flex items-center gap-3">
            <div
              className="flex items-center gap-2 rounded-xl"
              style={{ padding: "6px 14px", background: "rgba(62,232,194,0.10)", border: "1px solid rgba(62,232,194,0.20)" }}
            >
              <div className="w-2 h-2 rounded-full" style={{ background: "#3EE8C2", boxShadow: "0 0 8px #3EE8C2" }} />
              <span className="font-semibold" style={{ fontSize: "12px", color: "#3EE8C2" }}>CEO</span>
            </div>
            <span className="font-semibold text-white" style={{ fontSize: "13px", opacity: 0.85 }}>{displayName}</span>
            <UserButton appearance={{ elements: { avatarBox: "w-9 h-9 rounded-full ring-2 ring-[#3EE8C2]/30" } }} />
          </div>
        )}
      </nav>

      {/* ── MAIN CONTENT ── */}
      <main style={{ padding: "32px 32px 48px", maxWidth: "1360px", margin: "0 auto" }}>

        {/* Greeting */}
        <div className="mb-8">
          <h1
            className="font-extrabold text-white mb-1"
            style={{ fontSize: "clamp(24px,3vw,36px)", letterSpacing: "-1px" }}
          >
            {greeting},{" "}
            <span
              style={{
                background: "linear-gradient(90deg, #3EE8C2, #18D8C3 50%, #A855F7)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              {displayName}
            </span>{" "}
            👋
          </h1>
          <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.50)", fontWeight: 500 }}>
            Here&apos;s a snapshot of your 5-branch warehouse network across India.
          </p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-4 mb-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px,1fr))" }}>
          {KPI_CARDS.map((card) => (
            <div
              key={card.label}
              className="rounded-2xl relative overflow-hidden transition-transform duration-300 hover:-translate-y-1"
              style={{
                padding: "20px 22px",
                background: `linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)`,
                border: `1px solid rgba(255,255,255,0.10)`,
                boxShadow: `0 8px 32px ${card.glow}`,
              }}
            >
              <div className="flex items-start justify-between mb-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: `radial-gradient(circle, ${card.glow} 0%, transparent 70%)`, border: `1px solid rgba(255,255,255,0.08)` }}
                >
                  {card.icon}
                </div>
                <span
                  className="text-xs font-bold rounded-full px-2 py-0.5"
                  style={{
                    background: card.up ? "rgba(22,163,74,0.18)" : "rgba(239,68,68,0.18)",
                    color: card.up ? "#4ade80" : "#f87171",
                  }}
                >
                  {card.change}
                </span>
              </div>
              <div className="font-extrabold text-white mb-0.5" style={{ fontSize: "26px", letterSpacing: "-1px" }}>
                {card.value}
              </div>
              <div className="font-semibold" style={{ fontSize: "12px", color: "rgba(255,255,255,0.45)" }}>
                {card.label}
                <span className="ml-1 opacity-70">{card.unit}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Branch Status Table */}
        <div
          className="rounded-2xl mb-6"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            overflow: "hidden",
          }}
        >
          <div
            className="flex items-center justify-between"
            style={{ padding: "16px 22px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
          >
            <h2 className="font-bold text-white" style={{ fontSize: "15px" }}>Branch Overview</h2>
            <span className="text-xs font-semibold" style={{ color: "#3EE8C2" }}>5 branches · All Online</span>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  {["Branch", "Status", "Stock Units", "Pending Orders", "Utilisation"].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "10px 22px",
                        textAlign: "left",
                        fontSize: "11px",
                        fontWeight: 700,
                        color: "rgba(255,255,255,0.35)",
                        letterSpacing: "0.5px",
                        textTransform: "uppercase",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {BRANCHES.map((b, i) => (
                  <tr
                    key={b.city}
                    style={{
                      borderBottom: i < BRANCHES.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={{ padding: "13px 22px" }}>
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: b.color, boxShadow: `0 0 8px ${b.color}` }} />
                        <span className="font-semibold text-white" style={{ fontSize: "13px" }}>{b.city}</span>
                      </div>
                    </td>
                    <td style={{ padding: "13px 22px" }}>
                      <span
                        className="font-bold rounded-full px-2.5 py-0.5"
                        style={{ fontSize: "11px", background: "rgba(22,163,74,0.15)", color: "#4ade80" }}
                      >
                        ● {b.status}
                      </span>
                    </td>
                    <td style={{ padding: "13px 22px", color: "rgba(255,255,255,0.75)", fontSize: "13px", fontWeight: 600 }}>
                      {b.stock}
                    </td>
                    <td style={{ padding: "13px 22px", color: "rgba(255,255,255,0.75)", fontSize: "13px", fontWeight: 600 }}>
                      {b.orders}
                    </td>
                    <td style={{ padding: "13px 22px" }}>
                      <div className="flex items-center gap-2">
                        <div
                          className="rounded-full overflow-hidden"
                          style={{ width: "80px", height: "6px", background: "rgba(255,255,255,0.10)" }}
                        >
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.floor(55 + Math.random() * 35)}%`,
                              background: `linear-gradient(90deg, ${b.color}, ${b.color}99)`,
                            }}
                          />
                        </div>
                        <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.45)", fontWeight: 600 }}>
                          {Math.floor(55 + i * 7)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Coming Soon banner */}
        <div
          className="rounded-2xl flex flex-col items-center justify-center text-center"
          style={{
            padding: "40px 32px",
            background: "linear-gradient(135deg, rgba(62,232,194,0.06) 0%, rgba(168,85,247,0.06) 100%)",
            border: "1px solid rgba(62,232,194,0.15)",
            boxShadow: "0 0 60px rgba(62,232,194,0.05)",
          }}
        >
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: "linear-gradient(135deg, rgba(62,232,194,0.2), rgba(168,85,247,0.2))" }}
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="#3EE8C2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 17l10 5 10-5" stroke="#A855F7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 12l10 5 10-5" stroke="#3EE8C2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h3 className="font-extrabold text-white mb-2" style={{ fontSize: "20px", letterSpacing: "-0.5px" }}>
            Full AI Dashboard — Coming in Phase 21
          </h3>
          <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.45)", maxWidth: "480px", lineHeight: 1.7 }}>
            CEO morning briefings · inventory agent · procurement AI · risk detection ·
            HITL approvals · and real-time analytics across all 5 branches — powered by LangGraph.
          </p>
          <div
            className="flex items-center gap-2 mt-4 rounded-full font-semibold"
            style={{
              padding: "8px 20px",
              background: "rgba(62,232,194,0.10)",
              border: "1px solid rgba(62,232,194,0.25)",
              color: "#3EE8C2",
              fontSize: "12.5px",
            }}
          >
            <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#3EE8C2" }} />
            Phase 21 in progress
          </div>
        </div>
      </main>
    </div>
  );
}
