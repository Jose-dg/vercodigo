# Prompt maestro revisado: capa pública B2B de Vercode

> Uso: pega este documento completo en la herramienta que vaya a construir la
> landing. La herramienta debe trabajar dentro del repositorio existente
> `diem-sas`; no debe crear otro proyecto ni modificar el producto operativo.

## 1. Rol, objetivo y jerarquía de decisiones

Actúa como un equipo senior de producto, contenido, diseño web e ingeniería
frontend. Construye la capa pública B2B de **Vercode** en `https://vercode.me`
dentro de la aplicación Next.js existente `diem-sas`.

La página debe lograr que el dueño, administrador o comprador de una tienda
entienda en menos de 30 segundos:

1. Qué ofrece Vercode.
2. Cómo puede vender códigos digitales o tarjetas físicas con QR.
3. Qué controles operativos recibe.
4. Cómo solicitar una cuenta o hablar con el equipo comercial.

Orden de autoridad para resolver cualquier contradicción:

1. Los límites de seguridad y alcance de este documento.
2. El comportamiento real ya implementado en `diem-sas` y `diem`.
3. La configuración pública de marketing definida para esta landing.
4. El contenido sugerido en este documento.

Si una afirmación no está respaldada por una de esas fuentes, no la publiques.
No conviertas una diferencia entre el brief y el producto en un cambio del
producto: ajusta el contenido de marketing o deja el bloque deshabilitado.

## 2. Límites no negociables

`diem` y los servicios existentes de `diem-sas` son un producto probado,
funcional y la fuente de verdad operativa. Esta tarea construye marketing; no
rediseña el producto.

### 2.1 No modificar

- Modelos Prisma, migraciones ni datos existentes.
- Autenticación, sesiones, roles, permisos o middleware operativo.
- Wallet, movimientos, costos, precios o reglas de crédito.
- Compra de códigos, inventario, fulfillment o integración con `diem`.
- Activación de tarjetas, webhooks operativos o trabajos de reintento.
- El comportamiento, contrato o ruta actual de `/scan/[uuid]`.
- APIs existentes del portal.
- URLs impresas en tarjetas ya emitidas.

### 2.2 Si se puede modificar o agregar

- La página pública `/`, hoy sin función comercial relevante.
- Un layout y componentes exclusivos de marketing.
- La página pública `/empresas`.
- Páginas legales públicas.
- Configuración tipada de marketing.
- Un endpoint nuevo y aislado `/api/leads`.
- Metadata, sitemap, robots y headers HTTP que no alteren el producto.
- Pruebas exclusivas de la capa pública y pruebas de no regresión.

Antes de editar, inspecciona el repositorio y registra las rutas y archivos
operativos que deben permanecer intactos. No renombres ni muevas rutas del
portal para acomodar la landing.

## 3. Alcance de la primera versión

### Incluido

- `/`: landing principal para tiendas.
- `/empresas`: página para compras corporativas, regalos e incentivos.
- `/terminos`, `/privacidad` y `/cookies`: solo si existe contenido aprobado.
- Formulario de solicitud de cuenta.
- Contacto por WhatsApp.
- Acceso discreto al canje existente en `/scan/{ID}`.
- SEO técnico, accesibilidad, rendimiento y analítica propia o sin cookies.
- Preparación interna para configurar otros mercados en el futuro.

### Fuera de alcance

- `/para-tiendas`.
- `/regalos-corporativos`.
- `/lp/*` y páginas para campañas pagadas.
- Blog, guías o centro de contenido.
- Selector de país y versiones públicas para otros mercados.
- Traducciones o rutas alternativas de idioma.
- Cambios funcionales al portal o al canje.
- Integraciones con CRM no proporcionadas.
- Automatizaciones de LinkedIn, pauta o herramientas de prospección.

No crees rutas vacías, duplicadas o con contenido genérico para aparentar un
alcance mayor.

## 4. Contexto comercial autorizado

- Vercode ofrece códigos digitales y tarjetas físicas con QR a empresas.
- La audiencia principal son tiendas de tecnología, videojuegos, computadores
  y otros comercios que venden productos digitales.
