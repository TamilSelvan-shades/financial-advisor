import {
  ArrowRight,
  Landmark,
  LockKeyhole,
  ReceiptText,
  ScanLine,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import LandingPreviewAndPricing from "@/components/landing-preview-and-pricing";

const cashFlowBars = [44, 62, 51, 74, 67, 88, 79, 96, 84, 108, 102, 124];

export default function Home() {
  return (
    <div className="min-h-screen bg-[#fbf9f4] text-[#15332f]">
      {/* Top Navigation */}
      <header className="absolute inset-x-0 top-0 z-30 border-b border-white/10">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link
            href="/"
            className="flex items-center gap-2.5"
            aria-label="Ledgerly home"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[#41e296] text-[#122b22]">
              <Landmark size={17} />
            </span>
            <span className="text-base font-extrabold tracking-tight text-white font-serif">
              Ledgerly
            </span>
          </Link>

          {/* Navigation Links */}
          <nav
            className="flex items-center gap-1 sm:gap-3"
            aria-label="Public navigation"
          >
            <Link
              href="/demo"
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs sm:text-sm font-semibold text-[#41e296] transition-colors hover:bg-white/10"
            >
              <Sparkles size={14} />
              <span>Live Demo</span>
            </Link>

            <Link
              href="#pricing"
              className="rounded-md px-3 py-1.5 text-xs sm:text-sm font-semibold text-emerald-50/75 transition-colors hover:bg-white/10 hover:text-white"
            >
              Pricing
            </Link>

            <Link
              href="/login"
              className="rounded-md px-3 py-1.5 text-xs sm:text-sm font-semibold text-emerald-50/75 transition-colors hover:bg-white/10 hover:text-white"
            >
              Sign in
            </Link>

            <Link
              href="/register"
              className="rounded-md bg-[#41e296] px-4 py-2 text-xs sm:text-sm font-bold text-[#122b22] shadow transition-colors hover:bg-emerald-300"
            >
              Create account
            </Link>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="relative flex min-h-[90vh] items-center overflow-hidden bg-[#122b22] px-5 pb-24 pt-28 text-white sm:px-8">
          <div
            className="absolute inset-x-0 bottom-0 flex h-[46%] items-end gap-2 px-3 opacity-20 sm:gap-4 sm:px-8"
            aria-hidden="true"
          >
            {cashFlowBars.map((height, index) => (
              <div
                key={index}
                className="flex-1 border-t border-[#41e296]/70 bg-[#41e296]/20"
                style={{ height: `${height}px` }}
              />
            ))}
          </div>
          <div
            className="absolute inset-x-0 bottom-[46%] border-t border-dashed border-emerald-100/15"
            aria-hidden="true"
          />

          <div className="relative z-10 mx-auto w-full max-w-7xl">
            <div className="max-w-3xl page-reveal">
              <div className="mb-6 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#41e296]">
                <span className="h-px w-8 bg-[#41e296]" />
                Personal financial command center
              </div>
              <h1 className="max-w-2xl font-serif text-5xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
                Ledgerly
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-emerald-50/70 sm:text-xl">
                A private command center that turns accounts, spending, debt,
                investments, and tax planning into decisions you can act on.
              </p>

              {/* Hero Action CTAs */}
              <div className="mt-9 flex flex-col sm:flex-row gap-3">
                <Link
                  href="/register"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-[#41e296] px-6 text-sm font-bold text-[#122b22] shadow transition-colors hover:bg-emerald-300"
                >
                  Open your workspace <ArrowRight size={16} />
                </Link>

                <Link
                  href="/demo"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-md border border-[#41e296]/60 bg-[#41e296]/15 px-6 text-sm font-bold text-[#41e296] shadow-sm transition-all hover:bg-[#41e296] hover:text-[#122b22]"
                >
                  <Sparkles size={16} />
                  Explore Live Demo
                </Link>

                <Link
                  href="/login"
                  className="inline-flex h-12 items-center justify-center rounded-md border border-white/15 px-6 text-sm font-semibold text-white transition-colors hover:bg-white/10"
                >
                  Return to dashboard
                </Link>
              </div>
            </div>

            <div className="mt-16 grid max-w-3xl grid-cols-2 gap-x-8 gap-y-5 border-t border-white/10 pt-6 sm:grid-cols-4">
              <div>
                <div className="font-mono text-lg font-semibold text-[#41e296]">
                  24/7
                </div>
                <div className="mt-1 text-xs text-emerald-50/45">
                  Ledger monitoring
                </div>
              </div>
              <div>
                <div className="font-mono text-lg font-semibold text-[#41e296]">
                  6
                </div>
                <div className="mt-1 text-xs text-emerald-50/45">
                  Display currencies
                </div>
              </div>
              <div>
                <div className="font-mono text-lg font-semibold text-[#41e296]">
                  3
                </div>
                <div className="mt-1 text-xs text-emerald-50/45">
                  Input channels
                </div>
              </div>
              <div>
                <div className="font-mono text-lg font-semibold text-[#41e296]">
                  1
                </div>
                <div className="mt-1 text-xs text-emerald-50/45">
                  Private workspace
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Feature Grid: One Financial Record */}
        <section className="border-b border-[#15332f]/10 bg-[#fbf9f4] py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <div className="grid gap-10 lg:grid-cols-[0.8fr_2fr]">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#167d6b]">
                  One financial record
                </div>
                <h2 className="mt-3 text-3xl font-serif font-extrabold leading-tight tracking-tight text-[#15332f]">
                  Less admin. Better decisions.
                </h2>
              </div>
              <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
                <div className="border-l border-[#15332f]/15 pl-5">
                  <ReceiptText size={20} className="text-[#df6c4f]" />
                  <h3 className="mt-4 font-bold text-[#15332f]">Cash flow</h3>
                  <p className="mt-2 text-sm leading-6 text-[#48615d]">
                    Transactions, budgets, bills, and safe-to-spend guidance in
                    one view.
                  </p>
                </div>
                <div className="border-l border-[#15332f]/15 pl-5">
                  <TrendingUp size={20} className="text-[#3f72af]" />
                  <h3 className="mt-4 font-bold text-[#15332f]">Wealth</h3>
                  <p className="mt-2 text-sm leading-6 text-[#48615d]">
                    Track investments, goals, credit health, and net worth over
                    time.
                  </p>
                </div>
                <div className="border-l border-[#15332f]/15 pl-5">
                  <ScanLine size={20} className="text-[#d4a02e]" />
                  <h3 className="mt-4 font-bold text-[#15332f]">Fast capture</h3>
                  <p className="mt-2 text-sm leading-6 text-[#48615d]">
                    Log by voice, scan receipts, or ingest statements without
                    manual cleanup.
                  </p>
                </div>
                <div className="border-l border-[#15332f]/15 pl-5">
                  <LockKeyhole size={20} className="text-[#167d6b]" />
                  <h3 className="mt-4 font-bold text-[#15332f]">Private by design</h3>
                  <p className="mt-2 text-sm leading-6 text-[#48615d]">
                    Tenant-isolated records with an instant privacy mask for
                    sensitive values.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Interactive "See How Ledgerly Works" Product Preview & Pricing Table */}
        <LandingPreviewAndPricing />
      </main>

      {/* Footer */}
      <footer className="bg-[#fbf9f4] py-8 border-t border-[#15332f]/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 text-xs text-[#48615d] sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div className="flex items-center gap-3">
            <span className="font-bold text-[#15332f]">© {new Date().getFullYear()} Ledgerly</span>
            <span>•</span>
            <span>Your financial record, made useful.</span>
          </div>
          <div className="flex items-center gap-4 text-xs font-semibold">
            <Link href="/demo" className="hover:text-[#15332f] transition-colors">
              Live Demo
            </Link>
            <Link href="#pricing" className="hover:text-[#15332f] transition-colors">
              Pricing
            </Link>
            <Link href="/register" className="hover:text-[#15332f] transition-colors">
              Create Account
            </Link>
            <Link href="/login" className="hover:text-[#15332f] transition-colors">
              Sign In
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
