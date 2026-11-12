import type { GuideDefinition, GuideId } from "./types.ts";

/**
 * Facts shared by every language. Region rules were checked against each
 * platform's official help pages on 2026-11-11 (listed in `sources`).
 */
export const guideDefinitions: Record<GuideId, GuideDefinition> = {
    playstation: {
        id: "playstation",
        keywords: ["playstation", "psn", "ps plus", "sony"],
        slugs: { es: "playstation" },
        redeemUrl: "https://store.playstation.com/",
        regionLocked: true,
        regionChange: "no",
        sources: [
            { label: "PlayStation: país o región de la cuenta", url: "https://www.playstation.com/es-mx/support/account/check-account-country-region/" },
            { label: "PlayStation: problemas al canjear códigos", url: "https://www.playstation.com/es-mx/support/store/ps-store-voucher-code-problems/" },
        ],
        updatedAt: "2026-11-11",
    },
    xbox: {
        id: "xbox",
        keywords: ["xbox", "microsoft", "game pass"],
        slugs: { es: "xbox" },
        redeemUrl: "https://redeem.microsoft.com/",
        regionLocked: true,
        regionChange: "limited",
        sources: [
            { label: "Microsoft: cambiar el país o región en Microsoft Store", url: "https://support.microsoft.com/help/4039267" },
        ],
        updatedAt: "2026-11-11",
    },
    nintendo: {
        id: "nintendo",
        keywords: ["nintendo", "eshop", "switch"],
        slugs: { es: "nintendo" },
        redeemUrl: "https://ec.nintendo.com/redeem",
        regionLocked: true,
        regionChange: "limited",
        sources: [
            { label: "Nintendo: cambiar el país de la cuenta", url: "https://en-americas-support.nintendo.com/app/answers/detail/a_id/63084" },
            { label: "Nintendo: no se puede cambiar el país por saldo en eShop", url: "https://en-americas-support.nintendo.com/app/answers/detail/a_id/25847" },
        ],
        updatedAt: "2026-11-11",
    },
    steam: {
        id: "steam",
        keywords: ["steam", "valve"],
        slugs: { es: "steam" },
        redeemUrl: "https://store.steampowered.com/account/redeemwalletcode",
        regionLocked: true,
        regionChange: "no",
        sources: [
            { label: "Soporte de Steam", url: "https://help.steampowered.com/" },
        ],
        updatedAt: "2026-11-11",
    },
    roblox: {
        id: "roblox",
        keywords: ["roblox", "robux"],
        slugs: { es: "roblox" },
        redeemUrl: "https://www.roblox.com/redeem",
        regionLocked: true,
        regionChange: "limited",
        sources: [
            { label: "Ayuda de Roblox", url: "https://en.help.roblox.com/" },
        ],
        updatedAt: "2026-11-11",
    },
    netflix: {
        id: "netflix",
        keywords: ["netflix"],
        slugs: { es: "netflix" },
        redeemUrl: "https://www.netflix.com/redeem",
        regionLocked: true,
        regionChange: "no",
        sources: [
            { label: "Netflix: tarjetas de regalo", url: "https://help.netflix.com/node/32950" },
            { label: "Netflix: no puedo canjear una tarjeta de regalo", url: "https://help.netflix.com/node/59987" },
        ],
        updatedAt: "2026-11-11",
    },
    "google-play": {
        id: "google-play",
        keywords: ["google play", "gplay", "google"],
        slugs: { es: "google-play" },
        redeemUrl: "https://play.google.com/redeem",
        regionLocked: true,
        regionChange: "limited",
        sources: [
            { label: "Google Play: tarjetas de regalo", url: "https://support.google.com/googleplay/answer/3422734?hl=es-419" },
            { label: "Google Play: problemas con tarjetas y códigos", url: "https://support.google.com/googleplay/answer/11564359?hl=es-419" },
        ],
        updatedAt: "2026-11-11",
    },
    "razer-gold": {
        id: "razer-gold",
        keywords: ["razer"],
        slugs: { es: "razer-gold" },
        redeemUrl: "https://gold.razer.com/",
        regionLocked: true,
        regionChange: "no",
        sources: [
            { label: "Ayuda de Razer Gold", url: "https://gold.razer.com/help" },
        ],
        updatedAt: "2026-11-11",
    },
    "free-fire": {
        id: "free-fire",
        keywords: ["free fire", "garena"],
        slugs: { es: "free-fire" },
        redeemUrl: "https://pagostore.garena.com/",
        regionLocked: true,
        regionChange: "no",
        sources: [
            { label: "Tienda oficial de Garena", url: "https://pagostore.garena.com/" },
        ],
        updatedAt: "2026-11-11",
    },
    generic: {
        id: "generic",
        keywords: [],
        slugs: {},
        redeemUrl: null,
        regionLocked: true,
        regionChange: "no",
        sources: [],
        updatedAt: "2026-11-11",
    },
};