- El cliente de Vercode es el comercio, no el consumidor final.
- El comercio puede comprar códigos directamente o activar una tarjeta física
  al momento de venderla.
- Una tarjeta inactiva no debe presentarse como si ya contuviera un código
  visible para el comprador.
- La modalidad comercial pública es saldo prepago o crédito aprobado.
- La entrega debe describirse como **automática según disponibilidad**, no como
  garantía absoluta de entrega instantánea en todos los casos.
- Los estados excepcionales se atienden mediante soporte.
- Colombia es el único mercado publicado en esta versión.
- Marcas, categorías y productos visibles provienen exclusivamente de la
  configuración pública aprobada.

No publiques precios, márgenes, volúmenes, número de clientes, certificaciones,
testimonios, logos de terceros, afiliaciones oficiales o tiempos de respuesta
que no estén configurados y aprobados.

## 5. Audiencias y conversión

### Audiencia principal de `/`

- Dueños de tiendas.
- Administradores de locales.
- Responsables de compras y operación.
- Comercios con uno o varios puntos de venta.

Sus preguntas principales son: que puedo vender, como funciona, que controlo,
que ocurre si algo falla y como empiezo.

### Audiencia de `/empresas`

- Talento Humano y bienestar.
- Compras.
- Marketing y ventas.
- Agencias que administran incentivos o regalos.

La página debe hablar únicamente de usos compatibles con el catálogo público
configurado. No debe sugerir variedad universal de regalos.

### Conversion, en orden

1. Enviar el formulario `Solicitar cuenta`.
2. Abrir WhatsApp con un mensaje comercial precargado.
3. Iniciar sesión para clientes existentes.

`/empresas` puede incluir `Agendar una llamada` solo cuando exista un enlace de
agenda configurado.

## 6. Arquitectura dentro de `diem-sas`

Usa el App Router y las dependencias existentes. No crees una segunda
aplicación.

- Mantener el layout raiz global.
- Crear un layout público de marketing que no herede la navegación del portal.
- Convertir `src/app/page.tsx` en la landing pública.
- Agregar `/empresas` y las páginas legales publicables.
- Mantener `/login`, `/scan/[uuid]` y todas las rutas bajo el layout operativo.
- Mantener todo el contenido comercial importante en el HTML inicial.
- Usar Client Components solo para interacciones: menu móvil, demostracion de
  tarjeta, formulario y campo de canje.

No consumas endpoints autenticados para renderizar marketing. No expongas
inventario, disponibilidad, costos, precios negociados ni nombres internos de
productos.

## 7. Configuración pública y secretos

Crea una configuración tipada de marketing, separada de Prisma y de los
servicios operativos. Divide la configuración en dos niveles:

1. `publicMarketingConfig`: contenido seguro para enviar al navegador.
2. `serverMarketingConfig`: secretos y destinos usados solo en el servidor.

La forma mínima esperada es equivalente a:

```ts
type PublicMarketingConfig = {
  brand: {
    name: "Vercode";
    canonicalUrl: "https://vercode.me";
    description: string;
  };
  market: {
    countryCode: "CO";
    locale: "es-CO";
    currency: "COP";
    status: "active";
  };
  company: {
    legalName: string;
    taxId: string;
    address: string;
    contactEmail: string;
  };
  contact: {
    whatsappE164: string;
    whatsappPrefill: string;
    supportHours: string;
    schedulingUrl?: string;
    linkedinUrl?: string;
  };
  urls: {
    login: string;
    redemptionBasePath: "/scan";
    terms?: "/terminos";
    privacy: "/privacidad";
    cookies?: "/cookies";
  };
  catalog: Array<{
    name: string;
    category?: string;
    status: "available" | "coming_soon";
  }>;
  commercial: {
    prepaidEnabled: true;
    approvedCreditEnabled: true;
    minimumOrderText?: string;
    claimPolicyText?: string;
    billingText?: string;
  };
  features: {
    showCorporatePage: true;
    showScheduling: boolean;
    showTerms: boolean;
    showCookies: boolean;
    showComingSoonCatalog: boolean;
  };
};
```

La configuración de servidor debe validar, como minimo:

