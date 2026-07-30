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

import { useAbility } from "@/components/auth/ability-context"

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

  const navMainWithError = React.useMemo(() => {
    // Define permissions mapping
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
      "/admin": ["manage", "all"],
    };

    return data.navMain
      .map((group) => {
        // Clone the group
        const newGroup = { ...group };

        // If it has sub-items, filter them
        if (newGroup.items) {
          newGroup.items = newGroup.items.filter((item) => {
            const perm = PERMISSIONS[item.url];
            if (!perm) return true; // Public by default if not listed? Or hide? Let's say public
            return ability.can(perm[0] as any, perm[1] as any);
          });
        }

        // If it's a direct link (no items), check its permission
        if (!newGroup.items && newGroup.url !== "#") {
          const perm = PERMISSIONS[newGroup.url];
          if (perm && !ability.can(perm[0] as any, perm[1] as any)) {
            return null; // Remove this group
          }
        }

        return newGroup;
      })
      .filter((group): group is typeof data.navMain[0] => {
        if (!group) return false;
        // If it was a group with items, and all items were removed, hide the group
        // Exception: Maybe some groups like "Home" don't have items.
        // Logic: If original had items, and now has 0, hide.
        if (group.items && group.items.length === 0) return false;
        return true;
      });
  }, [ability]);

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