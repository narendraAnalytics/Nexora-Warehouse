"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useUser, SignInButton, UserButton } from "@clerk/nextjs";

const LOGO_URL =
  "https://res.cloudinary.com/dkqbzwicr/image/upload/q_auto/f_auto/v1781526126/logoImage_nonxua.png";
const HERO_IMG_URL =
  "https://res.cloudinary.com/dkqbzwicr/image/upload/q_auto/f_auto/v1781538183/logoImage_epnuo8.png";

const NAV_LINKS = ["Home", "Features", "Solutions", "Pricing", "About Us", "Contact"];

const STATS = [
  { icon: "📦", val: 25, suffix: "K+", label: "Products\nStored",      cls: "si1" },
  { icon: "📈", val: 98, suffix: "%",  label: "Order\nAccuracy",        cls: "si2" },
  { icon: "👥", val: 10, suffix: "",   label: "Happy\nClients",         cls: "si3" },
  { icon: "🕒", val: 0,  suffix: "",   label: "Non-Stop\nOperations",   cls: "si4", text: "24/7" },
];

const FEAT_CARDS = [
  { icon: "📦", label: "Inventory\nManagement", cls: "fi1" },
  { icon: "📈", label: "Real-Time\nTracking",   cls: "fi2" },
  { icon: "🛡️", label: "Secure\nOperations",   cls: "fi3" },
  { icon: "⚡",  label: "Faster\nFulfillment",  cls: "fi4" },
];

const PARTICLE_COLORS = [
  "rgba(255,79,163,0.62)", "rgba(62,232,194,0.62)",
  "rgba(168,85,247,0.62)", "rgba(255,122,89,0.62)",
  "rgba(255,255,255,0.48)", "rgba(217,70,239,0.58)",
];

function getFeatIconStyle(cls: string): React.CSSProperties {
  const map: Record<string, React.CSSProperties> = {
    fi1: { background: "linear-gradient(135deg,rgba(255,79,163,0.36),rgba(255,122,89,0.36))",  boxShadow: "0 4px 18px rgba(255,79,163,0.38)"  },
    fi2: { background: "linear-gradient(135deg,rgba(62,232,194,0.36),rgba(24,216,195,0.36))",  boxShadow: "0 4px 18px rgba(62,232,194,0.38)"  },
    fi3: { background: "linear-gradient(135deg,rgba(168,85,247,0.36),rgba(217,70,239,0.36))",  boxShadow: "0 4px 18px rgba(168,85,247,0.38)"  },
    fi4: { background: "linear-gradient(135deg,rgba(255,179,106,0.40),rgba(255,122,89,0.36))", boxShadow: "0 4px 18px rgba(255,179,106,0.38)" },
  };
  return map[cls] ?? {};
}

function getStatIconStyle(cls: string): React.CSSProperties {
  const map: Record<string, React.CSSProperties> = {
    si1: { background: "linear-gradient(135deg,rgba(255,79,163,0.40),rgba(255,122,89,0.40))",  boxShadow: "0 4px 16px rgba(255,79,163,0.38)"  },
    si2: { background: "linear-gradient(135deg,rgba(62,232,194,0.40),rgba(24,216,195,0.40))",  boxShadow: "0 4px 16px rgba(62,232,194,0.38)"  },
    si3: { background: "linear-gradient(135deg,rgba(168,85,247,0.40),rgba(217,70,239,0.40))",  boxShadow: "0 4px 16px rgba(168,85,247,0.38)"  },
    si4: { background: "linear-gradient(135deg,rgba(255,179,106,0.40),rgba(255,122,89,0.40))", boxShadow: "0 4px 16px rgba(255,179,106,0.38)" },
  };
  return map[cls] ?? {};
}