- `LEADS_WEBHOOK_URL`.
- `LEADS_WEBHOOK_SECRET`, si el receptor usa firma.
- Credenciales de Turnstile para producción.
- Credenciales del adaptador de rate limit distribuido para producción.

Usa Zod, ya disponible en el proyecto, para validar configuración y payloads.
No uses variables `NEXT_PUBLIC_*` para secretos.

### Politica de datos pendientes

- En desarrollo se puede mostrar un panel claramente rotulado
  `Configuración de marketing pendiente`.
- En producción nunca debe aparecer el texto `[PENDIENTE]`.
- El build de producción debe fallar si faltan razón social, identificación
  fiscal, dirección, correo, WhatsApp, URL de privacidad, webhook o protección
  antispam/rate limit requerida.
- Los bloques opcionales deben ocultarse cuando no están configurados.
- Una página legal sin texto aprobado debe responder 404 y no aparecer en
  navegación, sitemap ni datos estructurados.
- La política de privacidad es obligatoria para publicar el formulario.

## 8. Contenido de la landing `/`

### 8.1 Encabezado

- Wordmark tipográfico `Vercode` hasta recibir identidad visual aprobada.
- Enlaces: `Cómo funciona`, `Tarjetas con QR`, `Control`, `Preguntas`.
- Accion secundaria `Iniciar sesión` apuntando a la URL configurada.
- Accion primaria `Solicitar cuenta` apuntando al formulario.
- En móvil, menu accesible y CTA principal visible sin ocupar excesivo espacio.
- No mostrar selector de país en esta versión.

### 8.2 Hero

Texto base, editable solo si conserva el mismo significado:

**Titulo:** `Codigos digitales y tarjetas con QR para vender en tu negocio.`

**Subtitulo:** `Compra códigos o activa tarjetas al momento de la venta. Controla
usuarios, saldo y movimientos desde una sola cuenta.`

Apoyo de disponibilidad: `Entrega automática según disponibilidad. Condiciones
de saldo prepago o crédito aprobado para cada cuenta.`

Acciones:

- `Solicitar cuenta`.
- `Escribir por WhatsApp`.

No uses frases como `la plataforma número uno`, `100 % seguro`, `siempre
instantaneo` o cualquier superlativo no demostrado.

### 8.3 Demostracion de tarjeta

Construye una simulación visual en código, no conectada con APIs reales, con
tres pasos accionables:

1. `Inactiva`: muestra `Esta tarjeta aun no ha sido activada. Contacta a la
   tienda.`
2. `Activada por la tienda`: explica que el operador completo la activación.
3. `Codigo disponible`: presenta `VCDE-EJEMPLO-2026` marcado de forma permanente
   como `Codigo de demostracion - no canjeable`.

Requisitos:

- Controlable con teclado y botones con nombres accesibles.
- Ningun autoplay indispensable para comprenderla.
- Con `prefers-reduced-motion`, los cambios son inmediatos y sin transiciones.
- No llamar `/api/cards/activate`, `/api/qr/*`, webhooks ni ningún servicio real.
- No usar capturas falsas del portal.

### 8.4 Acceso para quien recibio una tarjeta

Incluir un bloque discreto, separado de los CTA comerciales:

- Etiqueta: `¿Recibiste una tarjeta?`
- Ayuda: `Ingresa el identificador impreso o abre el QR de la tarjeta.`
- El envío solo normaliza el valor y navega a `/scan/{ID}`.
- No consultar si el ID existe, no autocompletar y no mostrar respuestas de la
  API en la landing.
- Aceptar el formato vigente del producto y dejar la validación definitiva a la
  ruta existente.
- Para entradas vacías o evidentemente inválidas, usar un mensaje local genérico.

### 8.5 Catalogo público

- Renderizar exclusivamente `publicMarketingConfig.catalog`.
- Mostrar nombres como texto; no descargar ni recrear logos de terceros.
- Separar `Disponible` de `Próximamente` solo si el flag correspondiente está
  activo.
- Si el catálogo está vacío en producción, ocultar el bloque y fallar la prueba
  de aceptacion comercial.
- Incluir el descargo: `Las marcas mencionadas pertenecen a sus respectivos
  titulares. Vercode no afirma afiliación ni patrocinio salvo autorización
  expresa.`

