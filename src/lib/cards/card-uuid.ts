/**
 * Format of a physical card code (the "UUID" printed under the QR): 8 chars
 * from an alphabet without look-alikes (no 0/O, 1/I). Single source for the
 * generator and every place that accepts typed or pasted codes.
 */
export const CARD_UUID_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
export const CARD_UUID_LENGTH = 8;

const CARD_UUID_PATTERN = new RegExp(`^[${CARD_UUID_ALPHABET}]{${CARD_UUID_LENGTH}}$`);

export function isCardUuid(value: string): boolean {
    return CARD_UUID_PATTERN.test(value);
}

/** A pasted token may be the code itself or the full QR URL (`…/scan/CODE`). */
function tokenToCode(token: string): string {
    let value = token;
    if (/^https?:\/\//i.test(value)) {
        try {
            value = new URL(value).pathname.split("/").filter(Boolean).at(-1) ?? "";
        } catch {
            return token.toUpperCase();
        }
    }
    return value.toUpperCase();
}

export type ParsedCardCodes = {
    /** Valid codes, uppercase, first-seen order, without repeats. */
    codes: string[];
    /** Tokens that are not a card code, as typed. */
    invalid: string[];
    /** How many valid tokens repeated an earlier one. */
    duplicates: number;
};

/** Splits free text (commas, spaces, new lines, scanner output) into card codes. */
export function parseCardCodes(text: string): ParsedCardCodes {
    const seen = new Set<string>();
    const invalid: string[] = [];
    let duplicates = 0;
    for (const token of text.split(/[\s,;]+/).filter(Boolean)) {
        const code = tokenToCode(token);
        if (!isCardUuid(code)) {
            invalid.push(token);
        } else if (seen.has(code)) {
            duplicates += 1;
        } else {
            seen.add(code);
        }
    }
    return { codes: [...seen], invalid, duplicates };
}
