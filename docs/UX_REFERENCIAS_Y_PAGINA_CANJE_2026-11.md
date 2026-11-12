# Referencias UX y página de canje neutra (nov 2026)

## Por qué
`vercode.me/scan/{código}` es lo que ve el **cliente final** del comercio cuando escanea la tarjeta. Hasta ahora:
- mostraba solo el PIN;
- la pestaña decía "Vercode" y tenía su ícono;
- no explicaba cómo canjear ni qué hacer con la región.

Riesgo: el cliente final llega a Vercode, intenta comprar directo y se salta a su proveedor, que es nuestro cliente. Además, la página no le aportaba nada.

Decisiones (José, 11-nov):
- La página pasa a ser una **guía de canje**, incluida la región.
- **Neutra, sin marca.**
- **Se mantiene vercode.me**: los QR impresos no cambian.
- El código se muestra **apenas se escanea**, sin un paso extra.

Nota: técnicamente sí se sabe de qué comercio viene cada tarjeta (tarjeta → sede → empresa). Una versión con la marca de cada comercio queda como opción futura.

## 1. Referencias consultadas
El análisis sale de leer el CSS y el JS públicos de cada sitio: colores, tipografías, keyframes, curvas y librerías.

### cursor.com/agents
Esa ruta exige iniciar sesión (redirige a WorkOS). Se analizó el sitio de marketing de cursor.com, que comparte el sistema visual.

| Aspecto | Detalle |
|---|---|
| Paleta | Oscura y cálida. Fondo `#14120b`, texto `#edecec` y tarjetas escalonadas `#1b1913 → #201e18 → #26241e → #2b2923`. El texto secundario es el mismo color con opacidad (`#26251e` al 99 % y al 66 %, con mezclas `oklab`). Verde `#1f8a65` y rojo `#cf2d56` solo para estados. |
| Tipografía | Serif editorial (EB Garamond) para titulares, sans para el cuerpo y mono para código. |
| Animación | `fade-in` de opacidad. `streaming-word-fade`: las palabras pasan de 0.4 a 1 de opacidad, efecto de texto "escribiéndose". `shimmer` como estado de carga. Galerías que entran con `translateY(25%)` + fade. Videos de producto controlados con `playbackRate`: ese es su "slow motion". |
| Tiempos | Casi todo entre 150 y 300 ms; 500–700 ms en entradas grandes. Curva `cubic-bezier(.22,1,.36,1)` (ease-out fuerte). |
| Accesibilidad | Respeta `prefers-reduced-motion`. |

### loona.com.ar/about
| Aspecto | Detalle |
|---|---|
| Paleta | Neutra (`#fafafa`, `#171717`, `#0a0a0a`) con **un solo acento** azul eléctrico `#2744ff` y algo de naranja `#ff9448`. |
| Tipografía | Aspekta en titulares, Inter en el cuerpo. |
| Librerías | GSAP + ScrollTrigger y Motion (`whileInView`). Next.js. |
| Animación | Hero que entra con fade y 16 px de subida (`mk-hero-in`). Texturas "metal" y "niebla" con shaders en imagen que derivan muy lento: marquees de 64 a 92 s, que son su "slow motion". Flotación de 9 px (`loona-float`), "shine" sobre guías y paneles que entran deslizando. |
| Curva firma | `cubic-bezier(.32,.72,0,1)`, tipo iOS. |
| Accesibilidad | Respeta `prefers-reduced-motion`. |

### Opinión
Las dos son páginas de **marca**: buscan que te quedes, recorras y recuerdes el producto. La página de canje es lo opuesto: la abre alguien en el celular, con prisa, para usar un código en unos 30 segundos, y debe ser neutra.

- **Tomado de Cursor:** la sobriedad, la jerarquía tipográfica, fades cortos con ease-out, *shimmer* mientras carga y el revelado progresivo (aquí, carácter por carácter del código).
- **Tomado de Loona:** un solo color de acento y la entrada con 16 px de subida.
- **Descartado:** el storytelling con scroll, los shaders, los marquees lentos y GSAP. Pesan, gastan datos móviles, distraen y comunican marca, justo lo que se quiere evitar.