### 8.6 Cómo funciona

1. Solicita tu cuenta y define los usuarios de tu negocio.
2. Recarga saldo o utiliza el crédito aprobado para tu cuenta.
3. Compra códigos o activa tarjetas con QR al momento de vender.
4. Entrega el código a tu cliente o permite que lo consulte desde la tarjeta.

No presentes estos pasos como onboarding automático si la apertura requiere
revisión comercial.

### 8.7 Dos formas de vender

**Codigo directo:** el comercio solicita el código desde su cuenta y lo entrega
al comprador cuando está disponible.

**Tarjeta física con QR:** permanece inactiva hasta la venta; un operador del
comercio realiza la activación y el comprador consulta el resultado desde la
tarjeta.

Explica el valor operativo sin afirmar que el sistema evita todo fraude.

### 8.8 Lo que controla el comercio

Comunicar solo capacidades verificadas en el producto:

- Usuarios con funciones y alcances distintos.
- Historial de compras y activaciones.
- Saldo y movimientos de la cuenta.
- Operacion por local cuando corresponda.
- Precios de referencia configurables por la empresa, si esta capacidad se
  mantiene disponible al momento de publicar.

No prometer 2FA, API para clientes, integraciones, reportes o facturación
específica sin habilitarlos expresamente en configuración.

### 8.9 Seguridad y confianza

Explicar controles, no adjetivos:

- Una tarjeta inactiva no presenta el código al comprador.
- La activación se realiza desde una cuenta autorizada.
- Compras y activaciones conservan trazabilidad operativa.
- El comercio puede consultar movimientos de su cuenta.
- Los casos excepcionales se escalan a soporte.
- La identidad legal y los canales de contacto de Vercode aparecen en el sitio.

No mencionar certificaciones, cifrado, validación universal de lotes, MFA o
garantias de fraude si no están documentados y aprobados.

### 8.10 Condiciones comerciales

Explicar sin publicar precios ni márgenes:

- Saldo prepago.
- Credito sujeto a aprobacion.
- Precios disponibles después de la apertura de cuenta.
- Disponibilidad dependiente del producto y su región.
- Minimos, facturacion y política de reclamos solo cuando existan en la
  configuración pública.

### 8.11 Preguntas frecuentes

Incluir respuestas breves y directas para:

- ¿Vercode vende al consumidor final?
- ¿Qué ve una persona al escanear una tarjeta inactiva?
- ¿Cómo se activa una tarjeta?
- ¿Cómo funciona el saldo prepago?
- ¿Cómo se aprueba el crédito?
- ¿La entrega siempre es inmediata?
- ¿Por que importa la región del código?
- ¿Qué hago si un código requiere soporte?
- ¿En que país opera Vercode?
- ¿Cómo solicito una cuenta?

Cuando una respuesta dependa de un dato no configurado, omite la pregunta en
producción; no inventes la respuesta.

### 8.12 Formulario y cierre

El formulario de tiendas pide:

- Nombre.
- Cargo.
- Correo corporativo.
- WhatsApp con prefijo internacional.
- Empresa.
- Pais, fijado inicialmente en Colombia.
- Identificacion fiscal opcional.
- Tipo de negocio.
- Volumen mensual estimado por rangos configurables.
- Mensaje opcional.
- Consentimiento obligatorio con enlace a privacidad.

Confirmacion: `Recibimos tu solicitud. El equipo comercial revisara la
información y se pondra en contacto por los datos suministrados.`

No prometas un plazo si no está configurado.

## 9. Pagina `/empresas`

Esta es la única página corporativa de v1. No crear
`/regalos-corporativos` ni duplicar su contenido en otra ruta.

### Estructura

1. **Hero:** `Regalos digitales para equipos y clientes, gestionados desde una
   sola solicitud.`
2. **Catalogo actual:** utilizar la misma configuración pública y explicar que
   la disponibilidad depende de marca, región y cantidad.
3. **Casos de uso:** reconocimientos, incentivos, campañas con clientes y fechas
   especiales. No mostrar un caso incompatible con el catálogo activo.
4. **Proceso:** solicitar, definir cantidad y presupuesto, confirmar opciones,
   recibir los códigos o tarjetas acordados.
