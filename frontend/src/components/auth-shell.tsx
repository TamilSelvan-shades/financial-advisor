import {
  ArrowLeft,
  Building2,
  Database,
  Fingerprint,
  Landmark,
  LockKeyhole,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

interface AuthShellProps {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}

export function AuthShell({
  eyebrow,
  title,
  description,
  children,
}: AuthShellProps) {
  return (
    <main className="grid min-h-[100svh] bg-[#102d29] text-[#15332f] lg:grid-cols-[minmax(0,1.15fr)_minmax(460px,0.85fr)]">
      <section className="relative flex min-h-[230px] flex-col overflow-hidden bg-[#102d29] px-5 py-5 text-white sm:min-h-[310px] sm:px-8 sm:py-7 lg:min-h-[100svh] lg:px-12 lg:py-9 xl:px-16">
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "linear-gradient(rgba(167, 243, 208, 0.09) 1px, transparent 1px), linear-gradient(90deg, rgba(167, 243, 208, 0.09) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
          aria-hidden="true"
        />
        <div
          className="absolute inset-y-0 right-[18%] hidden w-px border-l border-dashed border-emerald-200/15 lg:block"
          aria-hidden="true"
        />

        <div className="relative z-10 flex items-center justify-between">
          <Link
            href="/"
            className="flex w-fit items-center gap-2.5"
            aria-label="Ledgerly home"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-emerald-300 text-[#15332f]">
              <Landmark size={18} />
            </span>
            <span className="text-lg font-extrabold tracking-tight">
              Ledgerly
            </span>
          </Link>
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.15em] text-emerald-100/50">
            <span className="soft-pulse h-1.5 w-1.5 rounded-full bg-[#e2b94d]" />
            Access gateway
          </div>
        </div>

        <div className="relative z-10 flex flex-1 flex-col justify-center py-6 sm:py-9 lg:py-16">
          <div className="auth-observatory max-w-3xl">
            <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.17em] text-emerald-200/65">
              <span>Pre-authentication</span>
              <span className="h-px w-10 bg-[#df6c4f]" />
              <span>No workspace loaded</span>
            </div>
            <div className="mt-4 max-w-2xl text-3xl font-extrabold leading-[1.06] tracking-tight sm:text-4xl lg:text-5xl xl:text-6xl">
              Your data stays sealed.
              <span className="block text-emerald-200">Until you sign in.</span>
            </div>

            <div className="mt-8 hidden sm:block lg:mt-12">
              <div className="grid grid-cols-[1fr_32px_1fr_32px_1fr] items-center lg:grid-cols-[1fr_52px_1fr_52px_1fr]">
                <div className="auth-signal border border-emerald-100/15 bg-black/10 p-4 lg:p-5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-emerald-300/10 text-emerald-200">
                    <Fingerprint size={18} />
                  </div>
                  <div className="mt-4 font-mono text-[9px] uppercase tracking-[0.16em] text-emerald-100/40">
                    Identity
                  </div>
                  <div className="mt-1 text-sm font-bold text-white">
                    Waiting for sign-in
                  </div>
                </div>

                <div className="auth-signal auth-signal-delayed flex items-center px-2">
                  <span className="h-px flex-1 border-t border-dashed border-emerald-200/25" />
                  <span className="h-1.5 w-1.5 rounded-full bg-[#e2b94d]" />
                </div>

                <div className="auth-signal auth-signal-delayed border border-emerald-100/15 bg-black/10 p-4 lg:p-5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[#9fc5ef]/10 text-[#9fc5ef]">
                    <Building2 size={18} />
                  </div>
                  <div className="mt-4 font-mono text-[9px] uppercase tracking-[0.16em] text-emerald-100/40">
                    Tenant
                  </div>
                  <div className="mt-1 text-sm font-bold text-white">
                    Not identified
                  </div>
                </div>

                <div className="auth-signal auth-signal-late flex items-center px-2">
                  <span className="h-px flex-1 border-t border-dashed border-emerald-200/25" />
                  <LockKeyhole size={11} className="text-[#df6c4f]" />
                </div>

                <div className="auth-signal auth-signal-late border border-emerald-100/15 bg-black/10 p-4 lg:p-5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[#f29b82]/10 text-[#f29b82]">
                    <Database size={18} />
                  </div>
                  <div className="mt-4 font-mono text-[9px] uppercase tracking-[0.16em] text-emerald-100/40">
                    Workspace
                  </div>
                  <div className="mt-1 text-sm font-bold text-white">
                    Data locked
                  </div>
                </div>
              </div>

              <div className="mt-5 flex items-center gap-2 border-l-2 border-[#e2b94d] bg-white/5 px-4 py-3 text-xs text-emerald-50/65">
                <LockKeyhole size={14} className="shrink-0 text-[#e2b94d]" />
                No account or tenant data is loaded before authentication.
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 flex items-center justify-between border-t border-white/10 pt-4">
          <div className="flex items-center gap-2 text-xs font-medium text-emerald-50/55">
            <LockKeyhole size={14} className="text-emerald-300" />
            Tenant-isolated records
          </div>
          <div className="hidden font-mono text-[9px] uppercase tracking-[0.16em] text-emerald-100/30 sm:block">
            One record · every decision
          </div>
        </div>
      </section>

      <section className="relative flex items-center justify-center border-t-[10px] border-[#e2b94d] bg-[#f7f7f2] px-5 py-12 sm:px-10 lg:min-h-[100svh] lg:border-l-[10px] lg:border-t-0 lg:px-14 xl:px-20">
        <Link
          href="/"
          className="absolute right-6 top-6 flex items-center gap-2 text-xs font-bold text-[#5d716d] transition-colors hover:text-[#15332f] lg:right-10 lg:top-9"
        >
          <ArrowLeft size={14} />
          Home
        </Link>
        <div className="w-full max-w-[430px] page-reveal">
          <div className="mb-8 flex items-end justify-between border-b border-[#15332f]/15 pb-4">
            <div>
              <div className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#167d6b]">
                {eyebrow}
              </div>
              <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-[#5d716d]">
                Secure access
              </div>
            </div>
            <div className="font-mono text-4xl font-light text-[#15332f]/15">
              01
            </div>
          </div>
          <h1 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
            {title}
          </h1>
          <p className="mt-3 text-sm leading-6 text-[#5d716d]">{description}</p>
          <div className="mt-9">{children}</div>
        </div>
      </section>
    </main>
  );
}
