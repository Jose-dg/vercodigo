
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts
│   └── migrations/
│
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   └── register/
│   │   │       └── page.tsx
│   │   │
│   │   ├── (dashboard)/
│   │   │   ├── super-admin/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── companies/
│   │   │   │   ├── stores/
│   │   │   │   ├── products/
│   │   │   │   ├── cards/
│   │   │   │   ├── analytics/
│   │   │   │   └── invoices/
│   │   │   │
│   │   │   ├── admin/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── stores/
│   │   │   │   ├── inventory/
│   │   │   │   ├── sales/
│   │   │   │   └── billing/
│   │   │   │
│   │   │   ├── store/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── inventory/
│   │   │   │   ├── sales/
│   │   │   │   └── settings/
│   │   │   │
│   │   │   └── layout.tsx
│   │   │
│   │   ├── scan/
│   │   │   └── [uuid]/
│   │   │       └── page.tsx          # Vista pública para escanear QR
│   │   │
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   │   ├── login/route.ts
│   │   │   │   ├── logout/route.ts
│   │   │   │   └── me/route.ts
│   │   │   │
│   │   │   ├── qr/
│   │   │   │   ├── [uuid]/route.ts   # GET: Obtener PIN
│   │   │   │   └── generate/route.ts # POST: Generar QRs
│   │   │   │
│   │   │   ├── webhook/
│   │   │   │   └── activate/route.ts # POST: Activar tarjeta (n8n)
│   │   │   │
│   │   │   ├── cards/
│   │   │   │   ├── route.ts
│   │   │   │   └── [id]/route.ts
│   │   │   │
│   │   │   ├── stores/
│   │   │   │   ├── route.ts
│   │   │   │   ├── [id]/route.ts
│   │   │   │   └── [id]/phones/route.ts
│   │   │   │
│   │   │   ├── companies/
│   │   │   │   ├── route.ts
│   │   │   │   └── [id]/route.ts
│   │   │   │
│   │   │   ├── products/
│   │   │   │   ├── route.ts
│   │   │   │   └── [id]/route.ts
│   │   │   │
│   │   │   ├── invoices/
│   │   │   │   ├── route.ts
│   │   │   │   ├── generate/route.ts
│   │   │   │   └── [id]/route.ts
│   │   │   │
│   │   │   ├── analytics/
│   │   │   │   ├── dashboard/route.ts
│   │   │   │   ├── sales/route.ts
│   │   │   │   └── fraud/route.ts
│   │   │   │
│   │   │   └── matrix/
│   │   │       └── request-pin/route.ts
│   │   │
│   │   ├── layout.tsx
│   │   └── page.tsx
│   │
│   ├── components/
│   │   ├── ui/                        # shadcn/ui components
│   │   ├── auth/
│   │   │   ├── LoginForm.tsx
│   │   │   └── ProtectedRoute.tsx
│   │   │
│   │   ├── dashboard/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Header.tsx
│   │   │   ├── StatsCard.tsx
│   │   │   └── RecentActivity.tsx
│   │   │
│   │   ├── cards/
│   │   │   ├── CardList.tsx
│   │   │   ├── CardGenerator.tsx
│   │   │   ├── QRDisplay.tsx
│   │   │   └── CardPDFExport.tsx
│   │   │
│   │   ├── stores/
│   │   │   ├── StoreList.tsx
│   │   │   ├── StoreForm.tsx
│   │   │   └── PhoneManager.tsx
│   │   │
│   │   ├── products/
│   │   │   ├── ProductList.tsx
│   │   │   └── ProductForm.tsx
│   │   │
│   │   ├── invoices/
│   │   │   ├── InvoiceList.tsx
│   │   │   └── InvoiceDetail.tsx
│   │   │
│   │   └── scan/
│   │       ├── PinDisplay.tsx
│   │       └── ErrorMessage.tsx
│   │
│   ├── lib/
│   │   ├── prisma.ts                  # Prisma client singleton
│   │   ├── auth.ts                    # Auth utilities (JWT, bcrypt)
│   │   ├── permissions.ts             # RBAC logic
│   │   ├── qr-generator.ts            # Generación de QR
│   │   ├── uuid-generator.ts          # UUID de 8 caracteres
│   │   ├── matrix-api.ts              # Cliente para API empresa matriz
│   │   ├── invoice-generator.ts       # Generación de facturas
│   │   └── utils.ts
│   │
│   ├── services/
│   │   ├── card.service.ts
│   │   ├── activation.service.ts
│   │   ├── store.service.ts
│   │   ├── company.service.ts
│   │   ├── product.service.ts
│   │   ├── invoice.service.ts
│   │   ├── analytics.service.ts
│   │   └── matrix.service.ts
│   │
│   ├── middleware.ts                   # Auth middleware global
│   │
│   ├── types/
│   │   ├── api.ts
│   │   ├── auth.ts
│   │   └── models.ts
│   │
│   └── hooks/
│       ├── useAuth.ts
│       ├── useCards.ts
│       ├── useStores.ts
│       └── useAnalytics.ts
│
├── public/
│   └── assets/
│
├── .env.example
├── .env.local
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── README.md