## 2. Especificación de la página de canje
- **Color:** tokens del proyecto (`--background`, `--foreground`, `--muted`, `--border`), que ya tienen versión clara y oscura, más **un solo acento** `--redeem-accent: 221 83% 53%` para pasos y la acción principal. El ámbar se usa solo para el aviso de región.
- **Tipografía:** Inter, la del proyecto. El código va en mono, 2xl, en grupos de 4 caracteres.
- **Ancho:** columna de `max-w-md` (escaneo) o `max-w-2xl` (guías), con 16 px de margen lateral.

| Animación | Duración | Curva | Movimiento reducido |
|---|---|---|---|
| Entrada de bloques (`redeem-rise`): opacidad + 16 px de subida, escalonada 0/80/160 ms | 420 ms | `cubic-bezier(.22,1,.36,1)` | 1 frame (regla global) |
| Código carácter por carácter (`redeem-char`): opacidad 0.15→1 + 4 px | 260 ms por carácter, 30 ms de desfase, tope de 600 ms | igual | 1 frame |
| Carga (`redeem-shimmer`) | 1.4 s en bucle | lineal | estático |
| Botones | El *press* global del proyecto (`scale .97`) | — | opacidad |

**Estados de `/scan`:**
- **Cargando:** shimmer.
- **Código:** producto, valor, insignia de región, código, Copiar, "Ir a canjear" (sitio oficial), pasos, aviso de región y enlace a la guía completa.
- **No activada:** contacto de la tienda (es del comercio, no de Vercode).
- **Límite de vistas alcanzado.**
- **No encontrada.**
- **Error de red:** con botón para reintentar.

## 3. Qué quedó implementado
- **`/scan/[uuid]` neutra:**
  - título "Tu código", ícono genérico (`public/redeem-icon.svg`), sin manifest ni Open Graph;
  - `noindex` por meta y por header (`X-Robots-Tag`, que ya existía);
  - el HTML no contiene la palabra "Vercode".
- **El código se ve al escanear.** La API `GET /api/qr/[uuid]` no cambió su lógica ni el conteo; solo agrega `brand` y `region` para elegir la guía. La petición no se dispara dos veces aunque React ejecute el efecto dos veces en desarrollo, para no gastar vistas de más.
- **Guías públicas indexables** en `/guias` y `/guias/{plataforma}`: PlayStation, Xbox, Nintendo, Steam, Roblox, Netflix, Google Play, Razer Gold y Free Fire. Si la marca no tiene guía, la página del QR usa una guía genérica.
- **SEO de las guías:**
  - generadas estáticas (SSG);
  - `title` y `description` con intención de búsqueda;
  - `canonical` absoluta, hreflang + `x-default` y Open Graph de artículo;
  - JSON-LD `HowTo` + `FAQPage` + `BreadcrumbList`;
  - HTML semántico (un `h1`, `ol` de pasos, `details` para las preguntas) y fecha de actualización con `<time>`;
  - entran al `sitemap.xml` con `lastModified` y alternates;
  - `robots.txt` permite `/guias`.
- **`/scan` fuera de los buscadores:** sigue permitido en `robots.txt` **a propósito**, para que los bots lean su `noindex`; un `Disallow` lo ocultaría y la URL podría indexarse igual desde enlaces. Tampoco va en el sitemap.
- **Íconos:**
  - se quitaron del `<head>` raíz los `<link>` de ícono y manifest escritos a mano (ya estaban en `metadata`) para que `/scan` y `/guias` los puedan reemplazar;
  - `src/app/favicon.ico` (el de create-next-app) se movió a `public/`: `/favicon.ico` sigue respondiendo, pero ya no se inyecta en cada página.
