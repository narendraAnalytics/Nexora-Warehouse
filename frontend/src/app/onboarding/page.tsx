"use client";

import { useUser } from "@clerk/nextjs";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

const LOGO_URL =
  "https://res.cloudinary.com/dkqbzwicr/image/upload/q_auto/f_auto/v1781526126/logoImage_nonxua.png";

export default function OnboardingPage() {
  const { user, isLoaded, isSignedIn } = useUser();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) { router.push("/"); return; }
    if (user?.username) router.push("/");
  }, [isLoaded, isSignedIn, user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = username.trim();
    if (trimmed.length < 3) {
      setError("Username must be at least 3 characters");
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
      setError("Only letters, numbers, and underscores allowed");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await user?.update({ username: trimmed });
      router.push("/");
    } catch (err: unknown) {
      const clerkErr = err as { errors?: { message: string }[] };
      setError(
        clerkErr?.errors?.[0]?.message ||
        "Username already taken or invalid. Try another."
      );
      setLoading(false);
    }
  };

  if (!isLoaded || !isSignedIn) return null;

  return (
    <>
      <style>{`
        .ob-bg {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(128deg, #FF7840 0%, #E03898 30%, #8B2EE0 62%, #12C0D0 100%);
          font-family: 'Plus Jakarta Sans', sans-serif;
          padding: 24px;
        }
        .ob-card {
          background: rgba(255,255,255,0.14);
          backdrop-filter: blur(32px) saturate(1.6);
          border: 1px solid rgba(255,255,255,0.30);
          border-radius: 28px;
          padding: 44px 40px;
          width: 100%;
          max-width: 420px;
          box-shadow: 0 16px 64px rgba(0,0,0,0.22), inset 0 1.5px 0 rgba(255,255,255,0.36);
          text-align: center;
        }
        .ob-input {
          width: 100%;
          padding: 13px 18px;
          border-radius: 14px;
          border: 1.5px solid rgba(255,255,255,0.30);
          background: rgba(255,255,255,0.10);
          color: #fff;
          font-size: 15px;
          font-family: inherit;
          outline: none;
          transition: border-color 0.2s;
          box-sizing: border-box;
        }
        .ob-input::placeholder { color: rgba(255,255,255,0.40); }
        .ob-input:focus { border-color: #3EE8C2; }
        .ob-btn {
          width: 100%;
          padding: 14px;
          border-radius: 50px;
          border: none;
          background: linear-gradient(130deg, #3EE8C2, #18D8C3 50%, #A855F7);
          color: #fff;
          font-size: 15.5px;
          font-weight: 700;
          font-family: inherit;
          cursor: pointer;
          box-shadow: 0 6px 28px rgba(62,232,194,0.50);
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .ob-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 36px rgba(62,232,194,0.65); }
        .ob-btn:disabled { opacity: 0.6; cursor: not-allowed; }
      `}</style>

      <div className="ob-bg">
        <div className="ob-card">
          {/* Logo */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "20px" }}>
            <Image
              src={LOGO_URL}
              alt="Nexora Warehouse"
              width={52}
              height={52}
              style={{ borderRadius: "13px", background: "rgba(240,240,240,0.94)" }}
            />
          </div>

          <h1
            style={{
              color: "#fff",
              fontSize: "24px",
              fontWeight: 800,
              letterSpacing: "-0.5px",
              marginBottom: "8px",
            }}
          >
            Pick your username
          </h1>
          <p
            style={{
              color: "rgba(255,255,255,0.68)",
              fontSize: "14px",
              marginBottom: "28px",
              lineHeight: 1.6,
            }}
          >
            This is how you&apos;ll appear across Nexora Warehouse.
            <br />
            You can&apos;t change it later.
          </p>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <input
              className="ob-input"
              type="text"
              placeholder="e.g. narendra_wh"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setError("");
              }}
              maxLength={32}
              autoFocus
              autoComplete="off"
            />

            {error && (
              <p
                style={{
                  color: "#FF7A59",
                  fontSize: "13px",
                  margin: "0",
                  textAlign: "left",
                }}
              >
                {error}
              </p>
            )}

            <button className="ob-btn" type="submit" disabled={loading}>
              {loading ? "Saving…" : "Continue →"}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
