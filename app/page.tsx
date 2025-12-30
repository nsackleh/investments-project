import DashboardDropdown from "./components/DashboardDropdown";

export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Top bar */}
      <header className="border-b border-white/10 bg-zinc-950/70 backdrop-blur">
        <div className="mx-auto max-w-6xl px-6 py-5 flex items-center justify-between">
          <p className="text-sm font-semibold tracking-wide">
            Sack Investment Research
          </p>
          <div className="text-xs text-zinc-400 tracking-widest uppercase">
            SIR
          </div>
        </div>
      </header>

      {/* Subtle futuristic glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="absolute bottom-[-220px] right-[-200px] h-[520px] w-[520px] rounded-full bg-cyan-500/10 blur-3xl" />
      </div>

      {/* Center hero */}
      <section className="relative mx-auto max-w-6xl px-6">
        <div className="min-h-[calc(100vh-76px)] flex items-center justify-center">
          <div className="w-full max-w-2xl text-center">
            <p className="text-xs tracking-[0.35em] uppercase text-zinc-400">
              Investment Research
            </p>

            <h1 className="mt-5 text-5xl sm:text-6xl md:text-7xl font-semibold tracking-tight">
              The future is here.
            </h1>

            <div className="mt-10 flex justify-center">
              <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
                <DashboardDropdown />
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
