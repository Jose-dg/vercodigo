# Fase: feedback de interacción en el portal (oct 2026)

Revisión de calidad UX/UI de las 4 pantallas de uso diario: **Comprar códigos**, **Activar tarjeta**, **Inicio** (`/overview` para dueño/admin de empresa) y **Mi cuenta** (`/wallet`). Mismo criterio que diem-app (`diem-app/docs/ux-motion-feedback.md`): cada click confirma que pasó algo, no hay saltos de layout, los estados de carga y error son reales, y `src/components/ui/*` no se modifica.

## Base global
| Problema | Solución |
|---|---|
| `globals.css` redefinía `.animate-in`, `.fade-in-0` y `.slide-in-from-bottom-*` de tailwindcss-animate: los modales, menús y transiciones del wizard perdían zoom/slide y la duración pedida | Bloque eliminado (y keyframes duplicados en `tailwind.config.ts`) |
| "Reducir movimiento" apagaba también spinners y skeletons | Duración de 1 ms en general; `.animate-spin` y `.animate-pulse` siguen animando |
| Sin feedback al presionar | `scale` en `:active` para `button`, `[role=button]` y `a[data-slot=button]` (`<Button asChild><Link/>`); excluye sidebar, switch, tabs, items Radix, combobox y `[data-no-press]`. Filas y opciones clicables con fondo en `:active` |
| Hover pegado en touch; flash gris de iOS | `future.hoverOnlyWhenSupported`; `-webkit-tap-highlight-color: transparent` en botones |
| Navegar no daba señal hasta que llegaba la página | `components/navigation-progress.tsx` (barra superior) + `(root)/loading.tsx` y `codes/purchase/loading.tsx` con la forma real |

## Comprar códigos
| Problema | Solución |
|---|---|
| **Doble compra posible:** tras el éxito se navega al detalle pero el `finally` rehabilitaba el botón y borraba la idempotency key; un segundo toque durante la navegación creaba otra compra | El botón queda bloqueado hasta salir de la página |
| El "atrás" del celular sacaba de la compra en vez de volver un paso | Cada paso del wizard es una entrada del historial (`pushState`, compatible con el router de Next 16); recargar o volver desde el detalle retoma el paso, validado contra el catálogo |
| Cambiar a "Mis solicitudes" reiniciaba el wizard y recargaba el historial | `TabsContent forceMount` + `data-[state=inactive]:hidden` |
| Spinner a pantalla completa mientras carga el catálogo | Encabezado y pestañas inmediatos; skeleton solo del wizard |
| Mientras llegaban (o si fallaban) las cotizaciones, el checkout decía "no tiene costo configurado" | `pricesStatus` (loading/ready/error): skeleton del precio, error real con reintentar; carrera al cambiar de empresa resuelta |
| Borrar la cantidad para escribir otra saltaba a 1 | Borrador del input; se ajusta al salir del campo |
| Polling de 5 s con `toast.error` en cada fallo | Poll silencioso, pausado con la pestaña oculta, secuencia de requests; aviso compacto con reintentar |
| "Copiar" confirmaba aunque el portapapeles fallara | `await` + error explícito; el botón muestra "Copiado" |
| Tabla de 6 columnas en celular | Fecha bajo el producto en móvil; "Solicitó" solo desde `md` |

## Activar tarjeta
| Problema | Solución |
|---|---|
| Encabezado propio con un segundo `SidebarTrigger` (dos menús) y "Inicio" apuntando a la landing pública | Eliminado; mismo patrón que las demás páginas |
| Escanear no daba feedback: solo giraba el botón del cuadro manual | Estado "Validando tarjeta…" visible; cuadros deshabilitados mientras valida |
| El mismo QR disparaba `onScan` varias veces (10 fps, `stop()` asíncrono) | Una sola lectura por apertura; vibración corta en Android |
| "En proceso" se veía como éxito (verde) y sin indicador; polling sin fin | Tono propio con spinner y "se actualiza sola"; pausa con pestaña oculta; límite de 2 min con "Consultar Diem" |
| El modal de confirmación se podía cerrar durante el POST | Bloqueado mientras activa; `autoCapitalize` y Enter para confirmar |
| Resultado fuera de la vista en celular; textos sin tildes | `scrollIntoView`; tildes corregidas |

## Inicio (`/overview`) y Mi cuenta (`/wallet`)
| Problema | Solución |
|---|---|
| Overview: si la API fallaba quedaba "Cargando…" para siempre | Estado de error con reintentar |
| Overview (plataforma): cambiar de compañía rápido podía mostrar datos de otra | Secuencia de requests y limpieza al cambiar |
| Saldo de la página distinto al del chip de la barra tras acreditarse una recarga | Overview usa la misma fuente que el chip (`/api/wallet/summary`); la wallet recarga saldo y movimientos cuando el chip cambia |
| "Cargando…" en texto y luego todo de golpe | Skeletons con la forma real |
| Wallet: un error decía "Esta vista es para usuarios de compañía" | Error real con reintentar |
| Movimientos: cada página/filtro colapsaba la tabla y movía la paginación bajo el dedo; páginas viejas podían pisar la actual | Filas atenuadas durante la recarga; secuencia de requests; datos ligados a su endpoint (en `/wallets` nunca se ve otra empresa) |
| Montos y chips sin variante oscura | `dark:` en chips, montos y saldo corrido |

## Verificación
- `tsc` sin errores en el código fuente; `eslint` limpio en los archivos tocados (los `any` de overview y del escáner ya estaban en HEAD).
- Tests: devdiem 31, wallet 14, wallet-topups 19, account-statements 7, qr 6 — todos pasan.
- `next build` compila. Nota: `.next/dev/types` local tenía tipos de las rutas de crons eliminadas en `875693b`; en un checkout limpio no existe.
- CSS compilado: `.fade-in-0` vuelve a ser de tailwindcss-animate, regla de press presente, hovers dentro de `@media (hover:hover)`.
- Pendiente: prueba manual en iPhone (atrás del wizard, escaneo, copiar) y en navegador.

## Fuera de alcance, señalado
- `/admin` (Inicio de plataforma) es la plantilla de demo de shadcn ("Building Your Application").
- El sidebar dice "Mi billetera" y la página "Mi cuenta" (el título se eligió en `fb4a508`).
- Comprar no pide confirmación aunque mueve dinero (activar sí la pide): decisión de producto.
