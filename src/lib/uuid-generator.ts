import { customAlphabet } from 'nanoid';

import { CARD_UUID_ALPHABET, CARD_UUID_LENGTH } from './cards/card-uuid';

// Solo letras mayúsculas y números, excluyendo caracteres ambiguos
const nanoid = customAlphabet(CARD_UUID_ALPHABET, CARD_UUID_LENGTH);

export function generateUUID(): string {
    return nanoid();
}
