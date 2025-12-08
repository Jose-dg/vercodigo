import { customAlphabet } from 'nanoid';

// Solo letras mayúsculas y números, excluyendo caracteres ambiguos
const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const nanoid = customAlphabet(alphabet, 8);

export function generateUUID(): string {
    return nanoid();
}
