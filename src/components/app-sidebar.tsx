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
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={data.teams} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
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