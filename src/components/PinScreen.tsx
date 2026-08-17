"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Delete } from "lucide-react";

export default function PinScreen() {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const router = useRouter();

  const handlePinSubmit = async (currentPin: string) => {
    setError(false);
    setLoading(true);

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: currentPin }),
      });

      if (res.ok) {
        router.push("/");
      } else {
        setShake(true);
        setError(true);
        setTimeout(() => {
          setPin("");
          setShake(false);
          setError(false);
        }, 700);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleDigit = (digit: string) => {
    if (loading || pin.length >= 4) return;
    const newPin = pin + digit;
    setPin(newPin);
    if (newPin.length === 4) {
      // Auto-submit when 4 digits entered
      handlePinSubmit(newPin);
    }
  };

  const handleDelete = () => {
    if (loading) return;
    setPin((p) => p.slice(0, -1));
    setError(false);
  };

  const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9];

  return (
    <div className="min-h-dvh bg-black flex flex-col items-center justify-center p-6 select-none">
      {/* Lock icon */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        className="mb-8"
      >
        <div className="w-20 h-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
          <Lock className="w-8 h-8 text-white/40" />
        </div>
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="text-white text-2xl font-semibold mb-1"
      >
        Enter PIN
      </motion.h1>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15 }}
        className="text-white/30 text-sm mb-12"
      >
        {error ? "Incorrect PIN, try again" : "Enter your 4-digit PIN to continue"}
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
              backgroundColor: error
                ? "rgb(239 68 68)"
                : pin.length > i
                ? "rgb(255 255 255)"
                : "transparent",
              borderColor: error
                ? "rgb(239 68 68)"
                : pin.length > i
                ? "rgb(255 255 255)"
                : "rgba(255,255,255,0.2)",
            }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
            className="w-4 h-4 rounded-full border-2"
          />
        ))}
      </motion.div>

      {/* Keypad */}
      <div className="grid grid-cols-3 gap-4 w-full max-w-[280px]">
        {digits.map((digit) => (
          <motion.button
            key={digit}
            whileTap={{ scale: 0.88, backgroundColor: "rgba(255,255,255,0.15)" }}
            onClick={() => handleDigit(digit.toString())}
            disabled={loading}
            className="h-[72px] rounded-full bg-white/5 border border-white/5 text-white text-2xl font-light transition-colors hover:bg-white/10 active:bg-white/15 disabled:opacity-50"
          >
            {digit}
          </motion.button>
        ))}

        {/* Bottom row: empty | 0 | delete */}
        <div />
        <motion.button
          whileTap={{ scale: 0.88, backgroundColor: "rgba(255,255,255,0.15)" }}
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
            <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
