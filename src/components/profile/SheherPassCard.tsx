"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, Sparkles, Zap, Bell, Check, CreditCard, Lock, X, TicketPercent } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";

interface SheherPassCardProps {
  onSuccess?: () => void;
}

export const SheherPassCard: React.FC<SheherPassCardProps> = ({ onSuccess }) => {
  const { user, refreshUser } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<"form" | "success">("form");
  const [cardNumber, setCardNumber] = useState("4000 1234 5678 9010");
  const [cardExpiry, setCardExpiry] = useState("12/29");
  const [cardCvv, setCardCvv] = useState("999");
  const [cardHolder, setCardHolder] = useState(user?.fullName || "SHERLOCK EXPLORER");

  const isPremium = user?.isPremiumPass;

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Process mock payment verification delay
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const res = await fetch("/api/auth/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        throw new Error("Unable to activate subscription.");
      }

      await refreshUser();
      setStep("success");
      if (onSuccess) onSuccess();
    } catch (err) {
      alert("Payment failed: unable to connect to billing. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* PASS CONTAINER CARD */}
      <div className="relative overflow-hidden rounded-2xl border border-amber-400/30 bg-gradient-to-br from-amber-500/10 via-yellow-400/5 to-amber-600/10 p-6 shadow-xl backdrop-blur-md">
        <div className="absolute -right-16 -top-16 h-32 w-32 rounded-full bg-amber-400/20 blur-3xl" />
        <div className="absolute -left-16 -bottom-16 h-32 w-32 rounded-full bg-yellow-400/20 blur-3xl" />

        <div className="relative space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 rounded-full bg-amber-400/10 px-3 py-1 text-xs font-black text-amber-300 border border-amber-500/20">
              <Sparkles size={13} className="animate-spin-slow" />
              <span>SHEHER EXPLORER PASS</span>
            </div>
            {isPremium && (
              <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-black text-emerald-400 border border-emerald-500/30 uppercase tracking-wider">
                Active Member
              </span>
            )}
          </div>

          <div className="space-y-1">
            <h2 className="text-xl font-black text-[var(--foreground)]">Unlock the Pulse of the City</h2>
            <p className="text-xs text-[var(--muted-strong)] font-semibold leading-relaxed">
              A paid explorer membership for private deals, premium airport perks, and better weekend/event discovery.
            </p>
          </div>

          {/* Benefits List */}
          <ul className="space-y-2.5 text-xs text-[var(--muted)] font-semibold">
            <li className="flex items-center gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-400/10 text-amber-300">
                <Bell size={11} />
              </span>
              <span>Instant alerts for high-value flash coupons near you</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-400/10 text-amber-300">
                <TicketPercent size={11} />
              </span>
              <span>Premium airport lounge, spa, and food coupon unlocks</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-400/10 text-amber-300">
                <Zap size={11} />
              </span>
              <span>Priority event picks and curated weekend plans</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-400/10 text-amber-300">
                <Shield size={11} />
              </span>
              <span>Premium member badge for future partner redemptions</span>
            </li>
          </ul>

          <div className="pt-2">
            {isPremium ? (
              <div className="text-center py-2.5 rounded-lg border border-emerald-500/20 bg-emerald-500/5 text-xs font-black text-emerald-300">
                ✓ Subscriber Benefits Enabled
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setStep("form");
                  setIsModalOpen(true);
                }}
                className="w-full cursor-pointer rounded-lg bg-amber-400 px-4 py-3 text-center text-xs font-black text-slate-950 hover:bg-amber-300 transition duration-150 shadow hover:shadow-amber-400/10"
              >
                Get Sheher Pass for ₹199 / Month
              </button>
            )}
          </div>
        </div>
      </div>

      {/* CHECKOUT MODAL POPUP */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-6 shadow-2xl text-left"
            >
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="absolute right-4 top-4 text-[var(--muted)] hover:text-[var(--foreground)] cursor-pointer"
              >
                <X size={18} />
              </button>

              {step === "form" ? (
                <form onSubmit={handleSubscribe} className="space-y-5">
                  <div className="space-y-1">
                    <h3 className="text-lg font-black text-[var(--foreground)]">Complete Subscription</h3>
                    <p className="text-xs text-[var(--muted-strong)] font-semibold">
                      Unlock Sheher Pass alerts instantly. Refundable anytime.
                    </p>
                  </div>

                  {/* Credit Card Graphic mockup */}
                  <div className="relative h-44 rounded-xl bg-gradient-to-br from-amber-400 via-yellow-500 to-amber-600 p-4 text-slate-950 flex flex-col justify-between shadow-lg">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-900/80">Sheher Explorer</span>
                        <div className="text-base font-black tracking-widest">{cardNumber}</div>
                      </div>
                      <CreditCard size={28} className="text-slate-950/80" />
                    </div>

                    <div className="flex justify-between items-end">
                      <div>
                        <span className="text-[8px] font-bold uppercase text-slate-900/75 block">Card Holder</span>
                        <span className="text-xs font-black uppercase tracking-wide">{cardHolder}</span>
                      </div>
                      <div className="flex gap-4">
                        <div>
                          <span className="text-[8px] font-bold uppercase text-slate-900/75 block">Expiry</span>
                          <span className="text-xs font-black tracking-wide">{cardExpiry}</span>
                        </div>
                        <div>
                          <span className="text-[8px] font-bold uppercase text-slate-900/75 block">CVV</span>
                          <span className="text-xs font-black tracking-wide">{cardCvv}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card input fields */}
                  <div className="space-y-3.5 text-left">
                    <div>
                      <label className="text-[10px] font-black uppercase text-[var(--muted-strong)] block mb-1.5">Card Number</label>
                      <input
                        type="text"
                        value={cardNumber}
                        onChange={(e) => setCardNumber(e.target.value)}
                        required
                        className="h-10 w-full rounded border border-[var(--border)] bg-[var(--input)] px-3 text-xs font-semibold outline-none focus:border-amber-400 text-[var(--foreground)]"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-black uppercase text-[var(--muted-strong)] block mb-1.5">Expiry Date</label>
                        <input
                          type="text"
                          value={cardExpiry}
                          onChange={(e) => setCardExpiry(e.target.value)}
                          placeholder="MM/YY"
                          required
                          className="h-10 w-full rounded border border-[var(--border)] bg-[var(--input)] px-3 text-xs font-semibold outline-none focus:border-amber-400 text-[var(--foreground)]"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase text-[var(--muted-strong)] block mb-1.5">Security Code (CVV)</label>
                        <input
                          type="password"
                          value={cardCvv}
                          onChange={(e) => setCardCvv(e.target.value)}
                          maxLength={4}
                          required
                          className="h-10 w-full rounded border border-[var(--border)] bg-[var(--input)] px-3 text-xs font-semibold outline-none focus:border-amber-400 text-[var(--foreground)]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-black uppercase text-[var(--muted-strong)] block mb-1.5">Card Holder Name</label>
                      <input
                        type="text"
                        value={cardHolder}
                        onChange={(e) => setCardHolder(e.target.value)}
                        required
                        className="h-10 w-full rounded border border-[var(--border)] bg-[var(--input)] px-3 text-xs font-semibold outline-none focus:border-amber-400 text-[var(--foreground)]"
                      />
                    </div>
                  </div>

                  <div className="border-t border-[var(--border)] pt-4 space-y-3.5">
                    <div className="flex items-center justify-between text-xs font-bold text-[var(--muted-strong)]">
                      <span className="flex items-center gap-1.5">
                        <Lock size={12} className="text-emerald-400" />
                        <span>Secured 256-bit payment gateway</span>
                      </span>
                      <span className="text-[var(--foreground)] font-black">₹199.00 / mo</span>
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full flex items-center justify-center h-12 bg-amber-400 text-slate-950 font-black rounded-lg text-xs hover:bg-amber-300 transition duration-150 cursor-pointer disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <div className="flex items-center gap-2">
                          <svg className="animate-spin h-4 w-4 text-slate-950" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          <span>Verifying Payment...</span>
                        </div>
                      ) : (
                        <span>Activate Explorer Pass (₹199/mo)</span>
                      )}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="text-center py-6 space-y-4">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    <Check size={28} />
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="text-lg font-black text-emerald-400">Welcome to Sheher Premium!</h3>
                    <p className="text-xs text-[var(--muted-strong)] font-semibold leading-relaxed">
                      Your Explorer Pass is now active. You will receive instant notifications for real-time 50% discount flash deals nearby.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="w-full h-10 bg-slate-800 text-white font-bold rounded-lg text-xs hover:bg-slate-700 transition cursor-pointer"
                  >
                    Start Exploring
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
