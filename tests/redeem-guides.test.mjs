import assert from "node:assert/strict";
import test from "node:test";

import { defaultLocale, locales, negotiateLocale } from "../src/lib/i18n/config.ts";
import { getDictionary, regionLabel } from "../src/lib/i18n/dictionaries.ts";
import {
    guideAlternates,
    guideBySlug,
    guidePath,
    guidesIndexPath,
    publicGuides,
    resolveGuide,
} from "../src/lib/redeem-guides/index.ts";
import { guideDefinitions } from "../src/lib/redeem-guides/definitions.ts";
import { es } from "../src/lib/redeem-guides/content/es.ts";
import { guideStructuredData, serializeJsonLd } from "../src/lib/redeem-guides/structured-data.ts";

test("the guide follows the card brand, then the product name, then falls back", () => {
    assert.equal(resolveGuide({ brand: "PlayStation", name: "x" }).id, "playstation");
    assert.equal(resolveGuide({ brand: "", name: "Tarjeta Xbox Game Pass 3 meses" }).id, "xbox");
    assert.equal(resolveGuide({ brand: "Razer Gold", name: "" }).id, "razer-gold");
    assert.equal(resolveGuide({ brand: "Garena", name: "" }).id, "free-fire");
    assert.equal(resolveGuide({ brand: "Uber", name: "Uber 50" }).id, "generic");
    assert.equal(resolveGuide({}).id, "generic");
});

test("every guide has content, steps and a safe official redeem link", () => {
    for (const [id, definition] of Object.entries(guideDefinitions)) {
        const content = es[id];
        assert.ok(content, `${id} sin contenido`);
        assert.ok(content.steps.length >= 2, `${id} sin pasos`);
        assert.ok(content.region.summary, `${id} sin regla de región`);
        if (definition.redeemUrl) assert.match(definition.redeemUrl, /^https:\/\//, id);
        for (const source of definition.sources) assert.match(source.url, /^https:\/\//, id);
    }
});

test("guide text never names the distributor", () => {
    const text = JSON.stringify(es).toLowerCase();
    for (const banned of ["vercode", "diem"]) assert.equal(text.includes(banned), false, banned);
});

test("public guides have unique slugs, a path and hreflang with x-default", () => {
    const guides = publicGuides(defaultLocale);
    assert.ok(guides.length >= 9);
    assert.equal(guides.some((guide) => guide.id === "generic"), false);
    const slugs = guides.map((guide) => guide.slugs[defaultLocale]);
    assert.equal(new Set(slugs).size, slugs.length);

    const ps = guideBySlug("es", "playstation");
    assert.equal(guidePath(ps, "es"), "/guias/playstation");
    assert.deepEqual(guideAlternates(ps), { es: "/guias/playstation", "x-default": "/guias/playstation" });
    assert.deepEqual(guideAlternates(), { es: "/guias", "x-default": "/guias" });
    assert.equal(guidesIndexPath("es"), "/guias");
    assert.equal(guideBySlug("es", "no-existe"), null);
});

test("Accept-Language picks a supported locale or the default", () => {
    assert.equal(negotiateLocale("en-US,en;q=0.9,es-CO;q=0.8"), "es");
    assert.equal(negotiateLocale("es-CO"), "es");
    assert.equal(negotiateLocale(["fr-FR"]), defaultLocale);
    assert.equal(negotiateLocale(null), defaultLocale);
    assert.ok(locales.includes(defaultLocale));
});

test("card regions get a readable label", () => {
    assert.equal(regionLabel("es", "united_states"), "Estados Unidos");
    assert.equal(regionLabel("es", " Colombia "), "Colombia");
    assert.equal(regionLabel("es", "marte"), null);
    assert.equal(regionLabel("es", null), null);
});

test("JSON-LD is valid and cannot break out of its script tag", () => {
    const guide = guideBySlug("es", "nintendo");
    const dict = getDictionary("es");
    const data = guideStructuredData({
        guide,
        locale: "es",
        url: "https://example.test/guias/nintendo",
        indexUrl: "https://example.test/guias",
        indexName: dict.guides.breadcrumbHome,
        regionQuestion: dict.guides.regionQuestion(guide.content.name),
    });
    const parsed = JSON.parse(serializeJsonLd(data));
    const types = parsed["@graph"].map((node) => node["@type"]);
    assert.deepEqual(types, ["HowTo", "FAQPage", "BreadcrumbList"]);
    assert.equal(parsed["@graph"][0].step.length, guide.content.steps.length);
    assert.equal(parsed["@graph"][1].mainEntity.length, guide.content.faqs.length + 1);

    assert.equal(serializeJsonLd({ text: "</script><b>" }).includes("</script>"), false);
});
