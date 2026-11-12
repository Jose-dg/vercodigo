import type { GuideContent, GuideId } from "../types.ts";

/**
 * Spanish guide text. Neutral on purpose: no seller, distributor or platform
 * operator is named, only the brand of the card and its official sites.
 */
export const es: Record<GuideId, GuideContent> = {
    playstation: {
        name: "PlayStation",
        metaTitle: "Cómo canjear una tarjeta de PlayStation Store y qué pasa con la región",
        metaDescription:
            "Canjea tu código de PlayStation Store en la consola, la app o la web, y revisa que tu cuenta sea de la misma región que la tarjeta.",
        intro:
            "Los códigos de PlayStation Store agregan saldo a tu cuenta. Solo funcionan en cuentas de la misma región de la tarjeta.",
        redeemLabel: "store.playstation.com",
        steps: [
            "En la consola abre PlayStation Store, entra al menú (los tres puntos) y elige «Canjear código». En la web o en la app PlayStation, inicia sesión, toca tu avatar y elige «Canjear códigos».",
            "Escribe los 12 caracteres del código, sin guiones ni espacios.",
            "Confirma. El saldo aparece de inmediato en tu monedero de PlayStation.",
        ],
        region: {
            summary:
                "La región de una cuenta de PlayStation se elige al crearla y no se puede cambiar después. Un código de Estados Unidos solo se canjea en una cuenta de Estados Unidos.",
            otherRegionSteps: [
                "Revisa la región de tu cuenta en Configuración → Usuarios y cuentas → Cuenta → Información de perfil.",
                "Si no coincide con la de la tarjeta, crea una cuenta nueva y gratuita eligiendo esa región. Puedes usarla en la misma consola.",
                "Canjea el código en la cuenta nueva. Las compras quedan en esa cuenta.",
            ],
        },
        faqs: [
            {
                question: "¿Puedo canjear una tarjeta de Estados Unidos en una cuenta de Colombia?",
                answer: "No. El código solo funciona en una cuenta de la misma región. Crea una cuenta de Estados Unidos para usarlo.",
            },
            {
                question: "¿Sirve una VPN para cambiar la región?",
                answer: "No. La región de la cuenta queda fija al crearla; la ubicación o la conexión no la cambian.",
            },
            {
                question: "Me dice que el código no es válido, ¿qué reviso?",
                answer: "Que no tenga espacios ni guiones, que no confundas letras parecidas y que la región de la cuenta sea la de la tarjeta.",
            },
        ],
    },
    xbox: {
        name: "Xbox",
        metaTitle: "Cómo canjear un código de Xbox y cambiar la región de tu cuenta Microsoft",
        metaDescription:
            "Canjea tu tarjeta de Xbox o Microsoft en redeem.microsoft.com o en la consola, y aprende qué pasa si tu cuenta es de otra región.",
        intro:
            "Los códigos de Xbox agregan saldo o suscripciones a tu cuenta Microsoft. Deben canjearse en una cuenta del mismo país o región de la tarjeta.",
        redeemLabel: "redeem.microsoft.com",
        steps: [
            "Entra a redeem.microsoft.com e inicia sesión con tu cuenta Microsoft. En la consola, abre la Tienda y elige «Canjear».",
            "Escribe los 25 caracteres del código. Los guiones se ponen solos.",
            "Confirma. El saldo o la suscripción quedan en tu cuenta.",
        ],
        region: {
            summary:
                "Microsoft permite cambiar el país o región de la cuenta, pero lo recomienda solo si te mudas. El saldo que ya tienes no cambia de moneda ni pasa a la nueva región.",
            otherRegionSteps: [
                "Revisa el país de tu cuenta en account.microsoft.com → Tu información.",
                "Si necesitas cambiarlo, edítalo ahí mismo. Antes, gasta el saldo que tengas: no se transfiere.",
                "Ten en cuenta que algunos juegos o suscripciones comprados en una región pueden no funcionar en otra.",
            ],
        },
        faqs: [
            {
                question: "¿Cambiar la región de la consola es suficiente?",
                answer: "No. Lo que cuenta es la región de la cuenta Microsoft, no la de la consola.",
            },
            {
                question: "¿Qué pasa con mi saldo si cambio de región?",
                answer: "No se convierte ni se transfiere. Úsalo antes de cambiar la región.",
            },
        ],
    },
    nintendo: {
        name: "Nintendo",
        metaTitle: "Cómo canjear un código de Nintendo eShop y cambiar el país de tu cuenta",
        metaDescription:
            "Canjea tu tarjeta de Nintendo eShop en la consola o en la web, y revisa qué necesitas para cambiar el país de tu Nintendo Account.",
        intro:
            "Los códigos de Nintendo eShop agregan saldo a tu Nintendo Account. El saldo debe corresponder al país configurado en la cuenta.",
        redeemLabel: "ec.nintendo.com/redeem",
        steps: [
            "En la consola abre Nintendo eShop, elige tu usuario y toca «Canjear código». También puedes hacerlo en ec.nintendo.com/redeem.",
            "Escribe los 16 caracteres del código.",
            "Confirma. El saldo queda en tu Nintendo Account.",
        ],
        region: {
            summary:
                "Puedes cambiar el país de tu Nintendo Account desde la web de la cuenta. En las cuentas de América, primero el saldo de eShop debe quedar en cero; el saldo no pasa al nuevo país.",
            otherRegionSteps: [
                "Gasta el saldo que tengas en eShop hasta que quede en cero.",
                "Entra a accounts.nintendo.com → Información de usuario y cambia el país o región.",
                "Las cuentas infantiles no se pueden cambiar por separado, y las renovaciones automáticas o preventas activas pueden bloquear el cambio.",
            ],
        },
        faqs: [
            {
                question: "¿Pierdo mi saldo si cambio de país?",
                answer: "El saldo no se transfiere al nuevo país. En América no podrás cambiarlo hasta que el saldo sea cero.",
            },
            {
                question: "¿Se cambia desde la consola?",
                answer: "No. El cambio de país se hace en la web de Nintendo Account.",
            },
        ],
    },
    steam: {
        name: "Steam",
        metaTitle: "Cómo canjear una tarjeta de Steam y qué hacer si la moneda no coincide",
        metaDescription:
            "Canjea tu código de la Cartera de Steam paso a paso y revisa que la moneda de tu cuenta sea la misma de la tarjeta.",
        intro:
            "Las tarjetas de Steam agregan fondos a tu Cartera de Steam. La moneda de la tarjeta debe ser la misma de tu cuenta.",
        redeemLabel: "store.steampowered.com",
        steps: [
            "Inicia sesión en Steam (web o aplicación) y entra a tu cuenta → «Añadir fondos a la Cartera» → «Canjear un código».",
            "Escribe el código tal como aparece.",
            "Confirma. Los fondos quedan en tu Cartera de Steam.",
        ],
        region: {
            summary:
                "La región y la moneda de tu cuenta de Steam las fija tu primera compra. Si la moneda de la tarjeta no coincide con la de tu cuenta, el código no se canjea.",
            otherRegionSteps: [
                "Revisa la moneda de tu cuenta en Detalles de la cuenta o en el historial de compras.",
                "Si no coincide con la de la tarjeta, no intentes cambiar la región por tu cuenta: contacta al Soporte de Steam.",
            ],
        },
        faqs: [
            {
                question: "¿Steam convierte la moneda de la tarjeta?",
                answer: "Las tarjetas físicas y los códigos deben coincidir con la moneda de la cuenta. Si no coinciden, el soporte de Steam es quien puede ayudarte.",
            },
        ],
    },
    roblox: {
        name: "Roblox",
        metaTitle: "Cómo canjear una tarjeta de Roblox y revisar la región de tu cuenta",
        metaDescription:
            "Canjea tu tarjeta de Roblox en roblox.com/redeem desde el navegador y revisa que tu cuenta sea de la región de la tarjeta.",
        intro:
            "Las tarjetas de Roblox agregan saldo o Robux a tu cuenta. Se canjean desde el navegador, no desde la app.",
        redeemLabel: "roblox.com/redeem",
        steps: [
            "Desde el navegador del celular o del computador, entra a roblox.com/redeem e inicia sesión.",
            "Escribe el PIN de la tarjeta y toca «Canjear».",
            "Usa el saldo para comprar Robux o una suscripción.",
        ],
        region: {
            summary:
                "Las tarjetas de Roblox están ligadas a la moneda de su región: la cuenta debe ser de la misma región de la tarjeta.",
            otherRegionSteps: [
                "Revisa el país de tu cuenta en Configuración → Información de la cuenta.",
                "Si no coincide, revisa en la Ayuda de Roblox las condiciones para cambiarlo antes de canjear.",
            ],
        },
        faqs: [
            {
                question: "¿Puedo canjear desde la app?",
                answer: "No. El canje se hace en roblox.com/redeem desde un navegador, también en el celular.",
            },
        ],
    },
    netflix: {
        name: "Netflix",
        metaTitle: "Cómo canjear una tarjeta de regalo de Netflix",
        metaDescription:
            "Canjea tu tarjeta de Netflix en netflix.com/redeem y revisa que la moneda coincida con la de tu facturación.",
        intro:
            "Las tarjetas de Netflix pagan tu suscripción. Funcionan si están en la misma moneda en la que se factura tu cuenta.",
        redeemLabel: "netflix.com/redeem",
        steps: [
            "Entra a netflix.com/redeem e inicia sesión (o crea tu cuenta).",
            "Escribe el código de la tarjeta.",
            "Confirma. El saldo se usa para pagar tus próximos meses.",
        ],
        region: {
            summary:
                "Lo que importa es la moneda: la tarjeta debe estar en la misma moneda de tu factura de Netflix. No se puede usar si pagas Netflix a través de Apple o de un paquete con otro proveedor.",
            otherRegionSteps: [
                "Revisa en tu cuenta en qué moneda te facturan.",
                "Si pagas por Apple o por un paquete de otro proveedor, la tarjeta no se puede aplicar a esa cuenta.",
            ],
        },
        faqs: [
            {
                question: "¿La tarjeta vence?",
                answer: "Según Netflix, las tarjetas de regalo no vencen, pero no son reembolsables ni recargables.",
            },
            {
                question: "Me dice que la tarjeta no está activa",
                answer: "Espera unas horas e intenta de nuevo. Si sigue igual, contacta a la tienda donde la compraste.",
            },
        ],
    },
    "google-play": {
        name: "Google Play",
        metaTitle: "Cómo canjear una tarjeta de Google Play y cambiar el país de tu cuenta",
        metaDescription:
            "Canjea tu código de Google Play en play.google.com/redeem o en la app, y conoce las reglas para cambiar el país de Google Play.",
        intro:
            "Las tarjetas de Google Play agregan saldo a tu cuenta de Google. Solo se canjean en el país y la moneda en que se vendieron.",
        redeemLabel: "play.google.com/redeem",
        steps: [
            "En el celular abre Google Play, toca tu foto → «Pagos y suscripciones» → «Canjear código». También puedes ir a play.google.com/redeem.",
            "Escribe el código.",
            "Confirma. El saldo queda en tu cuenta de Google Play.",
        ],
        region: {
            summary:
                "El país de Google Play se puede cambiar una vez al año. El saldo que ya tenías se queda en el país anterior.",
            otherRegionSteps: [
                "Revisa tu país en Google Play → tu foto → Configuración → General → Preferencias de cuenta y dispositivo.",
                "Si cambias de país, espera a que se aplique y luego canjea. No podrás volver a cambiarlo en 12 meses.",
            ],
        },
        faqs: [
            {
                question: "¿Puedo canjear una tarjeta comprada en otro país?",
                answer: "No. Las tarjetas de Google Play solo se canjean en el país donde se vendieron.",
            },
        ],
    },
    "razer-gold": {
        name: "Razer Gold",
        metaTitle: "Cómo canjear un PIN de Razer Gold y revisar la región de tu monedero",
        metaDescription:
            "Recarga tu monedero de Razer Gold con tu PIN paso a paso y revisa que la región del monedero sea la de la tarjeta.",
        intro:
            "Los PIN de Razer Gold recargan tu monedero de Razer Gold, que luego usas para comprar en juegos.",
        redeemLabel: "gold.razer.com",
        steps: [
            "Entra a gold.razer.com e inicia sesión.",
            "Toca «Recargar» y elige «Razer Gold PIN» como método.",
            "Escribe el PIN (no el número de serie) y confirma con la verificación en dos pasos.",
        ],
        region: {
            summary:
                "Un PIN solo recarga monederos de su misma región. La región del monedero no la puedes cambiar tú; solo el soporte de Razer Gold.",
            otherRegionSteps: [
                "Revisa la región de tu monedero en la configuración de tu cuenta de Razer Gold.",
                "Si no coincide, abre un caso en la Ayuda de Razer Gold antes de canjear.",
            ],
        },
        faqs: [
            {
                question: "Me rechaza el código",
                answer: "Asegúrate de escribir el PIN y no el número de serie, y de que la región del monedero sea la de la tarjeta.",
            },
        ],
    },
    "free-fire": {
        name: "Free Fire",
        metaTitle: "Cómo canjear un PIN de diamantes de Free Fire",
        metaDescription:
            "Canjea tu PIN de diamantes de Free Fire en la tienda oficial de Garena con tu ID de jugador.",
        intro:
            "Los PIN de Free Fire se cambian por diamantes en la tienda oficial de Garena.",
        redeemLabel: "pagostore.garena.com",
        steps: [
            "Entra a la tienda oficial de Garena y elige Free Fire.",
            "Inicia sesión con tu ID de jugador o con la cuenta vinculada a tu juego. Las cuentas de invitado no pueden canjear.",
            "Elige pagar con código o tarjeta, escribe el PIN y confirma. Los diamantes llegan a tu cuenta del juego.",
        ],
        region: {
            summary:
                "Los PIN corresponden a la tienda de Garena de su región. Usa la tienda oficial de tu región.",
            otherRegionSteps: [
                "Si la tienda no acepta el PIN, confirma con la tienda donde lo compraste para qué región es.",
            ],
        },
        faqs: [
            {
                question: "¿Me pueden pedir mi contraseña para canjear?",
                answer: "Nunca. Cualquier página que pida tu contraseña o tu PIN fuera de la tienda oficial de Garena es un fraude.",
            },
        ],
    },
    generic: {
        name: "tu plataforma",
        metaTitle: "Cómo canjear tu código",
        metaDescription: "Pasos generales para canjear un código de tarjeta de regalo.",
        intro: "Este código se canjea en la tienda oficial de la plataforma.",
        redeemLabel: "",
        steps: [
            "Inicia sesión en la tienda oficial de la plataforma, en la cuenta donde quieres el saldo.",
            "Busca la opción «Canjear código» o «Redeem».",
            "Escribe el código tal como aparece y confirma.",
        ],
        region: {
            summary: "La mayoría de los códigos solo funcionan en cuentas de la misma región de la tarjeta.",
            otherRegionSteps: [
                "Revisa la región de tu cuenta antes de canjear.",
            ],
        },
        faqs: [],
    },
};