export default function HeroPage() {
  const { user, isSignedIn, isLoaded } = useUser();
  const [menuOpen, setMenuOpen] = useState(false);
  const [counts, setCounts] = useState([0, 0, 0, 0]);
  const hwRef = useRef<HTMLDivElement>(null);

  /* spawn floating particles */
  useEffect(() => {
    const wrap = hwRef.current;
    if (!wrap) return;
    const particles: HTMLDivElement[] = [];
    for (let i = 0; i < 22; i++) {
      const el = document.createElement("div");
      el.className = "pt";
      const sz  = (Math.random() * 10 + 3).toFixed(1);
      const clr = PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)];
      const dur = (Math.random() * 13 + 7).toFixed(2);
      const del = (Math.random() * 8).toFixed(2);
      el.style.cssText = `
        width:${sz}px;height:${sz}px;background:${clr};
        left:${(Math.random() * 98).toFixed(1)}%;
        top:${(Math.random() * 95).toFixed(1)}%;
        animation-duration:${dur}s;
        animation-delay:-${del}s;
        box-shadow:0 0 ${parseFloat(sz) * 2.5}px ${clr};
      `;
      wrap.appendChild(el);
      particles.push(el);
    }
    return () => particles.forEach((p) => p.remove());
  }, []);

  /* animated counters */
  useEffect(() => {
    const timer = setTimeout(() => {
      STATS.forEach((stat, idx) => {
        if ("text" in stat) return;
        let cur = 0;
        const target = stat.val;
        const step = Math.max(1, Math.ceil(target / 45));
        const iv = setInterval(() => {
          cur = Math.min(cur + step, target);
          setCounts((prev) => {
            const next = [...prev];
            next[idx] = cur;
            return next;
          });
          if (cur >= target) clearInterval(iv);
        }, 28);
      });
    }, 400);
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      {/* ── MOBILE OVERLAY ── */}
      <div
        className={`fixed inset-0 z-[9000] flex flex-col items-center justify-center gap-[26px]
          transition-opacity duration-[280ms]
          ${menuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        style={{ background: "rgba(90,12,172,0.97)", backdropFilter: "blur(30px)" }}
        onClick={(e) => { if (e.target === e.currentTarget) setMenuOpen(false); }}
      >
        <button
          className="absolute top-[22px] right-[22px] w-11 h-11 flex items-center justify-center
            rounded-xl text-white text-xl cursor-pointer border-none"
          style={{ background: "rgba(255,255,255,0.18)", border: "1px solid rgba(255,255,255,0.28)" }}
          onClick={() => setMenuOpen(false)}
        >
          ✕
        </button>
        {NAV_LINKS.map((link) => (
          <a
            key={link}
            href="#"
            className="text-[rgba(255,255,255,0.88)] no-underline text-2xl font-bold
              hover:text-white transition-colors duration-200"
          >
            {link}
          </a>
        ))}
        {isSignedIn ? (
          <a
            href="#"
            className="no-underline font-bold text-base text-white rounded-[50px] px-11 py-[13px]"
            style={{ background: "linear-gradient(130deg,#3EE8C2,#18D8C3 55%,#A855F7)" }}
          >
            Get Started →
          </a>
        ) : (
          <SignInButton mode="modal" forceRedirectUrl="/">
            <a
              className="no-underline font-bold text-base text-white rounded-[50px] px-11 py-[13px] cursor-pointer"
              style={{ background: "linear-gradient(130deg,#3EE8C2,#18D8C3 55%,#A855F7)" }}
            >
              Get Started →
            </a>
          </SignInButton>
        )}
      </div>

      {/* ── HERO WRAPPER ── */}
      <div className="hw" ref={hwRef}>
        {/* blobs */}
        <div className="blob b1" />
        <div className="blob b2" />
        <div className="blob b3" />
        <div className="blob b4" />
        <div className="blob b5" />

        {/* ── NAVBAR ── */}
        <nav
          className="relative z-[100] flex justify-center"
          style={{ padding: "18px 28px" }}
        >
          <div
            className="flex items-center justify-between w-full max-w-[1360px] rounded-[80px]"
            style={{
              background: "rgba(255,255,255,0.13)",
              backdropFilter: "blur(32px) saturate(1.6)",
              WebkitBackdropFilter: "blur(32px) saturate(1.6)",
              border: "1px solid rgba(255,255,255,0.32)",
              padding: "8px 10px 8px 14px",
              boxShadow:
                "0 8px 44px rgba(0,0,0,0.13), inset 0 1.5px 0 rgba(255,255,255,0.38), 0 0 0 1px rgba(255,255,255,0.07)",
            }}
          >
            {/* Logo */}
            <a href="#" className="flex items-center gap-[9px] no-underline shrink-0">
              <Image
                src={LOGO_URL}
                alt="Nexora Warehouse"
                width={44}
                height={44}
                className="rounded-[11px] object-contain"
                style={{ background: "rgba(240,240,240,0.94)" }}
              />
              <div
                className="text-[rgba(255,255,255,0.96)] font-extrabold leading-[1.15]"
                style={{ fontSize: "15px", letterSpacing: "-0.2px" }}
              >
                Nexora
                <span
                  className="block font-medium uppercase opacity-70"
                  style={{ fontSize: "9.5px", letterSpacing: "0.9px" }}
                >
                  Warehouse
                </span>
              </div>
            </a>

            {/* Desktop nav links */}
            <ul className="hidden md:flex items-center gap-0.5 list-none m-0 p-0">
              {NAV_LINKS.map((link, i) => (
                <li key={link}>
                  <a
                    href="#"
                    className="block rounded-[40px] whitespace-nowrap no-underline font-medium
                      transition-[background,color] duration-200"
                    style={{
                      padding: "7px 13px",
                      color: i === 0 ? "#fff" : "rgba(255,255,255,0.84)",
                      fontSize: "13.5px",
                      background: i === 0 ? "rgba(255,255,255,0.18)" : "transparent",
                    }}
                  >
                    {link}
                  </a>
                </li>
              ))}
            </ul>

            {/* Actions */}
            <div className="flex items-center gap-[9px] shrink-0">
              {/* Auth area */}
              {isLoaded && (
                isSignedIn ? (
                  <div className="hidden md:flex items-center gap-[10px]">
                    <span
                      className="font-semibold text-[rgba(255,255,255,0.88)] whitespace-nowrap"
                      style={{ fontSize: "13px" }}
                    >
                      Welcome, {user?.username || user?.firstName || "User"}
                    </span>
                    <UserButton
                      appearance={{
                        elements: {
                          avatarBox: "w-9 h-9 rounded-full ring-2 ring-[#3EE8C2]/40",
                        },
                      }}
                    />
                  </div>
                ) : (
                  <SignInButton mode="modal" forceRedirectUrl="/">
                    <a
                      className="hidden md:inline-flex items-center gap-1.5 rounded-[40px]
                        text-[rgba(255,255,255,0.90)] font-semibold no-underline cursor-pointer
                        transition-[background,transform] duration-[220ms]
                        hover:bg-[rgba(255,255,255,0.22)] hover:text-white hover:-translate-y-px"
                      style={{
                        padding: "9px 20px",
                        background: "rgba(255,255,255,0.14)",
                        border: "1px solid rgba(255,255,255,0.30)",
                        fontSize: "13px",
                      }}
                    >
                      <svg
                        width="13" height="13" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                      >
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                      Login
                    </a>
                  </SignInButton>
                )
              )}

              {/* Hamburger */}
              <button
                className="md:hidden flex items-center justify-center w-10 h-10 rounded-[11px]
                  text-white cursor-pointer border-none bg-transparent"
                style={{
                  background: "rgba(255,255,255,0.16)",
                  border: "1px solid rgba(255,255,255,0.28)",
                }}
                onClick={() => setMenuOpen(true)}
                aria-label="Open menu"
              >
                <svg width="18" height="14" viewBox="0 0 18 14" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="0" y1="1" x2="18" y2="1" />
                  <line x1="0" y1="7" x2="18" y2="7" />
                  <line x1="0" y1="13" x2="18" y2="13" />
                </svg>
              </button>
            </div>
          </div>
        </nav>

        {/* ── HERO GRID ── */}
        <section
          className="hero-grid relative z-10 grid items-center max-w-[1420px] mx-auto gap-0"
          style={{
            gridTemplateColumns: "44% 56%",
            padding: "30px 52px 48px 52px",
          }}
        >
          {/* ── LEFT COLUMN ── */}
          <div
            className="hero-l-anim flex flex-col"
            style={{ paddingRight: "36px", paddingTop: "6px" }}
          >
            {/* Badge */}
            <div
              className="inline-flex items-center gap-[9px] rounded-[50px]
                text-[rgba(255,255,255,0.96)] font-semibold whitespace-nowrap mb-7 w-fit"
              style={{
                padding: "7px 18px",
                fontSize: "12.5px",
                background: "rgba(255,255,255,0.16)",
                backdropFilter: "blur(14px)",
                border: "1px solid rgba(255,255,255,0.32)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.32), 0 4px 20px rgba(0,0,0,0.12)",
              }}
            >
              <div
                className="badge-dot w-[7px] h-[7px] rounded-full shrink-0"
                style={{
                  background: "var(--nex-mint)",
                  boxShadow: "0 0 9px var(--nex-mint), 0 0 18px rgba(62,232,194,0.50)",
                }}
              />
              ✨ Smart Warehouse. Smarter Business.
            </div>

            {/* H1 */}
            <h1
              className="font-extrabold leading-[1.04] text-[rgba(255,255,255,0.97)] mb-5"
              style={{
                fontSize: "clamp(40px, 4vw, 70px)",
                letterSpacing: "-2.5px",
              }}
            >
              <span className="block">
                Manage <span className="gw-warm">Smarter.</span>
              </span>
              <span className="block">
                Store <span className="gw-warm">Better.</span>
              </span>
              <span className="block">
                Deliver <span className="gw-teal">Faster.</span>
              </span>
            </h1>

            {/* Subtitle */}
            <p
              className="leading-[1.78] text-[rgba(255,255,255,0.76)] mb-[34px] font-normal"
              style={{ fontSize: "15.5px", maxWidth: "430px" }}
            >
              Nexora Warehouse helps businesses streamline inventory, optimize warehouse
              operations, automate workflows, and gain real-time visibility across their
              entire supply chain.
            </p>

            {/* CTA Row */}
            <div className="flex items-center gap-[14px] mb-[46px] flex-wrap">
              {isSignedIn ? (
                <a
                  href="#"
                  className="inline-flex items-center gap-2 rounded-[50px] text-white font-bold
                    no-underline relative overflow-hidden cursor-pointer
                    transition-all duration-300
                    hover:-translate-y-[3px] hover:scale-[1.04]"
                  style={{
                    padding: "14px 34px",
                    fontSize: "15.5px",
                    background: "linear-gradient(130deg,#3EE8C2,#18D8C3 50%,#A855F7)",
                    boxShadow: "0 6px 32px rgba(62,232,194,0.56), 0 2px 12px rgba(0,0,0,0.10)",
                  }}
                >
                  Get Started &nbsp;→
                </a>
              ) : (
                <SignInButton mode="modal" forceRedirectUrl="/">
                  <a
                    className="inline-flex items-center gap-2 rounded-[50px] text-white font-bold
                      no-underline relative overflow-hidden cursor-pointer
                      transition-all duration-300
                      hover:-translate-y-[3px] hover:scale-[1.04]"
                    style={{
                      padding: "14px 34px",
                      fontSize: "15.5px",
                      background: "linear-gradient(130deg,#3EE8C2,#18D8C3 50%,#A855F7)",
                      boxShadow: "0 6px 32px rgba(62,232,194,0.56), 0 2px 12px rgba(0,0,0,0.10)",
                    }}
                  >
                    Get Started &nbsp;→
                  </a>
                </SignInButton>
              )}
              <a
                href="#"
                className="inline-flex items-center gap-[11px] rounded-[50px]
                  text-[rgba(255,255,255,0.93)] font-semibold no-underline cursor-pointer
                  transition-all duration-[240ms] ease-out
                  hover:bg-[rgba(255,255,255,0.22)] hover:-translate-y-0.5"
                style={{
                  padding: "12px 26px",
                  fontSize: "14.5px",
                  background: "rgba(255,255,255,0.14)",
                  backdropFilter: "blur(14px)",
                  border: "1.5px solid rgba(255,255,255,0.36)",
                }}
              >
                <span
                  className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                  style={{
                    background: "linear-gradient(135deg,#FF4FA3,#FF7A59)",
                    boxShadow: "0 4px 14px rgba(255,79,163,0.52)",
                  }}
                >
                  <svg width="9" height="11" viewBox="0 0 9 11" fill="white">
                    <path d="M0 0L9 5.5L0 11V0Z" />
                  </svg>
                </span>
                Watch Demo
              </a>
            </div>

            {/* Feature Cards */}
            <div className="grid grid-cols-4 gap-[8px]">
              {FEAT_CARDS.map((card, idx) => (
                <div
                  key={card.label}
                  className="flex flex-col items-center gap-2 rounded-[16px] text-center cursor-pointer
                    transition-[transform,box-shadow] duration-[320ms]
                    hover:-translate-y-[9px] hover:scale-[1.04]"
                  style={{
                    padding: "10px 8px 9px",
                    background: "rgba(255,255,255,0.12)",
                    backdropFilter: "blur(20px)",
                    border: "1px solid rgba(255,255,255,0.24)",
                    boxShadow: "0 4px 22px rgba(0,0,0,0.08), inset 0 1.5px 0 rgba(255,255,255,0.30)",
                    animation: `cardFloat 4s ease-in-out infinite ${idx * 0.4}s`,
                  }}
                >
                  <div
                    className="w-9 h-9 rounded-[11px] flex items-center justify-center text-[17px]"
                    style={getFeatIconStyle(card.cls)}
                  >
                    {card.icon}
                  </div>
                  <div
                    className="font-bold text-[rgba(255,255,255,0.92)] leading-[1.35]"
                    style={{ fontSize: "11px" }}
                  >
                    {card.label.split("\n").map((line, i) => (
                      <span key={i}>{i > 0 && <br />}{line}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── RIGHT COLUMN ── */}
          <div className="hero-r-anim flex flex-col items-center">
            {/* Image wrapper */}
            <div className="img-float relative w-full" style={{ maxWidth: "740px" }}>
              {/* Ambient glow */}
              <div
                className="absolute pointer-events-none z-[1]"
                style={{
                  top: "50%", left: "50%",
                  transform: "translate(-50%,-52%)",
                  width: "90%", height: "80%",
                  background:
                    "radial-gradient(ellipse, rgba(217,70,239,0.55) 0%, rgba(168,85,247,0.42) 30%, rgba(255,79,163,0.22) 58%, transparent 78%)",
                  filter: "blur(55px)",
                }}
              />
              <Image
                src={HERO_IMG_URL}
                alt="Nexora Warehouse Illustration"
                width={740}
                height={560}
                className="warehouse-img"
                priority
              />
              <div className="orb o1" />
              <div className="orb o2" />
              <div className="orb o3" />
              <div className="orb o4" />
              <div className="orb o5" />
              <div className="orb o6" />
            </div>

            {/* Stats Card */}
            <div
              className="stats-anim w-full relative z-[12] grid grid-cols-4 gap-0 rounded-[26px]"
              style={{
                maxWidth: "648px",
                padding: "12px 16px",
                marginTop: "-28px",
                background: "rgba(255,255,255,0.16)",
                backdropFilter: "blur(30px) saturate(1.5)",
                WebkitBackdropFilter: "blur(30px) saturate(1.5)",
                border: "1px solid rgba(255,255,255,0.32)",
                boxShadow: "0 10px 52px rgba(0,0,0,0.14), inset 0 1.5px 0 rgba(255,255,255,0.34)",
              }}
            >
              {STATS.map((stat, idx) => (
                <div
                  key={idx}
                  className="flex flex-col items-center gap-[4px] p-1.5 relative text-center"
                >
                  {idx > 0 && (
                    <div
                      className="absolute left-0 top-[10%] bottom-[10%] w-px"
                      style={{ background: "rgba(255,255,255,0.22)" }}
                    />
                  )}
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-[14px] mb-0.5"
                    style={getStatIconStyle(stat.cls)}
                  >
                    {stat.icon}
                  </div>
                  <div
                    className="num-pop font-extrabold text-white leading-none"
                    style={{
                      fontSize: "17px",
                      letterSpacing: "-0.5px",
                      animationDelay: `${0.7 + idx * 0.15}s`,
                    }}
                  >
                    {"text" in stat
                      ? stat.text
                      : stat.cls === "si3"
                        ? (counts[idx] >= 10 ? "1K+" : "0K+")
                        : counts[idx] + stat.suffix}
                  </div>
                  <div
                    className="text-[rgba(255,255,255,0.70)] font-medium leading-[1.35]"
                    style={{ fontSize: "10px" }}
                  >
                    {stat.label.split("\n").map((line, i) => (
                      <span key={i}>{i > 0 && <br />}{line}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
