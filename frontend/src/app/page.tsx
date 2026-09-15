import Link from "next/link";
import { ArrowRight, Activity, Shield, Sparkles } from "lucide-react";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="px-6 py-4 flex items-center justify-between border-b bg-white">
        <div className="font-bold text-xl tracking-tighter">AI Advisor</div>
        <nav className="flex items-center gap-4">
          <Link href="/login" className="text-sm font-medium hover:underline underline-offset-4">Log in</Link>
          <Link href="/register" className="inline-flex h-9 items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-slate-50 transition-colors hover:bg-slate-900/90">
            Sign up
          </Link>
        </nav>
      </header>

      <main className="flex-1">
        <section className="w-full py-24 md:py-32 lg:py-48 flex flex-col items-center justify-center text-center px-4">
          <div className="space-y-4 max-w-[800px]">
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
              Take Control of Your <span className="text-blue-600">Financial Future</span>
            </h1>
            <p className="mx-auto max-w-[600px] text-slate-500 md:text-xl leading-relaxed">
              Meet your personal AI financial advisor. Track expenses, monitor loans, manage investments, and get intelligent insights automatically.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Link href="/register" className="inline-flex h-12 items-center justify-center rounded-md bg-blue-600 px-8 text-sm font-medium text-white transition-colors hover:bg-blue-700 w-full sm:w-auto">
                Get Started for Free <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
              <Link href="/login" className="inline-flex h-12 items-center justify-center rounded-md border border-slate-200 bg-white px-8 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-100 hover:text-slate-900 w-full sm:w-auto">
                Log In
              </Link>
            </div>
          </div>
        </section>

        <section className="w-full py-16 bg-slate-50">
          <div className="container mx-auto px-4 md:px-6">
            <div className="grid gap-8 md:grid-cols-3">
              <div className="flex flex-col items-center text-center space-y-2 p-6 bg-white rounded-xl shadow-sm border border-slate-100">
                <div className="p-3 rounded-full bg-blue-100 text-blue-600 mb-2">
                  <Activity className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold">Real-time Tracking</h3>
                <p className="text-slate-500">Monitor your cash flow, budgets, and net worth all in one intuitive dashboard.</p>
              </div>
              <div className="flex flex-col items-center text-center space-y-2 p-6 bg-white rounded-xl shadow-sm border border-slate-100">
                <div className="p-3 rounded-full bg-purple-100 text-purple-600 mb-2">
                  <Sparkles className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold">AI Insights</h3>
                <p className="text-slate-500">Chat with your AI advisor to get tailored advice, parse receipts, and log expenses via Telegram.</p>
              </div>
              <div className="flex flex-col items-center text-center space-y-2 p-6 bg-white rounded-xl shadow-sm border border-slate-100">
                <div className="p-3 rounded-full bg-green-100 text-green-600 mb-2">
                  <Shield className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold">Bank-Grade Security</h3>
                <p className="text-slate-500">Your data is encrypted and secure. We use enterprise-grade architecture to keep your finances private.</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="w-full border-t py-6 flex items-center justify-center bg-white">
        <p className="text-sm text-slate-500 text-center">
          © {new Date().getFullYear()} AI Advisor. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