- **Multiidioma (preparado, publicado solo `es`):**
  - `src/lib/i18n/config.ts`: `locales`, `defaultLocale` y `negotiateLocale(Accept-Language)`. `/scan` elige el idioma en el servidor.
  - `src/lib/i18n/dictionaries.ts`: todos los textos de interfaz; las páginas no tienen textos en duro.
  - `src/lib/redeem-guides/content/es.ts`: el texto de las guías, uno por idioma. Los datos que no dependen del idioma (marcas, slugs por idioma, enlaces oficiales y reglas de región) están en `definitions.ts`.
  - Rutas: `es` → `/guias/...`; otro idioma → `/{idioma}/...` (`guidePath`). Los hreflang solo incluyen idiomas que existen.
  - **Para agregar inglés:** agregar `"en"` a `locales`, su diccionario, `content/en.ts`, los slugs `en` y las rutas `/en/guides`. Además, separar el layout raíz por idioma, porque hoy `<html lang="es">` es fijo.

## 4. Reglas de región (fuentes oficiales, revisadas el 11-nov-2026)
| Plataforma | Regla | Fuente |
|---|---|---|
| PlayStation | La región de la cuenta no se cambia. El código solo funciona en una cuenta de su región; se puede crear una cuenta de esa región. | playstation.com (país de la cuenta; problemas con códigos) |
| Xbox | Se puede cambiar el país, pero Microsoft lo recomienda solo si te mudas. El saldo no se convierte ni se transfiere. | support.microsoft.com/help/4039267 |
| Nintendo | Se cambia desde la web de la cuenta. En América el saldo debe estar en cero y no se transfiere. | Soporte de Nintendo Américas (a_id 63084 y 25847) |
| Google Play | Solo se canjea en el país de compra. El país se cambia una vez al año y el saldo queda en el país anterior. | support.google.com/googleplay 3422734 y 11564359 |
| Netflix | Decide la moneda de la facturación. No aplica a cuentas facturadas por Apple o por un paquete de otro proveedor. | help.netflix.com 32950 y 59987 |
| Razer Gold | El PIN solo recarga monederos de su región; el cambio de región lo hace el soporte. | gold.razer.com/help |
| Steam | La moneda la fija la primera compra; si no coincide, se contacta al soporte. | **Pendiente de citar** el artículo exacto de help.steampowered.com |
| Roblox | Ligada a la moneda de la región; se canjea en el navegador. | **Pendiente de citar** el artículo exacto de la Ayuda de Roblox |
| Free Fire | PIN por región en la tienda de Garena (`pagostore.garena.com`). | **Por validar con el proveedor**: las fuentes encontradas son de revendedores |

## 5. Verificación
- `tests/redeem-guides.test.mjs` (en `npm run test:qr`, 18/18) cubre:
  - la guía según marca o nombre y la caída a la genérica;
  - que cada guía tenga contenido y enlaces `https`;
  - que el texto no nombre a Vercode ni a Diem;
  - slugs únicos, rutas y hreflang;
  - la negociación de idioma y las etiquetas de región;
  - que el JSON-LD sea válido y no pueda cerrar su `<script>`.
- `tsc` y lint limpios en los archivos tocados. El único error de lint es `(req as any).ip` en la ruta del QR, que ya existía.
- Build en una copia aislada: `/guias` y `/guias/[slug]` salen como estáticas.
- Servidor de producción local (puerto 3999):
  - Guías: title, description, canonical, hreflang, Open Graph y JSON-LD correctos.
  - `/scan`: título "Tu código", ícono neutro, `noindex` por meta y header, cero menciones a "Vercode".
  - App: `/login` conserva manifest e íconos.
  - Sitemap con las 9 guías y sin `/scan`.
  - Capturas a 390 px de los estados código, no activada, límite, índice y guía. Con esas capturas se corrigió el código largo, que no tenía dónde partirse; ahora va en grupos de 4.

## Pendiente
- Revisar en un celular real el modo oscuro: Chrome headless no aplica la preferencia del sistema dentro del iframe.
- Citar los artículos exactos de Steam y Roblox, y validar Free Fire con el proveedor.
- Deploy. No requiere migraciones.
- Fuera de alcance, para decidir: la home de vercode.me tiene un buscador de canje (`RedemptionLookup`) pensado para clientes finales, que los lleva directo al sitio B2B.
- Tensión conocida: las guías traen búsquedas de clientes finales a vercode.me. Son neutras y no enlazan al sitio B2B, pero el dominio se ve en la barra.
