import DashboardDropdown from "./components/DashboardDropdown";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 p-10">
      <h1 className="text-4xl font-semibold">Sack Investment Research</h1>
      <p className="text-zinc-600">Analyst Nicholas Sackleh</p>

      <DashboardDropdown />

    </main>
  );
}