5. **Formatos:** códigos digitales y tarjetas físicas con QR, sin prometer
   entregas masivas automatizadas o personalizacion si no están configuradas.
6. **Confianza:** identidad legal, proceso claro, trazabilidad y soporte.
7. **FAQ corporativa:** regiones, cantidades, disponibilidad, facturación,
   tiempos y soporte, solo con respuestas aprobadas.
8. **CTA:** formulario corporativo, WhatsApp y agenda cuando este configurada.

El formulario corporativo pide:

- Nombre.
- Cargo.
- Correo corporativo.
- Empresa.
- Pais.
- Cantidad aproximada de destinatarios por rango.
- Ocasion opcional.
- Fecha deseada opcional.
- WhatsApp opcional.
- Mensaje opcional.
- Consentimiento obligatorio.

No publicar logos de clientes, casos de éxito ni testimonios sin autorización
escrita.

## 10. Contrato de `/api/leads`

Crear un endpoint nuevo, sin Prisma y sin acceso a la base operativa.

### Solicitud

Usar un payload discriminado por `audience`:

```ts
type LeadPayload = {
  audience: "stores" | "companies";
  name: string;
  role: string;
  workEmail: string;
  whatsapp?: string;
  companyName: string;
  country: "CO";
  taxId?: string;
  businessType?: string;
  monthlyVolumeRange?: string;
  recipientCountRange?: string;
  occasion?: string;
  desiredDate?: string;
  message?: string;
  consent: true;
  turnstileToken: string;
  website?: string; // honeypot; una persona debe dejarlo vacio
  attribution: {
    landingPath: string;
    referrer?: string;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    utmContent?: string;
    utmTerm?: string;
  };
};
```

Normaliza espacios, correo, teléfono y UTM. Aplica límites de longitud estrictos
y rechaza campos inesperados. No aceptes HTML.

### Flujo del servidor

1. Validar origen, método y `Content-Type`.
2. Validar el esquema con Zod.
3. Tratar el honeypot como envío neutral sin reenviar datos.
4. Verificar Turnstile en el servidor; obligatorio en producción.
5. Aplicar rate limit distribuido por IP normalizada y una segunda clave por
   hash de correo; no registrar el correo en texto dentro del rate limiter.
6. Agregar timestamp, request ID y versión del formulario.
7. Firmar el cuerpo cuando exista `LEADS_WEBHOOK_SECRET`.
8. Enviar al webhook con timeout y sin reintentos que puedan duplicar leads.
9. Registrar solo metadatos operativos: request ID, estado, latencia y código de
   error. No escribir el payload ni PII en logs.

En desarrollo puede existir un adaptador de rate limit en memoria. En producción
son obligatorios Turnstile y un almacen distribuido configurado; si faltan, la
validación de configuración debe impedir el despliegue.

### Respuestas

- `201`: `{ ok: true, message: string, requestId: string }`.
- `400`: validación general o JSON invalido.
- `422`: `{ ok: false, code: "VALIDATION", fieldErrors }`.
- `429`: `{ ok: false, code: "RATE_LIMITED", message: string }`.
- `503`: `{ ok: false, code: "DELIVERY_UNAVAILABLE", message: string,
  whatsappUrl: string }` cuando el webhook no confirma recepcion.

Ante `503`, conservar los datos escritos en el formulario durante la sesión y
mostrar WhatsApp como alternativa. No afirmar que la solicitud fue recibida.

## 11. Direccion de diseño

Antes de codificar, presenta un plan corto con:

- Paleta de cuatro a seis tokens con nombre, hex y función.
- Una o dos familias tipográficas con soporte completo de español.
- Boceto ASCII de `/` y `/empresas`.
- Comportamiento móvil.
- Estado de foco y movimiento reducido.
- Justificacion de por que el resultado no parece una tienda gamer ni una
  plantilla generica de SaaS.

### Principios visuales

- Sobrio, preciso y contemporaneo.
- La tienda cliente conserva el protagonismo frente a la marca Vercode.
- Un solo color de acción, usado con consistencia.
- Jerarquia tipográfica clara y líneas de lectura cortas.
- Secciones con ritmo editorial, no una cuadricula interminable de tarjetas.
- Ilustraciones y maquetas construidas en código.
- Sin fotos de stock, logos de terceros ni capturas ficticias.
- Movimiento concentrado en la demostracion de la tarjeta.

