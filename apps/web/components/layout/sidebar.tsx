"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FundCard } from "@/features/funds/components/fund-card";
import type { FundView } from "@/features/funds/types";

const NAV_GROUPS = [
  {
    label: "Tổng quan",
    items: [
      { href: "/dashboard", label: "Tổng quan", icon: "📊" },
      { href: "/chat", label: "Trợ lý AI", icon: "✨" },
    ],
  },
  {
    label: "Tài chính",
    items: [
      { href: "/transactions", label: "Giao dịch", icon: "💳" },
      { href: "/reports", label: "Báo cáo", icon: "📈" },
      { href: "/goals", label: "Tiết kiệm & Đầu tư", icon: "🏦" },
      { href: "/finance-settings", label: "Cài đặt", icon: "⚙️" },
    ],
  },
  {
    label: "Gia đình",
    items: [
      { href: "/weekly", label: "Công việc", icon: "✅" },
      { href: "/important-dates", label: "Ngày kỷ niệm", icon: "🗓️" },
      { href: "/family/invite", label: "Thành viên", icon: "👨‍👩‍👦" },
    ],
  },
];

export function Sidebar({
  funds,
  onNavigate,
}: {
  funds: FundView[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  function NavItem({
    href,
    label,
    icon,
  }: {
    href: string;
    label: string;
    icon: string;
  }) {
    const active = pathname === href;
    return (
      <Link
        href={href}
        onClick={() => onNavigate?.()}
        className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
          active
            ? "bg-emerald-50 font-medium text-emerald-800"
            : "text-stone-600 hover:bg-stone-50 hover:text-stone-900"
        }`}
      >
        <span className="w-5 text-center text-base leading-none">{icon}</span>
        <span>{label}</span>
      </Link>
    );
  }

  return (
    <aside className="flex flex-col overflow-y-auto border-r border-stone-100 bg-white">
      <nav className="flex-1 px-3 py-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-5">
            <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-stone-400">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavItem key={item.href} {...item} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-stone-100 px-3 py-3">
        <div className="mb-4 space-y-2">
          <p className="px-3 text-[10px] font-semibold uppercase tracking-widest text-stone-400">
            Quỹ của bạn
          </p>
          {funds.length === 0
            ? [1, 2].map((i) => (
                <div
                  key={i}
                  className="h-[68px] animate-pulse rounded-lg bg-stone-100"
                />
              ))
            : funds.map((f) => <FundCard key={f.id} fund={f} />)}
        </div>
      </div>
    </aside>
  );
}
