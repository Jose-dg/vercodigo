import test from "node:test";
import assert from "node:assert/strict";
import { APP_THEMES, DARK_THEMES, isDarkTheme } from "../src/lib/theme.ts";

test("el contrato expone los tres temas y sistema queda como preferencia", () => {
    assert.deepEqual(APP_THEMES, ["light", "dark", "dark-blue"]);
    assert.deepEqual(DARK_THEMES, ["dark", "dark-blue"]);
    assert.equal(isDarkTheme("dark"), true);
    assert.equal(isDarkTheme("dark-blue"), true);
    assert.equal(isDarkTheme("light"), false);
    assert.equal(isDarkTheme("system"), false);
});
