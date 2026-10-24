import assert from 'node:assert/strict';
import test from 'node:test';

import {
    aiIntegrationPrompt,
    aiIntegrationPromptSamples,
} from '../src/components/developers/ai-integration-prompt.ts';

const BASE_URL = 'https://www.vercode.me';

test('the AI prompt is self-contained and covers the public API contract', () => {
    const prompt = aiIntegrationPrompt(BASE_URL, 'typescript');

    for (const expected of [
        'https://www.vercode.me/api/v1',
        'DIEM_API_KEY',
        'sandbox',
        'Idempotency-Key',
        'GET /catalog',
        'GET /rates',
        'GET /wallet',
        'POST /deliveries',
        'GET /orders',
        'GET /transactions',
        'starting_after',
        'awaiting_stock',
        'nunca devuelve códigos ni PIN',
    ]) {
        assert.match(prompt, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
    }
});

test('the prompt forbids exposing secrets and real purchases in tests', () => {
    const prompt = aiIntegrationPrompt(BASE_URL, 'python');

    assert.match(prompt, /Nunca envíes la API key al navegador/i);
    assert.match(prompt, /tampoco la imprimas, registres ni incluyas en el repositorio/i);
    assert.match(prompt, /No hagas llamadas reales desde los tests/i);
    assert.doesNotMatch(prompt, /vck_(?:test|live)_[0-9a-f]{12}_[A-Za-z0-9_-]{20,}/);
});

test('each supported stack gets specific guidance without changing the shared contract', () => {
    const samples = aiIntegrationPromptSamples(`${BASE_URL}/`);

    assert.deepEqual(samples.map((sample) => sample.label), ['Node.js / TypeScript', 'Python', 'Otro stack']);
    assert.match(samples[0].code, /tipos explícitos/i);
    assert.match(samples[1].code, /type hints/i);
    assert.match(samples[2].code, /detecta el lenguaje y framework/i);
    for (const sample of samples) assert.match(sample.code, /https:\/\/www\.vercode\.me\/api\/v1/);
});
