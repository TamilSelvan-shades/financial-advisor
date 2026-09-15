"use client";

import { useState, useEffect, useRef } from "react";
import { fetchWithAuthClient } from "@/lib/api-client";
import { Card, CardContent } from "@/components/ui/card";
import { Send, Bot, User, Trash2, Sparkles } from "lucide-react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

const SUGGESTIONS = [
  "What is my current net worth?",
  "How much total debt do I have?",
  "What bills are due this month?",
  "How can I accelerate my loan payoff?"
];

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Hello! I am your AI Financial Advisor, directly connected to your live financial database. How can I assist you with your net worth, expenses, loans, or investments today?" }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
    const newMessages: Message[] = [...messages, { role: "user", content: userMessage.trim() }];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const res = await fetchWithAuthClient("/api/v1/chat/", {
        method: "POST",
        body: JSON.stringify({ message: userMessage.trim() })
      });
      
      if (res.ok) {
        const data = await res.json();
        setMessages(prev => [...prev, { role: "assistant", content: data.reply || "No response received." }]);
      } else {
        setMessages(prev => [...prev, { role: "assistant", content: `Error from AI backend (Status ${res.status}).` }]);
      }
    } catch (error) {
      setMessages(prev => [...prev, { role: "assistant", content: `Failed to reach AI assistant: ${String(error)}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSend(input);
  };

  const handleClearChat = () => {
    if (confirm("Clear your conversation history?")) {
      const resetMsg: Message[] = [
        { role: "assistant", content: "Chat history cleared. How can I help you today?" }
      ];
      setMessages(resetMsg);
      localStorage.removeItem("ai_advisor_chat_messages");
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4 h-[calc(100vh-7rem)] flex flex-col">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Sparkles size={22} className="text-blue-600" /> AI Financial Advisor
          </h1>
          <p className="text-xs text-muted-foreground">Directly connected to your live accounts, debts, investments, and budgets.</p>
        </div>
        <button 
          onClick={handleClearChat}
          className="text-xs text-slate-500 hover:text-red-600 flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-200 hover:bg-slate-50 transition-colors"
          title="Reset Chat"
        >
          <Trash2 size={13} /> Clear Chat
        </button>
      </div>
      
      <Card className="flex-1 flex flex-col overflow-hidden border-slate-200 shadow-sm">
        <CardContent className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex gap-3.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-800'
              }`}>
                {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
              </div>
              <div className={`rounded-2xl px-4 py-3 max-w-[85%] text-sm leading-relaxed shadow-sm ${
                msg.role === 'user' 
                  ? 'bg-blue-600 text-white rounded-tr-none' 
                  : 'bg-slate-100 text-slate-900 rounded-tl-none'
              }`}>
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-3.5">
              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                <Bot size={16} className="text-slate-700" />
              </div>
              <div className="rounded-2xl rounded-tl-none px-4 py-3 bg-slate-100 flex gap-1.5 items-center">
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} />
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0.4s" }} />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </CardContent>
        
        {/* Quick Suggestions Chips */}
        <div className="px-4 py-2 border-t bg-slate-50/50 flex gap-2 overflow-x-auto text-xs">
          {SUGGESTIONS.map((s, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(s)}
              disabled={isLoading}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-full text-slate-700 hover:bg-slate-100 hover:text-blue-600 transition-colors shrink-0 disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>

        <div className="p-4 border-t bg-white">
          <form onSubmit={handleFormSubmit} className="flex gap-3">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask anything about your net worth, expenses, loans, or savings..."
              className="flex-1 h-11 rounded-full border px-5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
              disabled={isLoading}
            />
            <button 
              type="submit" 
              disabled={isLoading || !input.trim()}
              className="h-11 w-11 rounded-full bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0 shadow-sm"
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      </Card>
    </div>
  );
}
