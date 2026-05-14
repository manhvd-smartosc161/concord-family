"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { FundCard } from "@/features/funds/components/fund-card";
import type { FundView } from "@/features/funds/types";

type NavGroup = {
  label: string;
  items: Array<{ href: string; label: string; icon: string }>;
};

function getNavGroups(t: ReturnType<typeof useTranslations>): NavGroup[] {
  return [
    {
      label: t("overview"),
      items: [
        { href: "/dashboard", label: t("overview"), icon: "📊" },
        { href: "/chat", label: t("ai_assistant"), icon: "✨" },
      ],
    },
    {
      label: t("finance"),
      items: [
        { href: "/transactions", label: t("transactions"), icon: "💳" },
        { href: "/reports", label: t("reports"), icon: "📈" },
        { href: "/goals", label: t("savings_investment"), icon: "🏦" },
        { href: "/finance-settings", label: t("settings"), icon: "⚙️" },
      ],
    },
    {
      label: t("family_group"),
      items: [
        { href: "/weekly", label: t("tasks"), icon: "✅" },
        { href: "/important-dates", label: t("anniversaries"), icon: "🗓️" },
        { href: "/family/invite", label: t("members"), icon: "👨‍👩‍👦" },
      ],
    },
  ];
}

export function Sidebar({
  funds,
  onNavigate,
}: {
  funds: FundView[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const navGroups = getNavGroups(t);

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
            ? "bg-emerald-50 dark:bg-emerald-950/40 font-medium text-emerald-800 dark:text-emerald-300"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        }`}
      >
        <span className="w-5 text-center text-base leading-none">{icon}</span>
        <span>{label}</span>
      </Link>
    );
  }

  return (
    <aside className="flex flex-col overflow-y-auto border-r border-border bg-card">
      <nav className="flex-1 px-3 py-4">
        {navGroups.map((group) => (
          <div key={group.label} className="mb-5">
            <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
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

      <div className="border-t border-border px-3 py-3">
        <div className="mb-4 space-y-2">
          <p className="px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            {t("your_funds")}
          </p>
          {funds.length === 0
            ? [1, 2].map((i) => (
                <div
                  key={i}
                  className="h-[68px] animate-pulse rounded-lg bg-muted"
                />
              ))
            : funds.map((f) => <FundCard key={f.id} fund={f} />)}
        </div>
      </div>
    </aside>
  );
}
