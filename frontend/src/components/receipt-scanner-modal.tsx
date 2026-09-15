"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Camera,
  Upload,
  X,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Receipt,
  Layers,
  RefreshCw,
  SwitchCamera,
  RotateCcw,
} from "lucide-react";
import { fetchWithAuthClient } from "@/lib/api-client";
import { useCurrency } from "@/context/currency-context";

interface ReceiptItem {
  name: string;
  quantity?: number;
  unit_price?: number;
  total_price?: number;
}

interface ParsedReceiptData {
  merchant: string;
  date: string;
  category: string;
  total_amount: number;
  subtotal: number;
  tax_amount: number;
  tax_breakdown?: string;
  payment_method?: string;
  currency: string;
  line_items?: ReceiptItem[];
  invoice_number?: string;
  notes?: string;
}

interface ReceiptScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function ReceiptScannerModal({
  isOpen,
  onClose,
  onSuccess,
}: ReceiptScannerModalProps) {
  const { formatCurrency } = useCurrency();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [isCameraLoading, setIsCameraLoading] = useState<boolean>(false);
  const [cameraFacingMode, setCameraFacingMode] = useState<"environment" | "user">("environment");
  const [cameraError, setCameraError] = useState<string | null>(null);

  const [, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [parsedData, setParsedData] = useState<ParsedReceiptData | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Stop media stream tracks
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
    setIsCameraLoading(false);
  }, []);

  // Cleanup on unmount or when modal closes
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setSelectedFile(null);
      setPreviewUrl(null);
      setParsedData(null);
      setErrorMsg(null);
      setSuccessMsg(null);
      setCameraError(null);
    }
  }, [isOpen, stopCamera]);

  if (!isOpen) return null;

  const handleClose = () => {
    stopCamera();
    onClose();
  };

  // Launch live camera stream via MediaDevices API
  const startCamera = async (mode: "environment" | "user" = cameraFacingMode) => {
    setCameraError(null);
    setIsCameraLoading(true);
    setIsCameraActive(true);

    // Stop any existing stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Camera API not supported in this browser. Please use file upload.");
      }

      let stream: MediaStream;
      try {
        // First try ideal constraints
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: mode },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
      } catch {
        // Fallback to simple video constraint (e.g., desktop/laptop webcams)
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setIsCameraLoading(false);
    } catch (err: any) {
      console.error("Camera access failed:", err);
      let message = "Unable to access camera. Please check permissions or upload a file.";
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        message = "Camera permission was denied. Please allow camera access in your browser settings or select a file instead.";
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        message = "No camera hardware detected on this device. Please select an image file.";
      }
      setCameraError(message);
      setIsCameraActive(false);
      setIsCameraLoading(false);
    }
  };

  // Snap photo from the live video stream
  const capturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;

    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      setErrorMsg("Failed to capture image context.");
      return;
    }

    ctx.drawImage(video, 0, 0, width, height);

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setErrorMsg("Failed to generate image file.");
          return;
        }

        const file = new File([blob], `receipt_${Date.now()}.jpg`, {
          type: "image/jpeg",
        });

        stopCamera();
        setSelectedFile(file);
        setPreviewUrl(URL.createObjectURL(file));
        setParsedData(null);
        setErrorMsg(null);
        setSuccessMsg(null);

        // Run OCR scan on the captured frame
        runScanner(file);
      },
      "image/jpeg",
      0.92
    );
  };

  const flipCamera = () => {
    const nextMode = cameraFacingMode === "environment" ? "user" : "environment";
    setCameraFacingMode(nextMode);
    startCamera(nextMode);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    processSelectedFile(file);
  };

  const processSelectedFile = (file: File) => {
    stopCamera();
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setParsedData(null);
    setErrorMsg(null);
    setSuccessMsg(null);

    runScanner(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processSelectedFile(file);
    }
  };

  const runScanner = async (file: File) => {
    setIsScanning(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("auto_commit", "false");

    try {
      const res = await fetchWithAuthClient("/api/v1/multimodal/scan-receipt", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.success && data.receipt) {
        setParsedData(data.receipt);
      } else {
        setErrorMsg(data.detail || data.error || "Failed to parse receipt image.");
      }
    } catch (err: any) {
      setErrorMsg(`Scanning error: ${err.message || String(err)}`);
    } finally {
      setIsScanning(false);
    }
  };

  const handleConfirmAndSave = async () => {
    if (!parsedData) return;
    setIsSaving(true);
    setErrorMsg(null);

    try {
      const lineItemsSummary = parsedData.line_items?.length
        ? ` | Items: ${parsedData.line_items.map((i) => i.name).filter(Boolean).slice(0, 4).join(", ")}`
        : "";

      const res = await fetchWithAuthClient("/api/v1/expenses/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: parsedData.date,
          category: parsedData.category || "Miscellaneous",
          amount: parsedData.total_amount,
          account: "Cash",
          description: parsedData.merchant || "Receipt Expense",
          remarks: `Multimodal Receipt OCR: ${parsedData.merchant}${lineItemsSummary}`,
        }),
      });

      if (res.ok) {
        setSuccessMsg(`Logged ₹${parsedData.total_amount.toLocaleString()} for ${parsedData.merchant}!`);
        setTimeout(() => {
          if (onSuccess) onSuccess();
          handleClose();
        }, 1200);
      } else {
        const errData = await res.json();
        setErrorMsg(errData.detail || "Failed to record expense.");
      }
    } catch (err: any) {
      setErrorMsg(`Save error: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shadow-inner">
              <Camera size={20} />
            </div>
            <div>
              <div className="font-extrabold text-base tracking-tight flex items-center gap-2">
                <span>Receipt & Invoice OCR</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 flex items-center gap-1">
                  <Sparkles size={11} />
                  Gemini 2.5 Flash Vision
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Snap or upload a bill to extract merchant, line items, taxes, and amounts.
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Status Banners */}
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center gap-2.5">
              <AlertCircle size={16} className="text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {cameraError && (
            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-medium flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <AlertCircle size={16} className="text-amber-600 shrink-0" />
                <span>{cameraError}</span>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1 bg-amber-200 hover:bg-amber-300 text-amber-900 rounded-lg text-xs font-bold transition-colors shrink-0"
              >
                Select File
              </button>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2.5">
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* VIEW 1: LIVE CAMERA VIEWFINDER */}
          {isCameraActive ? (
            <div className="relative rounded-3xl overflow-hidden bg-black flex flex-col items-center justify-center shadow-xl border border-slate-800">
              <div className="relative w-full h-[340px] md:h-[380px] flex items-center justify-center overflow-hidden">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />

                {/* Receipt Viewport Guide Frame */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-6">
                  <div className="relative w-full max-w-sm h-full max-h-[280px] border-2 border-dashed border-indigo-400/80 rounded-2xl bg-indigo-500/5 shadow-[0_0_0_9999px_rgba(0,0,0,0.4)] flex items-center justify-center">
                    <div className="px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md text-white/90 text-[11px] font-semibold flex items-center gap-1.5 shadow-md">
                      <Sparkles size={12} className="text-indigo-400" />
                      <span>Align receipt within frame</span>
                    </div>

                    {/* Corner Reticles */}
                    <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-indigo-400" />
                    <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-indigo-400" />
                    <div className="absolute bottom-2 left-2 w-4 h-2 border-b-2 border-l-2 border-indigo-400" />
                    <div className="absolute bottom-2 right-2 w-4 h-2 border-b-2 border-r-2 border-indigo-400" />
                  </div>
                </div>

                {isCameraLoading && (
                  <div className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center gap-3 text-white">
                    <RefreshCw size={24} className="animate-spin text-indigo-400" />
                    <span className="text-xs font-semibold">Starting camera...</span>
                  </div>
                )}
              </div>

              {/* Bottom Live Camera Controls */}
              <div className="w-full bg-slate-950/90 backdrop-blur-md px-6 py-4 flex items-center justify-between border-t border-slate-800">
                <button
                  type="button"
                  onClick={stopCamera}
                  className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw size={14} />
                  <span>Cancel</span>
                </button>

                {/* Tactile Shutter Button */}
                <button
                  type="button"
                  onClick={capturePhoto}
                  disabled={isCameraLoading}
                  className="relative group p-1 rounded-full bg-gradient-to-tr from-indigo-500 to-violet-500 shadow-lg shadow-indigo-500/40 hover:scale-105 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                  title="Snap photo"
                >
                  <div className="h-14 w-14 rounded-full border-2 border-white/80 flex items-center justify-center bg-white text-slate-900 group-hover:bg-slate-100 transition-colors">
                    <Camera size={22} className="text-indigo-600" />
                  </div>
                </button>

                <button
                  type="button"
                  onClick={flipCamera}
                  className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                  title="Switch Front/Rear Camera"
                >
                  <SwitchCamera size={14} />
                  <span className="hidden sm:inline">Flip</span>
                </button>
              </div>
            </div>
          ) : !previewUrl ? (
            /* VIEW 2: INITIAL DROPZONE & LAUNCH BUTTONS */
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-3xl p-8 text-center transition-all flex flex-col items-center justify-center gap-4 ${
                isDragging
                  ? "border-indigo-500 bg-indigo-50/50 scale-[1.01]"
                  : "border-slate-300 hover:border-indigo-400 bg-slate-50/60"
              }`}
            >
              <div className="h-16 w-16 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center shadow-inner">
                <Receipt size={30} />
              </div>
              <div>
                <p className="font-bold text-slate-800 text-sm">Drop receipt photo or choose capture option</p>
                <p className="text-xs text-slate-400 mt-1">Supports JPG, PNG, WEBP, and PDF invoices</p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3">
                {/* Real Live Camera Viewfinder Launcher */}
                <button
                  type="button"
                  onClick={() => startCamera()}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/25 flex items-center gap-2 transition-all cursor-pointer hover:scale-[1.02] active:scale-95"
                >
                  <Camera size={15} />
                  <span>Take Photo with Camera</span>
                </button>

                {/* File Upload Picker */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-5 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-bold shadow-sm flex items-center gap-2 transition-all cursor-pointer hover:scale-[1.02] active:scale-95"
                >
                  <Upload size={15} />
                  <span>Select File</span>
                </button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>
          ) : (
            /* VIEW 3: PREVIEW WITH OCR LASER SCAN & RESULTS */
            <div className="grid md:grid-cols-2 gap-5">
              {/* Left Column: Image Preview with Laser Scanner Animation */}
              <div className="relative rounded-2xl border border-slate-200 overflow-hidden bg-slate-900 flex items-center justify-center min-h-[260px] max-h-[340px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt="Receipt Preview"
                  className="object-contain w-full h-full max-h-[340px]"
                />

                {/* Pulsing Laser Scan Line */}
                {isScanning && (
                  <div className="absolute inset-0 pointer-events-none overflow-hidden">
                    <div className="w-full h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_15px_#22d3ee] animate-bounce" />
                    <div className="absolute inset-0 bg-cyan-500/10 backdrop-blur-[1px] flex items-center justify-center">
                      <div className="px-4 py-2 rounded-xl bg-slate-950/80 border border-cyan-400/40 text-cyan-300 text-xs font-bold flex items-center gap-2 shadow-xl">
                        <RefreshCw size={14} className="animate-spin" />
                        <span>AI Vision Scanning...</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Retake Button */}
                <div className="absolute top-2 right-2 flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFile(null);
                      setPreviewUrl(null);
                      setParsedData(null);
                      startCamera();
                    }}
                    className="px-2.5 py-1 rounded-lg bg-indigo-600/90 hover:bg-indigo-600 text-white text-[10px] font-bold backdrop-blur-sm border border-indigo-400/30 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Camera size={11} />
                    <span>Retake</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFile(null);
                      setPreviewUrl(null);
                      setParsedData(null);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-slate-950/70 hover:bg-slate-950 text-white text-[10px] font-bold backdrop-blur-sm border border-slate-700 transition-colors cursor-pointer"
                  >
                    Change
                  </button>
                </div>
              </div>

              {/* Right Column: Parsed Results Form */}
              <div className="space-y-4">
                {isScanning ? (
                  <div className="p-8 text-center space-y-3">
                    <div className="h-10 w-10 mx-auto rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center animate-spin">
                      <RefreshCw size={18} />
                    </div>
                    <p className="text-xs font-bold text-slate-700">Extracting merchant & line items...</p>
                    <p className="text-[11px] text-slate-400">Gemini 2.5 Flash Vision analyzing receipt structure.</p>
                  </div>
                ) : parsedData ? (
                  <div className="space-y-3.5">
                    {/* Merchant & Amount Banner */}
                    <div className="p-4 rounded-2xl bg-gradient-to-tr from-indigo-50 via-slate-50 to-indigo-50/50 border border-indigo-100 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Merchant</span>
                        <div className="font-extrabold text-base text-slate-900">{parsedData.merchant}</div>
                        <div className="text-xs text-slate-500">{parsedData.date} • {parsedData.category}</div>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Total</span>
                        <div className="font-extrabold text-xl text-indigo-600">
                          {formatCurrency(parsedData.total_amount)}
                        </div>
                        {parsedData.currency !== "INR" && (
                          <div className="text-[10px] font-mono text-slate-400">
                            Orig: {parsedData.currency} {parsedData.total_amount}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Tax Breakdown & Payment Method */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                        <span className="text-[10px] text-slate-400 font-semibold block">Tax / GST Included</span>
                        <span className="font-bold text-slate-800">
                          {parsedData.tax_amount > 0 ? formatCurrency(parsedData.tax_amount) : "₹0.00"}
                        </span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                        <span className="text-[10px] text-slate-400 font-semibold block">Payment Method</span>
                        <span className="font-bold text-slate-800">
                          {parsedData.payment_method || "Detected on receipt"}
                        </span>
                      </div>
                    </div>

                    {/* Line Items Accordion */}
                    {parsedData.line_items && parsedData.line_items.length > 0 && (
                      <div className="border border-slate-200 rounded-xl overflow-hidden">
                        <div className="px-3 py-1.5 bg-slate-100 text-[11px] font-bold text-slate-600 flex items-center gap-1.5">
                          <Layers size={12} />
                          <span>Extracted Line Items ({parsedData.line_items.length})</span>
                        </div>
                        <div className="max-h-32 overflow-y-auto divide-y divide-slate-100 text-xs">
                          {parsedData.line_items.map((item, idx) => (
                            <div key={idx} className="px-3 py-1.5 flex items-center justify-between">
                              <span className="text-slate-700 truncate max-w-[150px]">{item.name}</span>
                              <span className="font-mono text-slate-900 font-semibold">
                                {item.total_price ? formatCurrency(item.total_price) : ""}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-8 text-center text-xs text-slate-400">
                    Upload an image or take a photo to view OCR extraction.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {parsedData && (
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
            <button
              type="button"
              onClick={() => {
                setSelectedFile(null);
                setPreviewUrl(null);
                setParsedData(null);
              }}
              className="text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
            >
              Scan Another
            </button>

            <button
              type="button"
              disabled={isSaving}
              onClick={handleConfirmAndSave}
              className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-md shadow-slate-900/20 flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
            >
              <CheckCircle2 size={15} className="text-emerald-400" />
              <span>{isSaving ? "Saving to Ledger..." : "Confirm & Log to Expenses"}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
