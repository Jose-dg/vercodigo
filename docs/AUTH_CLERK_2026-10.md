# Autenticación con Clerk (oct 2026)

Clerk responde **quién es** la persona: contraseña, Google, Apple, recuperación de contraseña y sesiones. Nuestra base sigue decidiendo **qué puede hacer**: rol, empresa, sede, CASL, wallet. No se usan Clerk Organizations, así que no aplican sus límites de miembros ni el costo de roles propios.

Reemplaza a NextAuth y al diseño de identidad propio de [`ARQUITECTURA_LOGIN_NOTIFICACIONES_2026-10.md`](./ARQUITECTURA_LOGIN_NOTIFICACIONES_2026-10.md) §3. Las notificaciones de pedidos no cambian.

## Plan de Clerk
| Plan | Precio | Incluye |
|---|---|---|
| Hobby | Gratis | 50.000 usuarios retenidos al mes, 3 conexiones sociales (Google + Apple), dominio propio. Sin MFA; muestra "Secured by Clerk" |
| Pro | US$25/mes (US$20 anual) | Lo anterior + MFA y sin el sello |

Se puede empezar en Hobby y subir sin cambiar código.

## Cómo funciona
- **Sesión:** `clerkMiddleware` (`src/proxy.ts`) corre en todas las rutas.
  - Filtra las secciones por rol con el claim `metadata.role`.
  - Si el claim falta, lee el rol de la base.
- **Autorización:** `getAuthenticatedActor` (`src/lib/auth/actor.ts`) usa `auth()` → `User.clerkUserId` y conserva las validaciones de siempre: usuario, empresa y sede activas.
- **Sin sesión:** `requireAuthenticatedActor` usa `redirectToSignIn()`, que conserva la URL. Así el enlace de un correo a su orden vuelve a la orden después de entrar.
- **Login** (`/login`): `<SignIn />` en español, con correo y contraseña, Google, Apple y "Olvidé mi contraseña" (el correo lo envía Clerk). Sin enlace de registro.
- **Destino tras entrar:** `/auth/continue` lleva al inicio de cada rol. Si la cuenta de Clerk no tiene acceso al portal, lo explica.
- **Alta de usuarios** (`users.service` → `modules/identity/clerk-users.ts`):
  - el admin crea el usuario con la clave asignada (o "Generar contraseña") → se crea en Clerk con `publicMetadata.role` → se crea la fila local con `clerkUserId` y `mustChangePassword`;
  - si la fila falla, se borra la cuenta en Clerk.
- **Cambios de usuario:**
  - rol, nombre y correo se sincronizan con Clerk;
  - desactivar → `banUser`;
  - restablecer la clave → nueva clave en Clerk + se cierran sus sesiones + `mustChangePassword`;
  - Clerk rechaza claves filtradas en brechas conocidas.
- **Configuración:** modal con menú lateral (patrón shadcn `sidebar-13`, en `components/settings/`). Se abre desde "Configuración" en el menú lateral, el menú del usuario o el aviso de cambiar la clave, sin salir de la página. `/settings` lleva al inicio del rol con el modal abierto (`?configuracion`, opcionalmente `=accounts`). Al volver de Google/Apple regresa a la misma página y se reabre en Cuentas vinculadas.
  - **Contraseña:** verifica la actual en Clerk, aplica nuestra política, cierra las sesiones en otros dispositivos y apaga el aviso.
  - **Cuentas vinculadas:** Google y Apple con Vincular / Desvincular (`user.createExternalAccount`, con `useReverification` si la sesión no es reciente). Es opcional y la contraseña nunca se quita.
  - Es un componente propio y no `<UserProfile />`, porque ese deja cambiar correo y clave directo en Clerk sin pasar por nuestra base.

## Configuración en el dashboard de Clerk
1. Crear la aplicación (instancia de desarrollo y de producción).
2. **Registro restringido** (*Restrictions → Sign-up mode: Restricted*): nadie crea cuenta solo.
3. **Métodos:** correo + contraseña; Google y Apple como conexiones sociales. En producción van con credenciales propias:
   - Google: un cliente OAuth;
   - Apple: Services ID, Team ID, Key ID y llave `.p8`.
4. **Sesión** (*Sessions → Customize session token*): `{ "metadata": "{{user.public_metadata}}" }`. Es opcional porque el proxy tiene respaldo en la base, pero evita esa consulta.
5. **Rutas:** sign-in URL `/login` (además `signInUrl` en `clerkMiddleware`; sin eso las rutas protegidas mandan al portal hospedado de Clerk).
6. **Contraseña:** largo mínimo 10, igual a nuestra política (la instancia nueva venía con 15).
7. **Dominio de producción** `vercode.me`, con los registros DNS que pide Clerk.

## Variables de entorno (Vercel)
| Variable | Qué es |
|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Llave pública de la instancia |
| `CLERK_SECRET_KEY` | Llave secreta (secreto) |

Las credenciales de Google y Apple viven en el dashboard de Clerk, no en el repo. `NEXTAUTH_URL` y `NEXTAUTH_SECRET` dejan de usarse.

## Despliegue (en este orden)
1. **Migración** `20261019120000_clerk_identity` (`prisma migrate deploy`). Es aditiva:
   - `clerkUserId`, `mustChangePassword`;
   - `passwordHash` pasa a opcional;
   - el `CHECK` de correo normalizado.

   El código actual sigue funcionando con ella.
2. **Importar usuarios** con la llave de producción de Clerk y la base de producción:
   `npm run clerk:import-users` (simulación) → revisar → `npm run clerk:import-users -- --apply`.

   Cada usuario conserva su contraseña (hash bcrypt) y queda con `clerkUserId`.
3. **Variables de entorno** en Vercel.
4. **Deploy** del código.

   ⚠️ Si se publica antes del paso 2, nadie puede entrar: el portal busca por `clerkUserId`.
5. **Después,** una migración que elimine `passwordHash`.

## Verificación hecha
- `tsc`.
- Lint de los archivos tocados. Quedan errores previos en `abilities.ts` y `serialization.ts`, que no se tocaron.
- Todas las suites: devdiem 43, purchase-quote 18, wallet 14, wallet-topups 19, account-statements 7, qr 6, identidad 4, navegación 7.
- `next build`, con llaves ficticias solo para compilar.
- **Sin probar en navegador:** requiere una instancia de Clerk. Probar en desarrollo:
  - entrar con una clave migrada, con Google y con Apple;
  - "Olvidé mi contraseña";
  - crear usuario → aviso → cambiar clave → la otra sesión se cierra;
  - un usuario desactivado no entra;
  - un OPERATOR no abre `/companies`;
  - un enlace de correo a una orden con la sesión cerrada vuelve a la orden.
