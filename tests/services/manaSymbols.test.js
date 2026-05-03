import { describe, it, expect } from "vitest";
import { parseCost, splitSides, tokenClass, renderOracleHtml } from "../../src/services/manaSymbols.js";

describe("parseCost", () => {
    it("returns empty array for empty string", () => {
        expect(parseCost("")).toEqual([]);
    });

    it("parses raw colored mana", () => {
        expect(parseCost("WUBRG")).toEqual(["W", "U", "B", "R", "G"]);
    });

    it("parses generic mana as a single token", () => {
        expect(parseCost("3WW")).toEqual(["3", "W", "W"]);
    });

    it("parses multi-digit generic mana", () => {
        expect(parseCost("12W")).toEqual(["12", "W"]);
    });

    it("parses bracketed hybrid tokens", () => {
        expect(parseCost("{U/B}{2/W}")).toEqual(["U/B", "2/W"]);
    });

    it("skips an unmatched opening brace and keeps parsing", () => {
        // No closing '}' — the '{' is skipped, then 'U' is parsed as a regular letter token.
        expect(parseCost("{U")).toEqual(["U"]);
    });

    it("ignores unknown punctuation", () => {
        expect(parseCost("W,U")).toEqual(["W", "U"]);
    });
});

describe("splitSides", () => {
    it("returns empty array for null/undefined/empty", () => {
        expect(splitSides(null)).toEqual([]);
        expect(splitSides(undefined)).toEqual([]);
        expect(splitSides("")).toEqual([]);
    });

    it("splits on the ' // ' separator", () => {
        expect(splitSides("G // 2W")).toEqual([["G"], ["2", "W"]]);
    });

    it("returns a single side for non-split costs", () => {
        expect(splitSides("3WW")).toEqual([["3", "W", "W"]]);
    });

    it("coerces numeric input to string", () => {
        expect(splitSides(3)).toEqual([["3"]]);
    });
});

describe("tokenClass", () => {
    it("maps tap and untap symbols", () => {
        expect(tokenClass("T")).toEqual(["ms-tap"]);
        expect(tokenClass("Q")).toEqual(["ms-untap"]);
    });

    it("maps chaos symbol", () => {
        expect(tokenClass("chaos")).toEqual(["ms-chaos"]);
    });

    it("maps single colored mana symbol to ms-<lower>", () => {
        expect(tokenClass("W")).toEqual(["ms-w"]);
        expect(tokenClass("u")).toEqual(["ms-u"]);
    });

    it("maps generic numbers to ms-<n>", () => {
        expect(tokenClass("3")).toEqual(["ms-3"]);
    });

    it("maps hybrid tokens to ms-xy plus ms-split", () => {
        expect(tokenClass("U/B")).toEqual(["ms-ub", "ms-split"]);
        expect(tokenClass("G/W/P")).toEqual(["ms-gwp", "ms-split"]);
    });
});

describe("renderOracleHtml", () => {
    it("returns empty string when text is empty/falsy", () => {
        expect(renderOracleHtml("")).toBe("");
        expect(renderOracleHtml(null)).toBe("");
        expect(renderOracleHtml(undefined)).toBe("");
    });

    it("escapes HTML entities", () => {
        const out = renderOracleHtml('Quote: "x" <b>&amp;</b>');
        expect(out).toContain("&quot;");
        expect(out).toContain("&lt;b&gt;");
        expect(out).toContain("&amp;amp;");
        expect(out).not.toContain("<b>");
    });

    it("replaces {X} symbols with mana-font icons", () => {
        const out = renderOracleHtml("Pay {2}{W}: do thing.");
        expect(out).toContain('<i class="ms ms-2"></i>');
        expect(out).toContain('<i class="ms ms-w"></i>');
    });

    it("renders hybrid tokens with split class", () => {
        const out = renderOracleHtml("Add {U/B}.");
        expect(out).toContain('<i class="ms ms-ub ms-split"></i>');
    });

    it("renders the tap symbol", () => {
        const out = renderOracleHtml("{T}: do thing.");
        expect(out).toContain('<i class="ms ms-tap"></i>');
    });
});
