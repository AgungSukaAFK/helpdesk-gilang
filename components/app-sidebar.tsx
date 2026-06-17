"use client";

import * as React from "react";
import { redirect, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar";
import { NavMain } from "@/components/nav-main";
import { NavUser } from "./nav-user";
import {
  Bot,
  LayoutDashboard,
  FileBox,
  BookOpen,
  Info,
  Clock,
  ListTodo,
  ClipboardList,
  Eye,
  BarChart3,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import { ROLES, normalizeRole } from "@/lib/auth/roles";

type NavItem = { title: string; url: string; icon?: LucideIcon };

// Menu utama per role — satu sumber kebenaran, dikonsumsi satu komponen NavMain generik.
function getNavItemsByRole(role: string | null | undefined): NavItem[] {
  switch (normalizeRole(role)) {
    case ROLES.ADMIN:
      return [
        { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
        { title: "Monitoring Permintaan", url: "/permintaan-desain-admin", icon: Eye },
        { title: "Laporan KPI", url: "/laporan-kpi", icon: BarChart3 },
        { title: "User Management", url: "/user-management", icon: Bot },
      ];
    case ROLES.DESIGNER:
      return [
        { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
        { title: "Antrean Tugas", url: "/permintaan-desain-designer", icon: ListTodo },
        { title: "Tugas Saya", url: "/permintaan-desain-designer/tugas-saya", icon: ClipboardList },
        { title: "Riwayat Pengerjaan", url: "/riwayat-pengerjaan", icon: Clock },
      ];
    case ROLES.REQUESTER:
    default:
      return [
        { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
        { title: "Permintaan Desain", url: "/permintaan-desain", icon: FileBox },
        { title: "Riwayat", url: "/riwayat", icon: Clock },
      ];
  }
}

const navSecondary: NavItem[] = [
  { title: "Dokumentasi", url: "/dokumentasi", icon: BookOpen },
  { title: "Tentang App", url: "/tentang-app", icon: Info },
];

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const currentPath = usePathname();
  const supabase = createClient();

  const [user, setUser] = React.useState<any>(null);
  const [profile, setProfile] = React.useState<any>(null);

  React.useEffect(() => {
    const getUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (!error) setUser(data.user);
      if (!data.user) redirect("auth/login");
      const profileRes = await supabase
        .from("users")
        .select("*")
        .eq("id", data.user.id)
        .single();
      if (profileRes.data) setProfile(profileRes.data);
    };
    getUser();
  }, [supabase]);

  const markActive = (items: NavItem[]) =>
    items.map((item) => ({
      ...item,
      isActive: currentPath.includes(item.url),
    }));

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <div>
          <Image
            src={"/lourdes.png"}
            width={500}
            height={500}
            alt="Lourdes Autoparts"
          />
        </div>
      </SidebarHeader>

      <SidebarContent>
        <NavMain label="Menu" items={markActive(getNavItemsByRole(profile?.role))} />
        <NavMain label="About" items={markActive(navSecondary)} />
      </SidebarContent>

      <SidebarFooter>
        {user && (
          <NavUser
            user={{
              avatar: `https://ui-avatars.com/api/?name=${user.email}`,
              email: user.email || "",
              name: profile?.name || "-",
            }}
          />
        )}
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
