"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Building2, Settings, PanelLeftClose, PanelLeft } from "lucide-react";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/customers", label: "Customers", icon: Building2 },
  { href: "/settings", label: "Settings", icon: Settings },
];

const STORAGE_KEY = "sidebar-collapsed";

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "true") setCollapsed(true);
    setMounted(true);
  }, []);

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }

  return (
    <aside
      className={cn(
        "flex h-screen flex-col bg-[#003DA5] transition-[width] duration-200 ease-out",
        collapsed ? "w-16" : "w-64",
        !mounted && "invisible"
      )}
    >
      {/* Logo + collapse toggle */}
      <div
        className={cn(
          "flex items-center border-b border-white/15 py-5",
          collapsed ? "justify-center px-2" : "gap-3 px-6"
        )}
      >
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded bg-white/20">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className="h-5 w-5 text-white"
            aria-hidden="true"
          >
            <path
              d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7l-9-5z"
              fill="currentColor"
              fillOpacity="0.9"
            />
          </svg>
        </div>
        {!collapsed && (
          <>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold leading-tight text-white truncate">ELS Builder</p>
              <p className="text-[11px] leading-tight text-white/60 truncate">Requirements Management</p>
            </div>
            <button
              onClick={toggle}
              className="flex-shrink-0 cursor-pointer rounded p-1 text-white/60 hover:bg-white/10 hover:text-white transition-colors"
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
            >
              <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
            </button>
          </>
        )}
      </div>

      {collapsed && (
        <div className="px-2 pt-3">
          <button
            onClick={toggle}
            className="flex w-full cursor-pointer items-center justify-center rounded p-2 text-white/70 hover:bg-white/10 hover:text-white transition-colors"
            aria-label="Expand sidebar"
            title="Expand sidebar"
          >
            <PanelLeft className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Navigation */}
      <nav className={cn("flex-1 space-y-0.5 py-4", collapsed ? "px-2" : "px-3")}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={cn(
                "flex items-center rounded-md text-sm font-medium transition-colors duration-150 cursor-pointer",
                collapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2.5",
                isActive
                  ? "bg-white/15 text-white"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              )}
            >
              <Icon className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div className="border-t border-white/15 px-6 py-4">
          <p className="text-[11px] text-white/40">PayIt Gov Platform</p>
        </div>
      )}
    </aside>
  );
}