Evita fondos crema con serif y terracota, fondos negros con verde acido,
degradados decorativos, etiquetas en mayúsculas sobre cada título, flechas en
todos los enlaces y animaciones de entrada repetidas.

## 12. SEO, indexacion y datos estructurados

- Titulo y descripción unicos para `/` y `/empresas`.
- Canonical absoluto en `https://vercode.me`.
- Open Graph por página, con imagen local sin códigos reales.
- `Organization` y `WebSite` en la portada.
- `Service` y `FAQPage` solo cuando el contenido visible cumpla las reglas de
  datos estructurados.
- `BreadcrumbList` en `/empresas` y páginas legales.
- `sitemap.xml` únicamente con rutas públicas, indexables y realmente
  publicadas.
- `robots.txt` permite las páginas comerciales y evita el rastreo de APIs y
  portal cuando sea apropiado.

Para `/scan/*`:

- No incluir en sitemap.
- Agregar `X-Robots-Tag: noindex, noarchive, nosnippet`.
- Agregar `Cache-Control: no-store` y `Referrer-Policy: no-referrer` mediante
  headers de ruta, sin editar la lógica de canje.
- No bloquear `/scan/*` en `robots.txt`, porque el crawler debe poder leer la
  directiva `noindex`.

Para el portal autenticado, usa metadata o headers `noindex` sin modificar su
control de acceso.

No crear `hreflang`, selector de país ni sitemap internacional en v1. Deja la
configuración lista para incorporar un segundo mercado sin duplicar componentes.

## 13. Seguridad, privacidad y accesibilidad

- HTML semántico y landmarks correctos.
- Labels visibles, ayuda y errores asociados a cada campo.
- Navegacion completa por teclado.
- Contraste WCAG 2.2 AA como minimo.
- Areas tactiles adecuadas en móvil.
- `aria-live` para confirmación y errores del formulario.
- `prefers-reduced-motion` para la demostracion y microinteracciones.
- Ningun secreto ni URL privada del webhook en el bundle del cliente.
- CSP y demas headers compatibles con Next.js, NextAuth, Turnstile y recursos
  realmente utilizados. No agregues dominios comodin.
- No registrar payloads de formulario, códigos, tokens ni identificadores de
  tarjeta en analítica.
- Analitica sin cookies por defecto. Si no existe una herramienta aprobada,
  expone una interfaz de eventos no-op en vez de instalar una arbitrariamente.

Eventos permitidos:

- `marketing_cta_click`.
- `marketing_whatsapp_click`.
- `marketing_login_click`.
- `marketing_card_demo_step`.
- `marketing_redemption_redirect` sin incluir el ID.
- `marketing_lead_submit_success` con audiencia y UTM no sensible.
- `marketing_lead_submit_failure` con código de error, nunca PII.

## 14. Rendimiento

- Server Components por defecto.
- JavaScript solo para interacciones necesarias.
- Fuentes autoalojadas mediante `next/font` o reutilizacion segura de las ya
  instaladas.
- Sin video de fondo.
- Imagenes con dimensiones, formatos modernos y carga diferida fuera del hero.
- Evitar librerias nuevas si CSS y componentes existentes resuelven el caso.
- Objetivo Lighthouse móvil >= 90 en Rendimiento, Accesibilidad, Buenas
  prácticas y SEO.

## 15. Dominio anterior y compatibilidad

Documenta, pero no inventes dentro de la aplicación, la configuración necesaria
para redirigir el dominio anterior a `https://vercode.me`.

- Usar 301.
- Preservar path y query string.
- En particular, una URL antigua `/scan/{ID}` debe llegar a
  `https://vercode.me/scan/{ID}`.
- No convertirla a `/{ID}`.
- No cambiar el formato de IDs ni regenerar tarjetas.
- Incluir verificación manual de una muestra de tarjetas ya impresas antes de
  activar la redirección global.

## 16. Pruebas obligatorias

### Contenido y configuración

- `/`, `/empresas` y páginas legales publicadas tienen contenido en el HTML
  inicial.
