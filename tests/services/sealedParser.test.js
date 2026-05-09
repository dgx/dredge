import { describe, it, expect } from "vitest";
import { parseSealedPool } from "../../src/services/sealedParser.js";

describe("parseSealedPool", () => {
    it("returns empty result for empty input", () => {
        const r = parseSealedPool("");
        expect(r.entries).toEqual([]);
        expect(r.errors).toEqual([]);
        expect(r.basicLands).toEqual({ W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 });
    });

    it("parses bracketed format", () => {
        const r = parseSealedPool("1 Lightning Bolt [LEA:161]");
        expect(r.entries).toEqual([
            {
                count: 1,
                name: "Lightning Bolt",
                setCode: "LEA",
                number: "161",
                foil: false,
                section: "main",
            },
        ]);
    });

    it("parses bracketed format with foil tag", () => {
        const r = parseSealedPool("2 Lightning Bolt [LEA:161] [foil]");
        expect(r.entries[0].count).toBe(2);
        expect(r.entries[0].foil).toBe(true);
    });

    it("treats non-foil bracket tags as not foil", () => {
        const r = parseSealedPool("1 Lightning Bolt [LEA:161] [stamped]");
        expect(r.entries[0].foil).toBe(false);
    });

    it("parses MTGA format", () => {
        const r = parseSealedPool("4 Lightning Bolt (LEA) 161");
        expect(r.entries[0]).toMatchObject({
            count: 4,
            name: "Lightning Bolt",
            setCode: "LEA",
            number: "161",
            foil: false,
        });
    });

    it("parses MTGA foil suffix *F* and *f*", () => {
        const upper = parseSealedPool("1 Lightning Bolt (LEA) 161 *F*");
        expect(upper.entries[0].foil).toBe(true);
        const lower = parseSealedPool("1 Lightning Bolt (LEA) 161 *f*");
        expect(lower.entries[0].foil).toBe(true);
    });

    it("uppercases set codes", () => {
        const r = parseSealedPool("1 Lightning Bolt [lea:161]");
        expect(r.entries[0].setCode).toBe("LEA");
    });

    it("aggregates basic lands by color (main only)", () => {
        const text = ["10 Forest", "5 Island", "3 Swamp", "2 Mountain", "4 Plains", "1 Wastes"].join("\n");
        const r = parseSealedPool(text);
        expect(r.basicLands).toEqual({ W: 4, U: 5, B: 3, R: 2, G: 10, C: 1 });
        expect(r.entries).toEqual([]);
    });

    it("ignores SB-prefixed basic lands for the basicLands counter", () => {
        const r = parseSealedPool("SB: 5 Forest");
        expect(r.basicLands.G).toBe(0);
        expect(r.entries).toEqual([]);
    });

    it("classifies SB: lines as sideboard", () => {
        const r = parseSealedPool("SB: 1 Lightning Bolt [LEA:161]");
        expect(r.entries[0].section).toBe("sideboard");
    });

    it("ignores comment and blank lines", () => {
        const text = ["// hello", "# also a comment", "   ", "1 Forest"].join("\n");
        const r = parseSealedPool(text);
        expect(r.errors).toEqual([]);
        expect(r.basicLands.G).toBe(1);
    });

    it("collects unparseable lines as errors", () => {
        const r = parseSealedPool("not a real line");
        expect(r.errors).toEqual(["not a real line"]);
    });

    it("does not match BARE_RE on lines containing brackets or parens", () => {
        // A malformed bracketed/MTGA-ish line should error, not silently fall through.
        const r = parseSealedPool("1 Strange Card [BAD");
        expect(r.errors).toContain("1 Strange Card [BAD");
    });

    it("handles a mixed pool with main, sideboard, basics, and errors", () => {
        const text = [
            "// Main",
            "1 Lightning Bolt [LEA:161]",
            "2 Multi Spell (RAV) 60",
            "10 Forest",
            "",
            "SB: 1 Lightning Bolt [LEA:161] [foil]",
            "garbage line",
        ].join("\n");
        const r = parseSealedPool(text);
        expect(r.entries).toHaveLength(3);
        expect(r.entries.filter((e) => e.section === "sideboard")).toHaveLength(1);
        expect(r.basicLands.G).toBe(10);
        expect(r.errors).toEqual(["garbage line"]);
    });

    it("handles SB: with mixed casing", () => {
        const r = parseSealedPool("sb: 1 Lightning Bolt [LEA:161]");
        expect(r.entries[0].section).toBe("sideboard");
    });

    it("trims surrounding whitespace on names", () => {
        const r = parseSealedPool("1 Lightning Bolt   [LEA:161]");
        expect(r.entries[0].name).toBe("Lightning Bolt");
    });
});
