"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  ArrowDownRight,
  ArrowUpRight,
  AlertCircle,
  Save,
  Tag,
  Calendar,
  Landmark,
  FileText,
  AlignLeft,
} from "lucide-react";
import { fetchWithAuthClient } from "@/lib/api-client";
import { useCurrency } from "@/context/currency-context";

export interface EditableTransaction {
  id: number;
  type: "Expense" | "Income";
  date: string;
  amount: number;
  category: string;
  account: string;
  description?: string;
  remarks?: string;
}

interface EditTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: EditableTransaction | null;
  accountNames: string[];
  onSuccess?: (message: string) => void;
}

const EXPENSE_CATEGORIES = [
  "Food & Dining",
  "Groceries",
  "Transport & Fuel",
  "Utilities & Bills",
  "Shopping",
  "Entertainment",
  "Healthcare",
  "Travel",
  "Fitness",
  "Loans & EMI",
];

const INCOME_CATEGORIES = [
  "Salary",
  "Interest Received",
  "Dividends",
  "Freelance",
  "Cash Deposit",
  "Other Income",
];

export default function EditTransactionModal({
  isOpen,
  onClose,
  transaction,
  accountNames,
  onSuccess,
}: EditTransactionModalProps) {
  const { currency, formatCurrency } = useCurrency();

  const [date, setDate] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [category, setCategory] = useState<string>("");
  const [account, setAccount] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [remarks, setRemarks] = useState<string>("");

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sync state when transaction changes or modal opens
  useEffect(() => {
    if (transaction && isOpen) {
      setDate(transaction.date || new Date().toISOString().split("T")[0]);
      setAmount(Math.abs(transaction.amount).toString());
      setCategory(transaction.category || "");
      setAccount(transaction.account || (accountNames[0] || "ICICI Savings Account"));
      setDescription(transaction.description || "");
      setRemarks(transaction.remarks || "");
      setErrorMsg(null);
    }
  }, [transaction, isOpen, accountNames]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !isSaving) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isSaving, onClose]);

  if (!isOpen || !transaction) return null;

  const isExpense = transaction.type === "Expense";
  const categoryPills = isExpense ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg(null);

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setErrorMsg("Please enter a valid amount greater than 0.");
      return;
    }

    if (!category.trim()) {
      setErrorMsg("Category cannot be empty.");
      return;
    }

    if (!account.trim()) {
      setErrorMsg("Please select an account.");
      return;
    }

    setIsSaving(true);
    try {
      const endpoint = isExpense
        ? `/api/v1/expenses/${transaction.id}`
        : `/api/v1/incomes/${transaction.id}`;

      const res = await fetchWithAuthClient(endpoint, {
        method: "PUT",
        body: JSON.stringify({
          date,
          amount: parsedAmount,
          category: category.trim(),
          account: account.trim(),
          description: description.trim(),
          remarks: remarks.trim(),
        }),
      });

      const resData = await res.json().catch(() => null);

      if (res.ok) {
        onSuccess?.(resData?.message || `${transaction.type} updated successfully!`);
        onClose();
      } else {
        setErrorMsg(resData?.detail || `Failed to update ${transaction.type.toLowerCase()}.`);
      }
    } catch (err) {
      setErrorMsg(`Network error: ${String(err)}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-transaction-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-150 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSaving) onClose();
      }}
    >
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/90 w-full max-w-lg overflow-hidden my-8 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
                isExpense
                  ? "bg-rose-100 text-rose-600 border border-rose-200/60"
                  : "bg-emerald-100 text-emerald-600 border border-emerald-200/60"
              }`}
            >
              {isExpense ? <ArrowDownRight size={20} /> : <ArrowUpRight size={20} />}
            </div>
            <div>
              <h2 id="edit-transaction-title" className="text-base font-bold text-slate-900 flex items-center gap-2">
                Edit {transaction.type}
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    isExpense ? "bg-rose-50 text-rose-700 border border-rose-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  }`}
                >
                  #{transaction.id}
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Update details, re-categorize, or reassign accounts.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50"
            title="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        {/* Error notification banner */}
        {errorMsg && (
          <div className="mx-6 mt-4 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 animate-in fade-in">
            <AlertCircle size={15} className="shrink-0 text-rose-600" />
            <span className="font-medium">{errorMsg}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Quick Category Selection Pills */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Tag size={13} className="text-slate-400" />
              Quick Suggestions
            </label>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
              {categoryPills.map((pill) => (
                <button
                  key={pill}
                  type="button"
                  onClick={() => setCategory(pill)}
                  className={`px-2.5 py-1 rounded-xl text-xs font-semibold transition-all border ${
                    category === pill
                      ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-white"
                  }`}
                >
                  {pill}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Date Input */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <Calendar size={13} className="text-slate-400" />
                Date
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full h-10 px-3 border border-slate-300 rounded-xl bg-white text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none font-medium transition-all"
              />
            </div>

            {/* Amount Input */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center justify-between">
                <span>Amount ({currency || "₹"})</span>
                {amount && !isNaN(parseFloat(amount)) && (
                  <span className="text-[10px] text-slate-400 font-normal">
                    {formatCurrency(parseFloat(amount))}
                  </span>
                )}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400 pointer-events-none">
                  {currency === "USD" ? "$" : currency === "EUR" ? "€" : currency === "GBP" ? "£" : "₹"}
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full h-10 pl-8 pr-3 border border-slate-300 rounded-xl bg-white text-sm font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none transition-all"
                />
              </div>
            </div>

            {/* Category Input */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <Tag size={13} className="text-slate-400" />
                Category
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Food & Dining"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full h-10 px-3 border border-slate-300 rounded-xl bg-white text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none font-medium transition-all"
              />
            </div>

            {/* Account Selector */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <Landmark size={13} className="text-slate-400" />
                Account
              </label>
              <select
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                className="w-full h-10 px-3 border border-slate-300 rounded-xl bg-white text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none font-medium cursor-pointer transition-all"
              >
                {accountNames.map((acc) => (
                  <option key={acc} value={acc}>
                    {acc}
                  </option>
                ))}
                {!accountNames.includes(account) && account && (
                  <option value={account}>{account}</option>
                )}
              </select>
            </div>
          </div>

          {/* Description Input */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <FileText size={13} className="text-slate-400" />
              Description (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Swiggy order, Petrol refill, Client invoice"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full h-10 px-3 border border-slate-300 rounded-xl bg-white text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none font-medium transition-all"
            />
          </div>

          {/* Remarks Input */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <AlignLeft size={13} className="text-slate-400" />
              Remarks (Optional)
            </label>
            <input
              type="text"
              placeholder="Extra notes or references"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full h-10 px-3 border border-slate-300 rounded-xl bg-white text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none transition-all"
            />
          </div>

          {/* Actions */}
          <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              disabled={isSaving}
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold text-white transition-all shadow-md flex items-center gap-2 disabled:opacity-50 ${
                isExpense
                  ? "bg-rose-600 hover:bg-rose-700 shadow-rose-600/25"
                  : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/25"
              }`}
            >
              <Save size={14} />
              {isSaving ? "Saving Changes..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
