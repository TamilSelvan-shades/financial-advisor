"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Mic,
  Square,
  Sparkles,
  X,
  Volume2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ArrowRight,
  Upload
} from "lucide-react";
import { fetchWithAuthClient } from "@/lib/api-client";
import { useCurrency } from "@/context/currency-context";

interface VoiceLedgerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function VoiceLedgerModal({
  isOpen,
  onClose,
  onSuccess,
}: VoiceLedgerModalProps) {
  const { formatCurrency } = useCurrency();
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingTime, setRecordingTime] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [spokenResponse, setSpokenResponse] = useState<string | null>(null);
  const [transactionData, setTransactionData] = useState<any | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) {
      stopRecordingCleanup();
      setTranscript(null);
      setSpokenResponse(null);
      setTransactionData(null);
      setErrorMsg(null);
      setSuccessMsg(null);
    }
  }, [isOpen]);

  const stopRecordingCleanup = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRecording(false);
    setRecordingTime(0);
  };

  const startRecording = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setTranscript(null);
    setSpokenResponse(null);
    setTransactionData(null);
    audioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        await sendAudioToBackend(audioBlob, "recording.webm");
      };

      recorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      setErrorMsg(
        "Microphone access was denied or not supported in this browser. You can still upload an audio file below."
      );
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setIsRecording(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await sendAudioToBackend(file, file.name);
  };

  const sendAudioToBackend = async (audioBlob: Blob, filename: string) => {
    setIsProcessing(true);
    setErrorMsg(null);

    const formData = new FormData();
    formData.append("file", audioBlob, filename);
    formData.append("auto_commit", "true");

    try {
      const res = await fetchWithAuthClient("/api/v1/multimodal/voice-to-ledger", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setTranscript(data.transcript);
        setSpokenResponse(data.spoken_response);
        setTransactionData(data.transaction);
        setSuccessMsg(data.spoken_response || "Transaction recorded successfully!");
        if (onSuccess) onSuccess();
      } else {
        setErrorMsg(data.detail || data.error || "Could not recognize financial voice transaction.");
      }
    } catch (err: any) {
      setErrorMsg(`Voice processing error: ${err.message || String(err)}`);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <Mic size={20} />
            </div>
            <div>
              <div className="font-extrabold text-base tracking-tight flex items-center gap-2">
                <span>Voice-to-Ledger Ingestion</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 flex items-center gap-1">
                  <Sparkles size={11} />
                  Multimodal
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Speak naturally: &quot;Paid ₹650 for petrol at Shell on credit card&quot;
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 text-center">
          {/* Status Banners */}
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center gap-2.5 text-left">
              <AlertCircle size={16} className="text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2.5 text-left">
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Central Pulsing Audio Visualizer */}
          <div className="py-6 flex flex-col items-center justify-center gap-4">
            <div className="relative">
              {/* Outer pulsing rings when active */}
              {isRecording && (
                <>
                  <div className="absolute -inset-4 rounded-full bg-rose-500/20 animate-ping pointer-events-none" />
                  <div className="absolute -inset-8 rounded-full bg-rose-500/10 animate-pulse pointer-events-none" />
                </>
              )}

              <button
                type="button"
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isProcessing}
                className={`h-24 w-24 rounded-full flex items-center justify-center shadow-xl transition-all cursor-pointer ${
                  isRecording
                    ? "bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/40 ring-4 ring-rose-300"
                    : isProcessing
                    ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                    : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/30 hover:scale-105"
                }`}
              >
                {isProcessing ? (
                  <RefreshCw size={32} className="animate-spin text-slate-500" />
                ) : isRecording ? (
                  <Square size={32} />
                ) : (
                  <Mic size={36} />
                )}
              </button>
            </div>

            {/* Status Text & Timer */}
            <div>
              {isRecording ? (
                <div className="space-y-1">
                  <div className="flex items-center justify-center gap-2 text-rose-600 font-extrabold text-sm animate-pulse">
                    <span className="h-2 w-2 rounded-full bg-rose-600" />
                    <span>Listening... (00:{recordingTime.toString().padStart(2, "0")})</span>
                  </div>
                  <p className="text-xs text-slate-400">Tap square button when done speaking</p>
                </div>
              ) : isProcessing ? (
                <div className="space-y-1">
                  <p className="text-sm font-bold text-slate-700">Transcribing & Parsing Speech...</p>
                  <p className="text-xs text-slate-400">Gemini 2.5 Flash Audio is analyzing transaction intent</p>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-sm font-bold text-slate-800">Tap microphone to speak</p>
                  <p className="text-xs text-slate-400">State the amount, merchant, and category naturally</p>
                </div>
              )}
            </div>
          </div>

          {/* Results Display */}
          {transcript && (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-left space-y-3">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                  What you said
                </span>
                <p className="text-sm font-semibold text-slate-800 italic">&ldquo;{transcript}&rdquo;</p>
              </div>

              {transactionData && (
                <div className="pt-2 border-t border-slate-200 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Amount</span>
                    <span className="font-bold text-emerald-600">
                      {formatCurrency(transactionData.amount)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Category</span>
                    <span className="font-bold text-slate-800">{transactionData.category}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Account</span>
                    <span className="font-bold text-slate-800">{transactionData.account}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Audio File Upload Fallback */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Or upload recorded audio clip:</span>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-colors flex items-center gap-1.5"
            >
              <Upload size={12} />
              <span>Choose Audio File</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*,.webm,.wav,.mp3,.m4a"
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={isRecording || isProcessing}
            className={`px-5 py-2 rounded-xl text-xs font-bold transition-colors ${
              isRecording || isProcessing
                ? "bg-slate-300 text-slate-500 cursor-not-allowed"
                : "bg-slate-900 hover:bg-slate-800 text-white cursor-pointer"
            }`}
          >
            {isProcessing ? "Processing..." : isRecording ? "Stop Recording First" : "Done"}
          </button>
        </div>
      </div>
    </div>
  );
}
