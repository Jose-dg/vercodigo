import assert from "node:assert/strict";
import test from "node:test";

import { bogotaDay, bogotaDayStart, fillSeries, resolveRange } from "../src/lib/dashboard/range.ts";

// 22 Oct 2026, 02:00 UTC = 21 Oct 21:00 in Bogotá.
const NOW = new Date("2026-10-22T02:00:00Z");

test("days are Colombian days, not UTC days", () => {
    assert.equal(bogotaDay(NOW), "2026-10-21");
    assert.equal(bogotaDayStart("2026-10-21").toISOString(), "2026-10-21T05:00:00.000Z");
});

test("7 and 30 days end today in Bogotá and include it", () => {
    const week = resolveRange({ range: "7d", now: NOW });
    assert.equal(week.firstDay, "2026-10-15");
    assert.equal(week.lastDay, "2026-10-21");
    assert.equal(week.from.toISOString(), "2026-10-15T05:00:00.000Z");
    assert.equal(week.to.toISOString(), "2026-10-22T05:00:00.000Z");
    assert.equal(resolveRange({ range: "30d", now: NOW }).firstDay, "2026-09-22");
    assert.equal(resolveRange({ range: "all", now: NOW }).from, null);
});

test("a period is inclusive, validated and capped", () => {
    const period = resolveRange({ range: "period", from: "2026-10-01", to: "2026-10-03", now: NOW });
    assert.equal(period.to.toISOString(), "2026-10-04T05:00:00.000Z");
    assert.throws(() => resolveRange({ range: "period", from: "2026-10-03", to: "2026-10-01" }), /anterior/);
    assert.throws(() => resolveRange({ range: "period", from: "2025-01-01", to: "2026-10-01" }), /máximo/);
    assert.throws(() => resolveRange({ range: "period", from: "2026-02-31", to: "2026-03-01" }), /inválida/);
    assert.throws(() => resolveRange({ range: "year" }), /inválido/);
});

test("the series is zero-filled by day, and by month for long spans", () => {
    const daily = fillSeries([{ day: "2026-10-02", amount: 10 }, { day: "2026-10-02", amount: 5.555 }], "2026-10-01", "2026-10-03");
    assert.equal(daily.bucket, "day");
    assert.deepEqual(daily.series, [
        { key: "2026-10-01", amount: 0 },
        { key: "2026-10-02", amount: 15.56 },
        { key: "2026-10-03", amount: 0 },
    ]);
    const monthly = fillSeries([{ day: "2026-03-15", amount: 7 }], "2026-01-10", "2026-10-21");
    assert.equal(monthly.bucket, "month");
    assert.equal(monthly.series.length, 10);
    assert.deepEqual(monthly.series[2], { key: "2026-03", amount: 7 });
});
