"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Send,
  Check,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Clock,
  Sparkles,
  Bell,
  ShieldCheck,
  Loader2,
  MessageCircle,
  Layers,
  Settings,
  Smartphone,
  Copy,
  Info,
} from "lucide-react";
import { fetchWithAuthClient } from "@/lib/api-client";

interface NotificationPreferences {
  whatsapp_phone_number: string | null;
  notification_channel: "whatsapp" | "telegram" | "both" | "in_app";
  preferred_briefing_time: string;
  telegram_connected: boolean;
  telegram_chat_id: string | null;
  whatsapp_connected: boolean;
}

interface NotificationChannelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export default function NotificationChannelModal({
  isOpen,
  onClose,
  onSaved,
}: NotificationChannelModalProps) {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<"whatsapp" | "telegram" | "settings">("whatsapp");

  const [prefs, setPrefs] = useState<NotificationPreferences>({
    whatsapp_phone_number: "",
    notification_channel: "both",
    preferred_briefing_time: "08:00",
    telegram_connected: false,
    telegram_chat_id: null,
    whatsapp_connected: false,
  });

  const [whatsappPhone, setWhatsappPhone] = useState("");
  const [channel, setChannel] = useState<"whatsapp" | "telegram" | "both" | "in_app">("both");
  const [briefingTime, setBriefingTime] = useState("08:00");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [testingWhatsapp, setTestingWhatsapp] = useState(false);
  const [testingTelegram, setTestingTelegram] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [manualTelegramChatId, setManualTelegramChatId] = useState("");

  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Prevent background scrolling when modal is active
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      loadPreferences();
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Auto-poll for Telegram connection if user is on Telegram tab and not yet connected
  useEffect(() => {
    let pollTimer: any = null;
    if (isOpen && activeTab === "telegram" && !prefs.telegram_connected) {
      pollTimer = setInterval(async () => {
        try {
          const res = await fetchWithAuthClient("/api/v1/notifications/preferences");
          if (res.ok) {
            const data: NotificationPreferences = await res.json();
            if (data.telegram_connected) {
              setPrefs(data);
              setFeedback({
                type: "success",
                text: "🎉 Telegram linked successfully! Your bot is ready.",
              });
              if (onSaved) onSaved();
            }
          }
        } catch (_) {}
      }, 3000);
    }
    return () => {
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [isOpen, activeTab, prefs.telegram_connected, onSaved]);

  const loadPreferences = async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const res = await fetchWithAuthClient("/api/v1/notifications/preferences");
      if (res.ok) {
        const data: NotificationPreferences = await res.json();
        setPrefs(data);
        setWhatsappPhone(data.whatsapp_phone_number || "");
        setChannel(data.notification_channel || "both");
        setBriefingTime(data.preferred_briefing_time || "08:00");
      }
    } catch (err) {
      console.error("Failed to load preferences", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetchWithAuthClient("/api/v1/notifications/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notification_channel: channel,
          whatsapp_phone_number: whatsappPhone.trim(),
          preferred_briefing_time: briefingTime,
        }),
      });

      if (res.ok) {
        const updated = await res.json();
        setPrefs(updated);
        setFeedback({ type: "success", text: "Preferences saved successfully!" });
        if (onSaved) onSaved();
        setTimeout(() => {
          setFeedback(null);
          onClose();
        }, 1200);
      } else {
        const err = await res.json();
        setFeedback({ type: "error", text: err.detail || "Failed to save settings." });
      }
    } catch (err: any) {
      setFeedback({ type: "error", text: err.message || "Network error saving settings." });
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateTelegramLink = async () => {
    setGeneratingLink(true);
    setFeedback(null);
    try {
      const res = await fetchWithAuthClient("/api/v1/notifications/generate-telegram-link", {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        if (data.link) {
          window.open(data.link, "_blank");
          setFeedback({
            type: "success",
            text: "Opening Telegram! Tap 'Start' on Telegram to link your account.",
          });
        }
      }
    } catch (err: any) {
      setFeedback({ type: "error", text: "Could not generate Telegram link." });
    } finally {
      setGeneratingLink(false);
    }
  };

  const handleCopyTelegramLink = async () => {
    try {
      const res = await fetchWithAuthClient("/api/v1/notifications/generate-telegram-link", {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        if (data.link) {
          await navigator.clipboard.writeText(data.link);
          setCopiedLink(true);
          setTimeout(() => setCopiedLink(false), 3000);
        }
      }
    } catch (_) {}
  };

  const handleTestWhatsapp = async () => {
    if (!whatsappPhone) {
      setFeedback({ type: "error", text: "Please enter your WhatsApp mobile number first." });
      return;
    }
    setTestingWhatsapp(true);
    setFeedback(null);
    try {
      const res = await fetchWithAuthClient("/api/v1/notifications/test-whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipient: whatsappPhone }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.provider === "mock") {
          setFeedback({
            type: "success",
            text: `✓ Test alert simulated for ${whatsappPhone} (Local Dev Mock mode). Check server terminal for output.`,
          });
        } else {
          setFeedback({
            type: "success",
            text: `✓ Live WhatsApp message delivered to ${whatsappPhone}! Check your phone.`,
          });
        }
      } else {
        setFeedback({ type: "error", text: data.detail || "Failed to send WhatsApp test message." });
      }
    } catch (err: any) {
      setFeedback({ type: "error", text: err.message || "Error sending WhatsApp test alert." });
    } finally {
      setTestingWhatsapp(false);
    }
  };

  const handleTestTelegram = async () => {
    setTestingTelegram(true);
    setFeedback(null);
    try {
      const res = await fetchWithAuthClient("/api/v1/notifications/test-telegram", {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        setFeedback({
          type: "success",
          text: "✓ Live test alert sent! Check your Telegram chat with @tamil_finance_agent_bot.",
        });
      } else {
        setFeedback({ type: "error", text: data.detail || "Failed to send Telegram test message." });
      }
    } catch (err: any) {
      setFeedback({ type: "error", text: err.message || "Error sending Telegram test." });
    } finally {
      setTestingTelegram(false);
    }
  };

  const handleManualTelegramSave = async () => {
    if (!manualTelegramChatId.trim()) return;
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetchWithAuthClient("/api/v1/notifications/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telegram_chat_id: manualTelegramChatId.trim(),
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setPrefs(updated);
        setFeedback({ type: "success", text: "✓ Telegram Chat ID linked successfully!" });
        if (onSaved) onSaved();
      } else {
        const err = await res.json();
        setFeedback({ type: "error", text: err.detail || "Failed to link Telegram ID." });
      }
    } catch (err: any) {
      setFeedback({ type: "error", text: err.message || "Network error." });
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnectTelegram = async () => {
    if (!confirm("Are you sure you want to disconnect Telegram?")) return;
    setSaving(true);
    try {
      const res = await fetchWithAuthClient("/api/v1/notifications/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telegram_chat_id: "" }),
      });
      if (res.ok) {
        const updated = await res.json();
        setPrefs(updated);
        setFeedback({ type: "success", text: "Telegram disconnected." });
        if (onSaved) onSaved();
      }
    } catch (err: any) {
      setFeedback({ type: "error", text: "Failed to disconnect." });
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen || !mounted) return null;

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-slate-950/75 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-xl bg-white rounded-3xl border border-slate-200/90 shadow-2xl overflow-hidden flex flex-col my-auto max-h-[90vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4.5 bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 text-white flex items-center justify-between shrink-0 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-400 shadow-inner shrink-0">
              <Bell size={18} className="text-amber-400" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">Notification Channels & Delivery</h2>
              <p className="text-xs text-slate-300 mt-0.5">
                Manage WhatsApp & Telegram automated alerts
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Global Channel Status Indicator Bar */}
        <div className="px-6 py-2.5 bg-slate-50 border-b border-slate-200/80 flex items-center justify-between text-xs shrink-0">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Channel Status
          </span>
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                prefs.whatsapp_connected
                  ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                  : "bg-slate-200 text-slate-600 border border-slate-300"
              }`}
            >
              <MessageCircle size={11} className={prefs.whatsapp_connected ? "text-emerald-700" : "text-slate-500"} />
              WhatsApp: {prefs.whatsapp_connected ? "Active" : "Off"}
            </span>

            <span
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                prefs.telegram_connected
                  ? "bg-sky-100 text-sky-800 border border-sky-300"
                  : "bg-slate-200 text-slate-600 border border-slate-300"
              }`}
            >
              <Send size={10} className={prefs.telegram_connected ? "text-sky-700" : "text-slate-500"} />
              Telegram: {prefs.telegram_connected ? "Active" : "Off"}
            </span>
          </div>
        </div>

        {/* Channel Segmented Tabs */}
        <div className="px-6 pt-3 pb-0 bg-white border-b border-slate-200 flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => setActiveTab("whatsapp")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-t-xl text-xs font-bold transition-all border-b-2 cursor-pointer ${
              activeTab === "whatsapp"
                ? "border-emerald-600 text-emerald-700 bg-emerald-50/50"
                : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50"
            }`}
          >
            <MessageCircle size={14} className={activeTab === "whatsapp" ? "text-emerald-600" : "text-slate-400"} />
            <span>WhatsApp</span>
            {prefs.whatsapp_connected && (
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("telegram")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-t-xl text-xs font-bold transition-all border-b-2 cursor-pointer ${
              activeTab === "telegram"
                ? "border-sky-600 text-sky-700 bg-sky-50/50"
                : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50"
            }`}
          >
            <Send size={13} className={activeTab === "telegram" ? "text-sky-600" : "text-slate-400"} />
            <span>Telegram Bot</span>
            {prefs.telegram_connected && (
              <span className="w-2 h-2 rounded-full bg-sky-500"></span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("settings")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-t-xl text-xs font-bold transition-all border-b-2 cursor-pointer ${
              activeTab === "settings"
                ? "border-indigo-600 text-indigo-700 bg-indigo-50/50"
                : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50"
            }`}
          >
            <Settings size={13} className={activeTab === "settings" ? "text-indigo-600" : "text-slate-400"} />
            <span>Routing & Schedule</span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-4.5 flex-1">
          {/* Feedback Alert Toast */}
          {feedback && (
            <div
              className={`p-3.5 rounded-2xl text-xs flex items-center gap-2.5 font-medium border animate-in fade-in ${
                feedback.type === "success"
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                  : "bg-rose-50 text-rose-800 border-rose-200"
              }`}
            >
              {feedback.type === "success" ? (
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle size={16} className="text-rose-600 shrink-0" />
              )}
              <span>{feedback.text}</span>
            </div>
          )}

          {/* TAB 1: WHATSAPP INTEGRATION */}
          {activeTab === "whatsapp" && (
            <div className="space-y-4 animate-in fade-in duration-100">
              {/* WhatsApp Card */}
              <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-200/90 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shadow-xs shrink-0">
                      <MessageCircle size={16} />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">WhatsApp Alert Destination</h4>
                      <p className="text-[11px] text-slate-500">Receive morning pulses and critical overdue notices</p>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      prefs.whatsapp_connected
                        ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                        : "bg-slate-100 text-slate-600 border border-slate-200"
                    }`}
                  >
                    {prefs.whatsapp_connected ? "● Connected" : "○ Not Linked"}
                  </span>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    Your Mobile Number (with country code)
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="tel"
                      value={whatsappPhone}
                      onChange={(e) => setWhatsappPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                    />
                    <button
                      onClick={handleTestWhatsapp}
                      disabled={testingWhatsapp || !whatsappPhone}
                      className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer shadow-xs shrink-0"
                    >
                      {testingWhatsapp ? (
                        <>
                          <Loader2 size={13} className="animate-spin" />
                          <span>Sending...</span>
                        </>
                      ) : (
                        <>
                          <Send size={12} />
                          <span>Send Test Alert</span>
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Format: +[country code][10-digit number], e.g., <code className="font-semibold text-slate-700">+919876543210</code>.
                  </p>
                </div>
              </div>

              {/* WhatsApp Copilot Commands Cheat Sheet */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
                <div className="flex items-center gap-2">
                  <Sparkles size={14} className="text-emerald-600" />
                  <h4 className="text-xs font-bold text-slate-900">WhatsApp Copilot Shortcuts</h4>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Reply directly to any alert on WhatsApp to take immediate autonomous action:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-start gap-2">
                    <code className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold font-mono text-[10px]">
                      PAY 1
                    </code>
                    <span className="text-slate-600">Settle & log overdue bill #1</span>
                  </div>
                  <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-start gap-2">
                    <code className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold font-mono text-[10px]">
                      STATUS
                    </code>
                    <span className="text-slate-600">Get daily liquid cashflow pulse</span>
                  </div>
                  <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-start gap-2">
                    <code className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold font-mono text-[10px]">
                      BILLS
                    </code>
                    <span className="text-slate-600">List upcoming bills for 7 days</span>
                  </div>
                  <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-start gap-2">
                    <code className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold font-mono text-[10px]">
                      RADAR
                    </code>
                    <span className="text-slate-600">Detect recurring subscriptions</span>
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 italic mt-1">
                  You can also ask open financial questions like: &quot;Can I afford a ₹35,000 laptop today?&quot;
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: TELEGRAM BOT INTEGRATION */}
          {activeTab === "telegram" && (
            <div className="space-y-4 animate-in fade-in duration-100">
              {/* Telegram Card */}
              <div className="p-4 rounded-2xl bg-sky-50/50 border border-sky-200/90 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-sky-500 text-white flex items-center justify-center font-bold text-xs shadow-xs shrink-0">
                      <Send size={15} className="-ml-0.5 mt-0.5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">Telegram Bot Integration</h4>
                      <p className="text-[11px] text-slate-500">Interactive bot with 1-click inline settlement buttons</p>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      prefs.telegram_connected
                        ? "bg-sky-100 text-sky-800 border border-sky-300"
                        : "bg-slate-100 text-slate-600 border border-slate-200"
                    }`}
                  >
                    {prefs.telegram_connected ? "● Connected" : "○ Not Linked"}
                  </span>
                </div>

                {prefs.telegram_connected ? (
                  <div className="p-3 bg-white rounded-xl border border-sky-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={16} className="text-sky-600 shrink-0" />
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-slate-900">Chat Connected</p>
                          <button
                            onClick={handleDisconnectTelegram}
                            disabled={saving}
                            className="text-[10px] text-rose-500 hover:text-rose-700 underline font-medium cursor-pointer"
                          >
                            Disconnect
                          </button>
                        </div>
                        <p className="text-[10px] text-slate-500 font-mono">
                          Telegram ID: {prefs.telegram_chat_id || "Active"}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={handleTestTelegram}
                      disabled={testingTelegram}
                      className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer shadow-xs shrink-0"
                    >
                      {testingTelegram ? (
                        <>
                          <Loader2 size={12} className="animate-spin" />
                          <span>Testing...</span>
                        </>
                      ) : (
                        <>
                          <Send size={11} />
                          <span>Send Test Alert</span>
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-slate-600">
                      Link your personal Telegram account in 1 click. Tap the button below, then click <strong>&quot;Start&quot;</strong> in Telegram to auto-link.
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={handleGenerateTelegramLink}
                        disabled={generatingLink}
                        className="px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer shadow-xs"
                      >
                        {generatingLink ? (
                          <>
                            <Loader2 size={14} className="animate-spin" />
                            <span>Generating Link...</span>
                          </>
                        ) : (
                          <>
                            <ExternalLink size={13} />
                            <span>Open Telegram Bot (1-Click)</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={handleCopyTelegramLink}
                        className="px-3.5 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                      >
                        {copiedLink ? (
                          <>
                            <Check size={13} className="text-emerald-600" />
                            <span>Link Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy size={13} className="text-slate-500" />
                            <span>Copy Link</span>
                          </>
                        )}
                      </button>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                      <Clock size={11} className="text-sky-600" />
                      <span>This window automatically detects your connection in real-time once you tap Start.</span>
                    </div>

                    <div className="pt-2 border-t border-sky-100 flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          setSaving(true);
                          try {
                            const res = await fetchWithAuthClient("/api/v1/notifications/preferences", {
                              method: "PUT",
                              body: JSON.stringify({ telegram_chat_id: "1337672874" }),
                            });
                            if (res.ok) {
                              const updated = await res.json();
                              setPrefs(updated);
                              setFeedback({ type: "success", text: "Linked Telegram account (1337672874) successfully!" });
                              if (onSaved) onSaved();
                            }
                          } catch (e: any) {
                            setFeedback({ type: "error", text: String(e) });
                          } finally {
                            setSaving(false);
                          }
                        }}
                        className="px-3.5 py-2 rounded-xl bg-sky-100 hover:bg-sky-200 text-sky-800 text-xs font-bold border border-sky-300 flex items-center justify-center gap-2 cursor-pointer transition-all"
                      >
                        <ShieldCheck size={14} className="text-sky-700" />
                        <span>Instant 1-Click Auto-Link Telegram (ID: 1337672874)</span>
                      </button>

                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <a
                          href="https://web.telegram.org/k/#@tamil_finance_agent_bot"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sky-600 hover:underline font-semibold flex items-center gap-1"
                        >
                          <ExternalLink size={11} />
                          <span>Open in Telegram Web (@tamil_finance_agent_bot)</span>
                        </a>
                      </div>

                      <details className="text-[11px] text-slate-500 cursor-pointer">
                        <summary className="font-semibold text-slate-600 hover:text-slate-800">
                          Or enter custom Telegram Chat ID
                        </summary>
                        <div className="mt-2 flex items-center gap-2">
                          <input
                            type="text"
                            placeholder="e.g. 1337672874"
                            value={manualTelegramChatId}
                            onChange={(e) => setManualTelegramChatId(e.target.value)}
                            className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-900 bg-white focus:outline-none focus:ring-1 focus:ring-sky-500 font-mono"
                          />
                          <button
                            type="button"
                            onClick={handleManualTelegramSave}
                            disabled={saving || !manualTelegramChatId.trim()}
                            className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-semibold text-xs disabled:opacity-50 cursor-pointer"
                          >
                            Save ID
                          </button>
                        </div>
                      </details>
                    </div>
                  </div>
                )}
              </div>

              {/* Bot Details */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 font-medium">Bot Handle:</span>
                  <span className="font-mono font-bold text-slate-800">@tamil_finance_agent_bot</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 font-medium">Inline Settlements:</span>
                  <span className="text-emerald-700 font-semibold">Enabled (1-Tap Settle & Log)</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: ROUTING & SCHEDULE */}
          {activeTab === "settings" && (
            <div className="space-y-4 animate-in fade-in duration-100">
              {/* Channel Selector Cards */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Preferred Delivery Routing
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* Both */}
                  <div
                    onClick={() => setChannel("both")}
                    className={`p-3 rounded-2xl border-2 transition-all cursor-pointer relative ${
                      channel === "both"
                        ? "border-indigo-600 bg-indigo-50/60 shadow-xs"
                        : "border-slate-200 hover:border-slate-300 bg-white"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-emerald-500 to-sky-500 text-white flex items-center justify-center font-bold text-xs shadow-xs shrink-0">
                          <Layers size={14} />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-slate-900">Both Channels</h4>
                          <p className="text-[10px] text-slate-500">WhatsApp + Telegram</p>
                        </div>
                      </div>
                      {channel === "both" && (
                        <div className="w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0">
                          <Check size={11} strokeWidth={3} />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* WhatsApp Only */}
                  <div
                    onClick={() => setChannel("whatsapp")}
                    className={`p-3 rounded-2xl border-2 transition-all cursor-pointer relative ${
                      channel === "whatsapp"
                        ? "border-emerald-600 bg-emerald-50/60 shadow-xs"
                        : "border-slate-200 hover:border-slate-300 bg-white"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shadow-xs shrink-0">
                          <MessageCircle size={14} />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-slate-900">WhatsApp Only</h4>
                          <p className="text-[10px] text-slate-500">Direct phone messages</p>
                        </div>
                      </div>
                      {channel === "whatsapp" && (
                        <div className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                          <Check size={11} strokeWidth={3} />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Telegram Only */}
                  <div
                    onClick={() => setChannel("telegram")}
                    className={`p-3 rounded-2xl border-2 transition-all cursor-pointer relative ${
                      channel === "telegram"
                        ? "border-sky-600 bg-sky-50/60 shadow-xs"
                        : "border-slate-200 hover:border-slate-300 bg-white"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-sky-500 text-white flex items-center justify-center font-bold text-xs shadow-xs shrink-0">
                          <Send size={13} className="-ml-0.5 mt-0.5" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-slate-900">Telegram Only</h4>
                          <p className="text-[10px] text-slate-500">Interactive Bot chat</p>
                        </div>
                      </div>
                      {channel === "telegram" && (
                        <div className="w-4 h-4 rounded-full bg-sky-600 text-white flex items-center justify-center shrink-0">
                          <Check size={11} strokeWidth={3} />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* In-App Only */}
                  <div
                    onClick={() => setChannel("in_app")}
                    className={`p-3 rounded-2xl border-2 transition-all cursor-pointer relative ${
                      channel === "in_app"
                        ? "border-slate-800 bg-slate-100 shadow-xs"
                        : "border-slate-200 hover:border-slate-300 bg-white"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-slate-800 text-white flex items-center justify-center font-bold text-xs shadow-xs shrink-0">
                          <Bell size={13} />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-slate-900">In-App Only</h4>
                          <p className="text-[10px] text-slate-500">Silent web dashboard</p>
                        </div>
                      </div>
                      {channel === "in_app" && (
                        <div className="w-4 h-4 rounded-full bg-slate-800 text-white flex items-center justify-center shrink-0">
                          <Check size={11} strokeWidth={3} />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Briefing Schedule */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                    <Clock size={15} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">Morning Pulse Briefing Time</h4>
                    <p className="text-[10px] text-slate-500">Automated daily dispatch time (IST)</p>
                  </div>
                </div>
                <input
                  type="time"
                  value={briefingTime}
                  onChange={(e) => setBriefingTime(e.target.value)}
                  className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                />
              </div>

              <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-100 flex items-start gap-2 text-[11px] text-blue-900">
                <Info size={14} className="text-blue-600 shrink-0 mt-0.5" />
                <span>
                  High-priority alerts (such as overdue bills or cashflow deficits) are sent immediately regardless of schedule to protect your credit score.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2.5 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <ShieldCheck size={14} />
                <span>Save Preferences</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
