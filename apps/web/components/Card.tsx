export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-white/[0.06] bg-surface p-5 shadow-card ${className}`}>
      {children}
    </div>
  );
}
