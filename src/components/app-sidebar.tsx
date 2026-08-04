"use client"

import * as React from "react"
import {
  Home,
  BookOpen,
  Building2,
  Store,
  Package,
  QrCode,
  Key,
  Zap,
  FileText,
  Layers,
  Settings2,
  GalleryVerticalEnd,
  AudioWaveform,
  Command,
  SquareTerminal,
  Bot,
} from "lucide-react"

import { useAbility, useCurrentUser } from "@/components/auth/ability-context"
import { isPlatformRole } from "@/lib/auth/abilities"
import type { UserRole } from "@prisma/client"

import { NavMain } from "@/components/nav-main"
import { NavProjects } from "@/components/nav-projects"
import { NavUser } from "@/components/nav-user"
import { TeamSwitcher } from "@/components/team-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"

const data = {
  user: {
    name: "shadcn",
    email: "m@example.com",
    avatar: "",
  },
  teams: [
    {
      name: "Diem",
      logo: GalleryVerticalEnd,
      plan: "Enterprise",
    }
  ],
  navMain: [
    {
      title: "Home",
      url: "/",
      icon: Home,
      // isActive: true,
      // No items to make it non-collapsible
    },
    {
      title: "Playground",
      url: "#",
      icon: SquareTerminal,
      // isActive: true,
      items: [
        {
          title: "History",
          url: "#",
        },
        {
          title: "Starred",
          url: "#",
        },
        {
          title: "Settings",
          url: "#",
        },
      ],
    },
    {
      title: "Models",
      url: "#",
      icon: Bot,
      items: [
        // {
        //   title: "Genesis",
        //   url: "#",
        // },
        {
          title: "Stock",
          url: "/stock",
        },
        {
          title: "Functions",
          url: "/functions",
        },
      ],
    },
    {
      title: "Management",
      url: "#",
      icon: Settings2,
      // isActive: true,
      items: [
        {
          title: "Companies",
          url: "/companies",
        },
        {
          title: "Stores",
          url: "/store",
        },
        {
          title: "Products",
          url: "/products",
        },
        {
          title: "Users",
          url: "/users",
        },
        {
          title: "Wallets",
          url: "/wallets",
        },
        {
          title: "Precios",
          url: "/prices",
        },
        {
          title: "Costos",
          url: "/costs",
        },
      ],
    },
    {
      title: "Cards & QR",
      url: "#",
      icon: QrCode,
      items: [
        {
          title: "QR Codes",
          url: "/qr",
        },
        {
          title: "Remisión de tarjetas",
          url: "/cards/reassign",
        },
        {
          title: "Manufacturing Batches",
          url: "/batches",
        },
        {
          title: "Digital Keys",
          url: "/keys",
        },
      ],
    },
    {
      title: "Operations",
      url: "#",
      icon: Zap,
      items: [
        {
          title: "Activate Card",
          url: "/activate",
        },
        {
          title: "Scan QR",
          url: "/scan",
        },
        {
          title: "Buy Codes",
          url: "/codes/purchase",
        },
        {
          title: "Mi Wallet",
          url: "/wallet",
        },
        {
          title: "Activations",
          url: "/activations",
        },
        {
          title: "Invoices",
          url: "/invoices",
        },
        {
          title: "Draft",
          url: "/draft",
        },
      ],
    },
    {
      title: "Analytics",
      url: "#",
      icon: Layers,
      items: [
        {
          title: "Dashboard",
          url: "/analytics",
        },
        {
          title: "Mi Empresa",
          url: "/overview",
        },
      ],
    },
    {
      title: "Documentation",
      url: "#",
      icon: BookOpen,
      items: [
        {
          title: "Introduction",
          url: "#",
        },
        {
          title: "Get Started",
          url: "#",
        },
        {
          title: "Tutorials",
          url: "#",
        },
        {
          title: "Changelog",
          url: "#",
        },
      ],
    },
    {
      title: "Settings",
      url: "#",
      icon: Settings2,
      items: [
        {
          title: "General",
          url: "#",
        },
        {
          title: "Team",
          url: "#",
        },
        {
          title: "Billing",
          url: "#",
        },
        {
          title: "Limits",
          url: "#",
        },
      ],
    }
  ],
  projects: [
    {
      name: "Administration",
      url: "/admin",
      icon: GalleryVerticalEnd,
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const ability = useAbility();
  const currentUser = useCurrentUser();

  const navMainWithError = React.useMemo(() => {
    const PLATFORM_ONLY_URLS = new Set(["/cards/reassign", "/qr/create"]);
    const PLACEHOLDER_URLS = new Set(["/stock", "/functions"]);
    const PERMISSIONS: Record<string, [string, string]> = {
      "/companies": ["read", "Company"],
      "/store": ["read", "Store"],
      "/products": ["read", "Product"],
      "/qr": ["read", "Card"],
      "/batches": ["read", "Card"],
      "/keys": ["read", "Key"],
      "/activate": ["activate", "Card"],
      "/scan": ["activate", "Card"],
      "/codes/purchase": ["create", "CodePurchase"],
      "/activations": ["read", "CardActivation"],
      "/invoices": ["read", "Invoice"],
      "/draft": ["create", "Invoice"],
      "/users": ["read", "User"],
      "/wallets": ["manage", "Wallet"],
      "/wallet": ["read", "Wallet"],
      "/prices": ["read", "CompanyProductPrice"],
      "/costs": ["manage", "ProductCost"],
      "/overview": ["read", "Company"],
      "/analytics": ["read", "AuditLog"],
      "/admin": ["manage", "all"],
    };

    function isNavItemVisible(url: string, role: UserRole | undefined): boolean {
      if (!role) return false;
      if (url === "#" || PLACEHOLDER_URLS.has(url)) return false;
      if (url === "/") return true;
      if (PLATFORM_ONLY_URLS.has(url)) return isPlatformRole(role);
      // Operador: activar/escanear/comprar, sin listado de QR.
      if (url === "/qr" && role === "OPERATOR") return false;
      // Analytics global solo plataforma; OWNER usa /overview (su compañía).
      if (url === "/analytics" && !isPlatformRole(role)) return false;
      const perm = PERMISSIONS[url];
      if (!perm) return false;
      return ability.can(perm[0] as any, perm[1] as any);
    }

    return data.navMain
      .map((group) => {
        const newGroup = { ...group };

        if (newGroup.url !== "#" && !newGroup.items) {
          if (!isNavItemVisible(newGroup.url, currentUser?.role)) return null;
        }

        if (newGroup.items) {
          newGroup.items = newGroup.items.filter((item) =>
            isNavItemVisible(item.url, currentUser?.role),
          );
        }

        return newGroup;
      })
      .filter((group): group is typeof data.navMain[0] => {
        if (!group) return false;
        if (group.url === "#" && group.items && group.items.length === 0) return false;
        if (group.url !== "#" && !group.items) return true;
        if (group.items && group.items.length === 0) return false;
        return true;
      });
  }, [ability, currentUser]);

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={data.teams} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMainWithError} />
        {/* <NavProjects projects={data.projects} /> */}
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

// "use client"

// import * as React from "react"
// import {
//   Home,
//   BookOpen,
//   Building2,
//   Store,
//   Package,
//   QrCode,
//   Key,
//   Zap,
//   FileText,
//   Layers,
//   Settings2,
//   GalleryVerticalEnd,
//   AudioWaveform,
//   Command,
// } from "lucide-react"

// import { NavMain } from "@/components/nav-main"
// import { NavProjects } from "@/components/nav-projects"
// import { NavUser } from "@/components/nav-user"
// import { TeamSwitcher } from "@/components/team-switcher"
// import {
//   Sidebar,
//   SidebarContent,
//   SidebarFooter,
//   SidebarHeader,
//   SidebarRail,
// } from "@/components/ui/sidebar"

// const data = {
//   user: {
//     name: "shadcn",
//     email: "m@example.com",
//     avatar: "/avatars/shadcn.jpg",
//   },
//   teams: [
//     {
//       name: "Diem",
//       logo: GalleryVerticalEnd,
//       plan: "Enterprise",
//     }
//   ],
//   navMain: [
//     {
//       title: "Home",
//       url: "/",
//       icon: Home,
//       // isActive: true,
//       // Sin items para que no sea colapsible
//     },
//     {
//       title: "Gestión",
//       url: "#",
//       icon: Settings2,
//       // isActive: true,
//       items: [
//         {
//           title: "Compañías",
//           url: "/companies",
//         },
//         {
//           title: "Tiendas",
//           url: "/store",
//         },
//         {
//           title: "Productos",
//           url: "/products",
//         },
//       ],
//     },
//     {
//       title: "Tarjetas y QR",
//       url: "#",
//       icon: QrCode,
//       items: [
//         {
//           title: "Códigos QR",
//           url: "/qr",
//         },
//         {
//           title: "Lotes de Fabricación",
//           url: "/batches",
//         },
//         {
//           title: "Claves Digitales",
//           url: "/keys",
//         },
//       ],
//     },
//     {
//       title: "Operaciones",
//       url: "#",
//       icon: Zap,
//       items: [
//         {
//           title: "Activaciones",
//           url: "/activations",
//         },
//         {
//           title: "Facturas",
//           url: "/invoices",
//         },
//         {
//           title: "Draft",
//           url: "/draft",
//         },
//       ],
//     },
//     {
//       title: "Análisis",
//       url: "#",
//       icon: Layers,
//       items: [
//         {
//           title: "Dashboard",
//           url: "/analytics",
//         },
//       ],
//     },
//     {
//       title: "Documentation",
//       url: "#",
//       icon: BookOpen,
//       items: [
//         {
//           title: "Introduction",
//           url: "#",
//         },
//         {
//           title: "Get Started",
//           url: "#",
//         },
//         {
//           title: "Tutorials",
//           url: "#",
//         },
//         {
//           title: "Changelog",
//           url: "#",
//         },
//       ],
//     },
//     {
//       title: "Settings",
//       url: "#",
//       icon: Settings2,
//       items: [
//         {
//           title: "General",
//           url: "#",
//         },
//         {
//           title: "Team",
//           url: "#",
//         },
//         {
//           title: "Billing",
//           url: "#",
//         },
//         {
//           title: "Limits",
//           url: "#",
//         },
//       ],
//     }
//   ],
//   projects: [
//     {
//       name: "Administración",
//       url: "/admin",
//       icon: GalleryVerticalEnd,
//     },
//   ],
// }

// export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
//   return (
//     <Sidebar collapsible="icon" {...props}>
//       <SidebarHeader>
//         <TeamSwitcher teams={data.teams} />
//       </SidebarHeader>
//       <SidebarContent>
//         <NavMain items={data.navMain} />
//         {/* <NavProjects projects={data.projects} /> */}
//       </SidebarContent>
//       <SidebarFooter>
//         <NavUser user={data.user} />
//       </SidebarFooter>
//       <SidebarRail />
//     </Sidebar>
//   )
// }