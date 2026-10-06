import assert from "node:assert/strict";
import test from "node:test";

import { buildPurchaseTimeline } from "../src/lib/codes/purchase-timeline.ts";

const createdAt = "2026-10-05T15:19:00.000Z";
const completedAt = "2026-10-05T15:21:00.000Z";

test("pending purchases show processing as the current step", () => {
    const timeline = buildPurchaseTimeline({ status: "PENDING", createdAt });

    assert.deepEqual(
        timeline.steps.map((step) => step.state),
        ["done", "current", "pending"],
    );
    assert.equal(timeline.steps[1].label, "Procesando");
    assert.equal(timeline.steps[2].at, null);
    assert.equal(timeline.tone, "progress");
    assert.equal(timeline.isTerminal, false);
    assert.ok(timeline.progress > 0 && timeline.progress < 1);
});

test("awaiting stock is a waiting state, not terminal", () => {
    const timeline = buildPurchaseTimeline({ status: "AWAITING_STOCK", createdAt });

    assert.equal(timeline.statusLabel, "Esperando stock");
    assert.equal(timeline.tone, "waiting");
    assert.equal(timeline.isTerminal, false);
});

test("action required distinguishes manual review from Diem", () => {
    const review = buildPurchaseTimeline({
        status: "ACTION_REQUIRED",
        fulfillmentStatus: "pending_review",
        createdAt,
    });
    const generic = buildPurchaseTimeline({ status: "ACTION_REQUIRED", createdAt });

    assert.equal(review.statusLabel, "Revisión operativa");
    assert.equal(generic.statusLabel, "Revisión requerida");
    assert.equal(review.tone, "waiting");
});

test("finalizing advances the bar further than pending", () => {
    const pending = buildPurchaseTimeline({ status: "PENDING", createdAt });
    const finalizing = buildPurchaseTimeline({ status: "FINALIZING", createdAt });

    assert.ok(finalizing.progress > pending.progress);
    assert.equal(finalizing.statusLabel, "Finalizando");
});

test("completed purchases fill the bar and carry completedAt", () => {
    const timeline = buildPurchaseTimeline({
        status: "COMPLETED",
        createdAt: new Date(createdAt),
        completedAt,
    });

    assert.deepEqual(
        timeline.steps.map((step) => step.state),
        ["done", "done", "done"],
    );
    assert.equal(timeline.steps[2].at, completedAt);
    assert.equal(timeline.progress, 1);
    assert.equal(timeline.tone, "success");
    assert.equal(timeline.isTerminal, true);
});

test("failed purchases end in an error step", () => {
    const timeline = buildPurchaseTimeline({ status: "FAILED", createdAt });

    assert.equal(timeline.steps[2].state, "error");
    assert.equal(timeline.steps[2].label, "Fallida");
    assert.equal(timeline.tone, "error");
    assert.equal(timeline.isTerminal, true);
});

test("invalid dates do not throw", () => {
    const timeline = buildPurchaseTimeline({ status: "PENDING", createdAt: "not-a-date" });

    assert.equal(timeline.steps[0].at, null);
});
