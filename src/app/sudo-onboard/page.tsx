"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import "./login.css";

export default function SudoOnboard() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("IDLE");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setStatus("VERIFYING");

    try {
      const response = await fetch("/api/auth/gate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const result = await response.json();

      if (!response.ok) {
        setStatus("ERROR");
        // Handle specific lockout message if needed
        if (response.status === 403) {
          alert("SECURITY_LOCKDOWN: Too many failed attempts. Try again in 1 hour.");
        }
        setIsLoading(false);
        setTimeout(() => setStatus("IDLE"), 3000);
      } else {
        setStatus("SUCCESS");
        setTimeout(() => router.push("/admin/dashboard"), 1000);
      }
    } catch (err) {
      setStatus("ERROR");
      setIsLoading(false);
    }
  };

  return (
    <main className="login-page animate-fade">
      <div className="login-card">
        <header className="login-header">
          <h1>Identity Verification</h1>
          <p>Personnel access only. Secure session required.</p>
        </header>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div className="input-group">
            <label htmlFor="email">Administrative Email</label>
            <input 
              id="email"
              type="email" 
              className="input-field"
              placeholder="admin@arundprasad.online"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
              required
            />
          </div>

          <div className="input-group">
            <label htmlFor="password">Security Passphrase</label>
            <input 
              id="password"
              type="password" 
              className="input-field"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          
          <button 
            type="submit" 
            className="login-btn"
            disabled={isLoading}
          >
            {isLoading ? "Verifying..." : "Access Control Center"}
          </button>
        </form>
        
        {status === "ERROR" && (
          <div className="text-center text-red-500 text-sm font-semibold animate-pulse">
            Invalid credentials. Access denied.
          </div>
        )}

        {status === "SUCCESS" && (
          <div className="text-center text-green-500 text-sm font-semibold">
            Identity verified. Synchronizing...
          </div>
        )}

        <footer className="login-footer">
          System v2.5.0 • Cryptographic Auth Active
        </footer>
      </div>
    </main>
  );
}