- El catálogo visible proviene solo de `publicMarketingConfig`.
- Produccion falla ante datos obligatorios incompletos.
- Producción no contiene `[PENDIENTE]`, datos de ejemplo ni enlaces vacíos.
- Bloques opcionales desaparecen limpiamente.

### Formulario

- Casos validos de tiendas y empresas.
- Campos obligatorios, longitudes, correo, teléfono y fecha.
- Consentimiento ausente.
- Campo honeypot completado.
- Turnstile invalido o caido.
- Limite por IP y por hash de correo.
- Webhook exitoso, timeout y rechazo.
- Firma del webhook cuando está configurada.
- Preservacion de UTM y ausencia de secretos en cliente.
- Ninguna escritura en Prisma o en la base operativa.

### Accesibilidad e interaccion

- Menu, FAQ, demostracion y formularios con teclado.
- Orden de foco y foco visible.
- Mensajes anunciados correctamente.
- Demostracion comprensible con movimiento reducido.
- Campo de tarjeta redirige a `/scan/{ID}` sin hacer lookup.

### SEO y seguridad

- Canonical, metadata, Open Graph y JSON-LD validos.
- Sitemap sin portal, APIs ni `/scan/*`.
- `/scan/*` conserva su funcionamiento y recibe headers de privacidad e
  indexacion.
- Las rutas privadas no aparecen en resultados indexables.
- El formulario no filtra webhook, secretos ni PII a logs o analítica.

### No regresión del producto

- Ejecutar el build y la suite existente de `diem-sas`.
- Ejecutar las pruebas existentes de integración con `diem` que sean viables en
  el entorno.
- Hacer smoke test de `/login`, `/scan/{ID}`, compra de códigos, activación,
  wallet y navegación del portal.
- Comparar respuestas de las APIs operativas antes y después: no deben cambiar.

## 17. Criterios de aceptacion

- Un visitante identifica producto, audiencia y siguiente acción en menos de
  30 segundos.
- La landing habla a comercios y no invita al consumidor a comprar códigos.
- Solo existen `/` y `/empresas` como páginas comerciales de v1.
- La demostracion usa datos ficticios rotulados y nunca toca el producto.
- El canje sigue funcionando en `/scan/{ID}`.
- El catálogo se controla desde una configuración pública tipada.
- El formulario valida en cliente y servidor, resiste spam, conserva UTM y
  entrega al webhook sin usar Prisma.
- Si el webhook falla, el usuario recibe una explicación honesta y WhatsApp como
  alternativa.
- Ningun pendiente aparece en producción.
- Las páginas comerciales son accesibles, rapidas e indexables.
- El portal y el canje no aparecen en el sitemap y reciben políticas de
  indexacion apropiadas.
- No hay cambios de comportamiento en autenticación, roles, wallet, compra,
  activación, fulfillment, webhooks operativos ni canje.

## 18. Entregables

1. Plan de diseño previo a la implementación.
2. Landing `/` terminada.
3. Página `/empresas` terminada.
4. Páginas legales que cuenten con contenido aprobado.
5. Configuración tipada pública y configuración de servidor validada.
6. Endpoint `/api/leads` con protección y pruebas.
7. Metadata, sitemap, robots, datos estructurados y headers.
8. Pruebas automatizadas y reporte de no regresión.
9. Lista de variables de entorno y datos comerciales requeridos.
10. Nota de despliegue y redirección del dominio anterior.
11. Registro breve de decisiones y de cualquier bloque oculto por falta de
    información aprobada.

## 19. Forma de trabajo exigida

1. Inspecciona primero el repositorio y confirma los límites.
2. Presenta el plan de diseño y el mapa de rutas antes de editar.
3. Implementa por capas: configuración, layout, contenido, interacciones,
   formulario, SEO y pruebas.
4. No cambies el producto para satisfacer una frase de marketing.
5. Si encuentras una incompatibilidad que exija tocar un flujo operativo,
   detente, documéntala y solicita una decisión; no la resuelvas unilateralmente.
6. Al finalizar, entrega los comandos ejecutados, resultados de pruebas, datos
   pendientes para producción y archivos modificados.
