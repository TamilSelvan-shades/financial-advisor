"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { fetchWithAuthClient } from "@/lib/api-client";
import { Card, CardContent } from "@/components/ui/card";
import {
  Send,
  Bot,
  User,
  Trash2,
  Sparkles,
  Zap,
  ArrowRight,
  ShieldCheck,
  CornerDownLeft,
} from "lucide-react";
import { PulseRing } from "@/components/ui/motion";

type Message = {
  role: "user" | "assistant";
  content: string;
};

const SUGGESTIONS = [
  "What is my current net worth and cash position?",
  "How much total loan debt do I have remaining?",
  "What bills and subscriptions are due this month?",
  "Recommend an accelerated debt payoff strategy",
];

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hello! I am Ledgerly, your autonomous AI Financial Co-pilot. I have secure, real-time read access to your connected bank accounts, debts, investments, budgets, and bills.\n\nAsk me anything or pick a quick prompt below to analyze your wealth trajectory.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load chat history from localStorage on client mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("ai_advisor_chat_messages");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
        }
      }
    } catch (e) {
      console.error("Failed to load chat history:", e);
    }
  }, []);

  // Save chat history to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("ai_advisor_chat_messages", JSON.stringify(messages));
    } catch (e) {
      console.error("Failed to save chat history:", e);
    }
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSend = async (userMessage: string) => {
    if (!userMessage.trim() || isLoading) return;

    setInput("");
    const newMessages: Message[] = [
      ...messages,
      { role: "user", content: userMessage.trim() },
    ];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const res = await fetchWithAuthClient("/api/v1/chat/", {
        method: "POST",
        body: JSON.stringify({ message: userMessage.trim() }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.reply || "No response received." },
        ]);
      } else {
        const errData = await res.json().catch(() => ({}));
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: errData.detail || `Error from AI backend (Status ${res.status}). Please check your plan limits.`,
          },
        ]);
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Failed to reach AI assistant: ${String(error)}`,
        },
      ]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSend(input);
  };

  const handleClearChat = () => {
    if (confirm("Reset conversation history?")) {
      const resetMsg: Message[] = [
        {
          role: "assistant",
          content:
            "Conversation history reset. I am ready to assist with your live financial data.",
        },
      ];
      setMessages(resetMsg);
      localStorage.removeItem("ai_advisor_chat_messages");
    }
  };

  return (
    <div className="mx-auto flex h-[calc(100vh-7.5rem)] max-w-4xl flex-col space-y-4">
      {/* Header Bar */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-[#15332f] to-emerald-600 text-white shadow-sm shadow-emerald-900/20">
                <Sparkles size={16} />
              </div>
              Ledgerly AI Co-Pilot
            </h1>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-50/80 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800 shadow-2xs">
              <PulseRing color="#10b981" size={6} /> Connected to Live Ledger
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Real-time querying across transactions, debt amortization curves, and investment holdings.
          </p>
        </div>

        <button
          onClick={handleClearChat}
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-2xs transition-colors hover:bg-rose-50 hover:border-rose-200 hover:text-rose-600 cursor-pointer"
          title="Reset conversation"
        >
          <Trash2 size={13} />
          <span>Clear Chat</span>
        </button>
      </div>

      {/* Main Chat Shell */}
      <Card className="flex flex-1 flex-col overflow-hidden rounded-3xl border-slate-200/80 bg-white/80 shadow-md backdrop-blur-sm">
        <CardContent className="flex flex-1 flex-col overflow-hidden p-0">
          {/* Scrollable Message Area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
            <AnimatePresence initial={false}>
              {messages.map((msg, idx) => {
                const isUser = msg.role === "user";
                return (
                  <motion.div
                    key={`msg-${idx}`}
                    initial={{ opacity: 0, y: 12, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                    className={`flex gap-3.5 ${isUser ? "flex-row-reverse" : "flex-row"}`}
                  >
                    {/* Avatar */}
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl shadow-xs ${
                        isUser
                          ? "bg-gradient-to-br from-[#15332f] to-[#1d4641] text-white"
                          : "bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200/60 text-emerald-800"
                      }`}
                    >
                      {isUser ? <User size={16} /> : <Bot size={17} />}
                    </div>

                    {/* Bubble */}
                    <div
                      className={`relative max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-xs ${
                        isUser
                          ? "rounded-tr-none bg-gradient-to-r from-[#15332f] to-[#1b433e] text-white"
                          : "rounded-tl-none border border-slate-200/80 bg-gradient-to-br from-white to-slate-50/60 text-slate-800"
                      }`}
                    >
                      <p className="whitespace-pre-wrap font-sans">{msg.content}</p>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {/* Typing Indicator */}
            {isLoading && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3.5"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-emerald-200/60 bg-emerald-50 text-emerald-800">
                  <Bot size={17} />
                </div>
                <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-none border border-slate-200/80 bg-white px-4 py-3 shadow-xs">
                  <motion.span
                    className="h-2 w-2 rounded-full bg-emerald-500"
                    animate={{ scale: [1, 1.4, 1], opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 0.8, repeat: Infinity, delay: 0 }}
                  />
                  <motion.span
                    className="h-2 w-2 rounded-full bg-teal-500"
                    animate={{ scale: [1, 1.4, 1], opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 0.8, repeat: Infinity, delay: 0.2 }}
                  />
                  <motion.span
                    className="h-2 w-2 rounded-full bg-sky-500"
                    animate={{ scale: [1, 1.4, 1], opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 0.8, repeat: Infinity, delay: 0.4 }}
                  />
                  <span className="ml-2 text-xs font-semibold text-slate-400">
                    Analyzing ledger...
                  </span>
                </div>
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompt Suggestions */}
          <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-2.5 backdrop-blur-xs">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
              <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-slate-400 shrink-0">
                <Zap size={11} className="text-amber-500" /> Suggestions:
              </span>
              {SUGGESTIONS.map((s, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(s)}
                  disabled={isLoading}
                  className="shrink-0 rounded-full border border-slate-200/80 bg-white px-3.5 py-1 text-xs font-medium text-slate-700 shadow-2xs transition-all hover:border-emerald-300 hover:bg-emerald-50/50 hover:text-emerald-800 disabled:opacity-50 cursor-pointer"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Message Input Box */}
          <div className="border-t border-slate-200/80 bg-white p-3.5">
            <form onSubmit={handleFormSubmit} className="flex items-center gap-2.5">
              <div className="relative flex-1">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask anything about your cashflow, debts, goals, or investment performance..."
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-4 pr-12 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
                  disabled={isLoading}
                />
                <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-md border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
                  ↵ Enter
                </kbd>
              </div>

              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-r from-[#15332f] to-[#1c4540] text-white shadow-md shadow-[#15332f]/20 transition-all hover:brightness-110 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                title="Send Message"
              >
                <Send size={16} />
              </button>
            </form>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
