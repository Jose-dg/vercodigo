# Portal: envío por CSV, Configuración, Clerk y nuevo Inicio (oct 2026)

Rama `feat/portal-csv-config-dashboard`, creada sobre `main` (`9d1eeb2`).

## 1. Envío a varios destinatarios (CSV)
- **Dónde:** en el checkout, "Enviar los códigos al email de mi cliente" → **Varios (CSV)**.
- **Cómo se usa:**
  1. Se elige el producto.
  2. Se sube `nombre,apellido,email`: separador `,` o `;`, encabezado opcional, hasta 200 filas, un código por persona.
  3. Se revisa la vista previa con los errores por fila y se confirma la autorización de datos.
  4. Se envía.
- **Cómo funciona por dentro:**
  - Cada fila es una compra normal con su destinatario. No hay modelos nuevos.
  - El navegador envía las filas al endpoint de compra de siempre, 3 a la vez.
  - El `Idempotency-Key` de cada fila sale del archivo, el producto y el número de fila. Si se corta la conexión, si se usa "Reintentar fallidos" o si se vuelve a subir el mismo archivo, **no se compra dos veces**.
- **Al terminar:** resumen, CSV de resultados (fila, email, orden, estado) y un enlace a "Mis solicitudes".
- **Archivos:** `src/lib/codes/recipients-csv.ts`, `src/components/codes/{RecipientsCsvInput,RecipientsBatchDialog,recipients-batch}.tsx`.

## 2. Navegación y Configuración
- **`/settings`:**
  - Pestañas: Perfil (el `UserProfile` de Clerk), Sedes, Usuarios, Precio de reventa y un enlace a Desarrolladores.
  - Cada rol ve lo mismo que veía en Management (`managementDestinationsForRole`).
  - Para roles de empresa, `/store`, `/users` y `/prices` redirigen a `/settings/*`. El proxy controla las rutas nuevas igual que las viejas.
- **Management** queda solo para roles de plataforma.
- **"Mi billetera"** sale del sidebar: el chip de saldo de la barra superior ya muestra el saldo y enlaza a los movimientos.
- **"Volver al portal"** en `/developers` lleva al inicio del rol (`/overview` para dueños y admins generales).
- **Seguridad:** todas las rutas `/api/analytics/*`, que tienen datos globales de la plataforma y el Excel, **respondían sin sesión**. Ahora exigen permisos de plataforma.

## 3. Clerk: cambio de email hecho por un admin
- **Causa:** cada llamada a Clerk dispara un webhook `user.updated`, y el formulario de admin reenviaba nombre y rol aunque no cambiaran. Esos eventos traen todavía el email anterior como principal. Si uno llegaba después de escribir la BD, el webhook devolvía la BD al email viejo, y Clerk y la BD quedaban distintos.
- **Arreglo:**
  - El webhook lee la cuenta de Clerk en ese momento en vez de confiar en el payload. Si Clerk no responde, contesta 503 para que se reintente.
  - Al editar un usuario solo se envía a Clerk lo que cambió.
  - El cambio de email sigue este orden:
    1. El email nuevo pasa a ser principal en Clerk y se confirma leyendo la cuenta.
    2. Se escribe la BD.
    3. Se borran los emails anteriores (si eso falla, se audita).
    4. Se cierran las sesiones.
  - Si la escritura en la BD falla, se restaura el principal anterior en Clerk.
- **`npm run clerk:audit`:** lista las cuentas donde la BD y Clerk no coinciden (solo lectura). `--fix <userId>` repara una cuenta, tomando la BD como fuente de verdad.

## 4. Nuevo Inicio (`/overview`)
- **Encabezado:** "Bienvenido, {nombre}", el email y las acciones (comprar, activar, recargar).
- **KPIs** (todo el tiempo):
  - Saldo
  - Órdenes, con cuántas completadas
  - Total gastado (consumos menos reembolsos)
  - Depositado (recargas)
- **Estadísticas:**
  - Rangos: 7 días, 30 días, Todo, Período (calendario).
  - Gráfico de barras por día; por mes si el rango pasa de 3 meses.
  - Gasto por servicio (Códigos digitales / Activaciones QR) y top 10 de productos por gasto.
  - Excel con las hojas Resumen y Órdenes.
- **Órdenes recientes:** producto, referencia, fecha, canal (Portal / API / QR), estado y monto.
- **De dónde salen los datos:**
  - El dinero sale de los movimientos de la billetera (lo que de verdad se cobró, en su moneda).
  - Los días son días de Colombia.
- **Archivos:**
  - Servicio y API: `src/services/company/dashboard.service.ts`, `src/app/api/company/dashboard/{route,export/route}.ts`
  - UI: `src/components/dashboard/*`
  - Lógica pura: `src/lib/dashboard/range.ts`
- Se eliminaron `/api/company/overview` y `overview.service.ts`, que quedaron sin uso.

## Verificación
- **Unit:** CSV (6), rangos y series (4); en total `test:devdiem` 66/66, `test:access` 7/7 y `test:identity` 8/8.
- **Integración:** `test:concurrency` 60/60. Incluye:
  - CSV enviado dos veces → 3 compras, no 6
  - cambio de email con Clerk simulado (orden de los pasos, rechazo de Clerk, rechazo de la BD con restauración, emails viejos que no se pudieron borrar)
  - webhook desordenado y Clerk caído
  - KPIs, series, servicios, top y órdenes recientes del dashboard sobre un fixture
- **Typecheck y lint:** limpios. **`next build`:** OK en una copia aislada.
- **`clerk:audit`** corrido en local (Clerk de desarrollo): 7 usuarios, 0 diferencias.
- **Pendiente:**
  - Revisión visual en el navegador con sesión: Inicio, Configuración, CSV real.
  - Correr `clerk:audit` en producción para encontrar y reparar la cuenta afectada.
