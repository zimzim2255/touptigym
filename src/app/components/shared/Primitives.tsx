import { X, Check } from "lucide-react";

// ─── Tag ────────────────────────────────────────────────────────────────────
export function Tag({ children, color = "default" }: { children: React.ReactNode; color?: string }) {
  const map: Record<string, string> = {
    default: "bg-pink-50 text-pink-700",
    green: "bg-emerald-50 text-emerald-700",
    blue: "bg-blue-50 text-blue-700",
    red: "bg-red-50 text-red-700",
    amber: "bg-amber-50 text-amber-700",
    gray: "bg-slate-100 text-slate-600",
    pink: "bg-pink-50 text-pink-700",
  };
  return (
    <span className={`inline-block px-2 py-0.5 text-xs font-medium border border-current/15 ${map[color] ?? map.default}`}>
      {children}
    </span>
  );
}

// ─── Btn ────────────────────────────────────────────────────────────────────
export function Btn({
  children, onClick, variant = "primary", size = "md", className = "", disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "danger" | "outline";
  size?: "sm" | "md";
  className?: string;
  disabled?: boolean;
}) {
  const base = "inline-flex items-center gap-1.5 font-medium transition-colors cursor-pointer border";
  const sizes = { sm: "px-3 py-1.5 text-xs", md: "px-4 py-2 text-sm" };
  const variants = {
    primary: "bg-pink-500 text-white border-pink-500 hover:bg-pink-600 hover:border-pink-600",
    ghost: "bg-transparent text-slate-600 border-transparent hover:bg-slate-100 hover:text-slate-900",
    danger: "bg-transparent text-red-600 border-red-200 hover:bg-red-50",
    outline: "bg-white text-slate-700 border-slate-300 hover:bg-slate-50",
  };
  return (
    <button onClick={onClick} disabled={disabled}
      className={`${base} ${sizes[size]} ${variants[variant]} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
    >
      {children}
    </button>
  );
}

// ─── Field ───────────────────────────────────────────────────────────────────
export function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

// ─── Input / Select classes ──────────────────────────────────────────────────
export const inputCls = "w-full px-3 py-2 text-sm border border-slate-300 bg-white focus:outline-none focus:border-pink-500 transition-colors";
export const selectCls = "w-full px-3 py-2 text-sm border border-slate-300 bg-white focus:outline-none focus:border-pink-500 appearance-none cursor-pointer";

// ─── Modal Shell ─────────────────────────────────────────────────────────────
export function Modal({ title, onClose, children, wide = false }: {
  title: string; onClose: () => void; children: React.ReactNode; wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }}>
      <div className={`bg-white w-full flex flex-col max-h-[90vh] ${wide ? "max-w-6xl" : "max-w-lg"}`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 shrink-0">
          <h2 className="font-semibold text-slate-900 text-sm">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 transition-colors"><X size={16} /></button>
        </div>
        <div className="overflow-y-auto flex-1 px-5 py-5">{children}</div>
      </div>
    </div>
  );
}

// ─── PageWrap ────────────────────────────────────────────────────────────────
export function PageWrap({ title, sub, action, children }: {
  title: string; sub?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "1.5rem", letterSpacing: "0.01em" }}>{title}</h1>
          {sub && <p className="text-sm text-slate-500 mt-0.5">{sub}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

// ─── Pagination ──────────────────────────────────────────────────────────────
export function Pagination({ total, page, pageSize, onPageChange }: {
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (p: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;
  const pages: number[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - page) <= 2) pages.push(i);
  }
  const items: (number | "...")[] = [];
  let prev = 0;
  for (const p of pages) {
    if (p - prev > 1) items.push("...");
    items.push(p);
    prev = p;
  }
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200">
      <p className="text-xs text-slate-500">
        {total} élément(s) — page {page}/{totalPages}
      </p>
      <div className="flex gap-1">
        <button
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          className="px-2 py-1 text-xs border border-slate-200 text-slate-500 hover:border-slate-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Préc
        </button>
        {items.map((it, i) =>
          it === "..." ? (
            <span key={`e${i}`} className="px-2 py-1 text-xs text-slate-400">…</span>
          ) : (
            <button
              key={it}
              onClick={() => onPageChange(it)}
              className={`px-2 py-1 text-xs border transition-colors ${
                it === page
                  ? "border-pink-500 bg-pink-50 text-pink-700 font-semibold"
                  : "border-slate-200 text-slate-500 hover:border-slate-400"
              }`}
            >
              {it}
            </button>
          )
        )}
        <button
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          className="px-2 py-1 text-xs border border-slate-200 text-slate-500 hover:border-slate-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Suiv
        </button>
      </div>
    </div>
  );
}
