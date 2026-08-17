"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, Delete } from "lucide-react";

export default function AdminLockScreen() {
  const [pin, setPin] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);

  const router = useRouter();

  const handlePinSubmit = async (currentPin: string) => {
    setLoading(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/admin-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: currentPin }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        router.push("/admin");
        router.refresh();
      } else {
        const msg = data.message || "Incorrect PIN — try again";
        setShake(true);
        setErrorMsg(msg);
        setTimeout(() => {
          setPin("");
          setShake(false);
        }, 700);
      }
    } catch {
      setErrorMsg("Network error — check your connection");
      setShake(true);
      setTimeout(() => {
        setPin("");
        setShake(false);
      }, 700);
    } finally {
      setLoading(false);
    }
  };

  const handleDigit = (digit: string) => {
    if (loading || pin.length >= 4) return;
    const newPin = pin + digit;
    setPin(newPin);
    if (newPin.length === 4) handlePinSubmit(newPin);
  };

  const handleDelete = () => {
    if (loading) return;
    setPin((p) => p.slice(0, -1));
    setErrorMsg("");
  };

  return (
    <div className="min-h-dvh bg-zinc-950 flex flex-col items-center justify-center p-6 select-none">
      {/* Shield icon — distinguishes admin lock from gallery lock */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        className="mb-8"
      >
        <div className="w-20 h-20 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
          <ShieldCheck className="w-9 h-9 text-amber-400/70" />
        </div>
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="text-white text-2xl font-semibold mb-1"
      >
        Admin Access
      </motion.h1>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15 }}
        className={`text-sm mb-12 transition-colors ${errorMsg ? "text-red-400" : "text-white/30"}`}
      >
        {errorMsg || "Enter your 4-digit admin PIN"}
      </motion.p>

      {/* PIN dots */}
      <motion.div
        className="flex gap-5 mb-12"
        animate={shake ? { x: [-12, 12, -8, 8, -4, 4, 0] } : {}}
        transition={{ duration: 0.5 }}
      >
        {[0, 1, 2, 3].map((i) => (
          <motion.div
            key={i}
            animate={{
              scale: pin.length > i ? 1.15 : 1,
              backgroundColor: errorMsg
                ? "rgb(239 68 68)"
                : pin.length > i
                  ? "rgb(251 191 36)"
                  : "transparent",
              borderColor: errorMsg
                ? "rgb(239 68 68)"
                : pin.length > i
                  ? "rgb(251 191 36)"
                  : "rgba(255,255,255,0.15)",
            }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
            className="w-4 h-4 rounded-full border-2"
          />
        ))}
      </motion.div>

      {/* Keypad */}
      <div className="grid grid-cols-3 gap-4 w-full max-w-[280px]">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
          <motion.button
            key={digit}
            whileTap={{ scale: 0.88, backgroundColor: "rgba(251,191,36,0.1)" }}
            onClick={() => handleDigit(digit.toString())}
            disabled={loading}
            className="h-[72px] rounded-full bg-white/5 border border-white/5 text-white text-2xl font-light transition-colors hover:bg-white/10 disabled:opacity-50"
          >
            {digit}
          </motion.button>
        ))}
        <div />
        <motion.button
          whileTap={{ scale: 0.88, backgroundColor: "rgba(251,191,36,0.1)" }}
          onClick={() => handleDigit("0")}
          disabled={loading}
          className="h-[72px] rounded-full bg-white/5 border border-white/5 text-white text-2xl font-light transition-colors hover:bg-white/10 disabled:opacity-50"
        >
          0
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.88 }}
          onClick={handleDelete}
          disabled={loading || pin.length === 0}
          className="h-[72px] rounded-full flex items-center justify-center text-white/50 hover:text-white transition-colors disabled:opacity-20"
        >
          <Delete className="w-6 h-6" />
        </motion.button>
      </div>

      {/* Loading indicator */}
      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-8"
          >
            <div className="w-5 h-5 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Back to gallery link */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        onClick={() => router.push("/gallery")}
        className="mt-10 text-white/20 hover:text-white/40 text-sm transition-colors"
      >
        ← Back to Gallery
      </motion.button>
    </div>
  );
}
