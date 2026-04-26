import { describe, it, expect } from "vitest";
import { exportDeck } from "../../src/services/deckExporter.js";

function card(name, type = "Creature", overrides = {}) {
    return {
        name,
        type,
        mainType: type.split(/[\s—-]/)[0],
        bestSet: "LEA",
        ...overrides,
    };
}

function stack(card, inDeck, available) {
    return { card, inDeck, available };
}

const BASIC_NAMES = { W: "Plains", U: "Island", B: "Swamp", R: "Mountain", G: "Forest", C: "Wastes" };

describe("exportDeck", () => {
    it("returns header even with empty deck", () => {
        const out = exportDeck({
            poolStacks: [],
            basicLands: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
            basicLandNames: BASIC_NAMES,
            title: "Test",
        });
        expect(out.startsWith("// Test")).toBe(true);
    });

    it("uses today's date when no title is supplied", () => {
        const out = exportDeck({
            poolStacks: [],
            basicLands: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
            basicLandNames: BASIC_NAMES,
        });
        expect(out).toMatch(/^\/\/ Sealed \d{4}\.\d{2}\.\d{2}/);
    });

    it("emits maindeck cards grouped by type", () => {
        const stacks = [
            stack(card("Lightning Bolt", "Instant"), 2, 0),
            stack(card("Goblin", "Creature"), 3, 0),
            stack(card("Forest", "Basic Land — Forest", { mainType: "Land" }), 1, 0),
        ];
        const out = exportDeck({
            poolStacks: stacks,
            basicLands: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
            basicLandNames: BASIC_NAMES,
            title: "Mine",
        });
        expect(out).toContain("// 6 Maindeck");
        expect(out).toContain("// 3 Creature");
        expect(out).toContain("// 2 Instant");
        expect(out).toContain("// 1 Land");
        expect(out).toContain("3 Goblin (LEA)");
        expect(out).toContain("2 Lightning Bolt (LEA)");
    });

    it("emits sideboard with SB: prefix", () => {
        const stacks = [stack(card("Lightning Bolt", "Instant"), 0, 4)];
        const out = exportDeck({
            poolStacks: stacks,
            basicLands: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
            basicLandNames: BASIC_NAMES,
            title: "Mine",
        });
        expect(out).toContain("// 4 Sideboard");
        expect(out).toContain("SB: 4 Lightning Bolt (LEA)");
    });

    it("uses poolSetCode and poolNumber when present", () => {
        const c = card("Bolt", "Instant", { poolSetCode: "MMQ", poolNumber: "200" });
        const out = exportDeck({
            poolStacks: [stack(c, 1, 0)],
            basicLands: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
            basicLandNames: BASIC_NAMES,
            title: "T",
        });
        expect(out).toContain("1 Bolt (MMQ) 200");
    });

    it("includes basic lands in the maindeck under Land", () => {
        const out = exportDeck({
            poolStacks: [],
            basicLands: { W: 3, U: 0, B: 0, R: 0, G: 5, C: 0 },
            basicLandNames: BASIC_NAMES,
            title: "T",
        });
        expect(out).toContain("// 8 Maindeck");
        expect(out).toContain("// 8 Land");
        expect(out).toContain("3 Plains");
        expect(out).toContain("5 Forest");
    });

    it("orders type buckets alphabetically with Other last", () => {
        const stacks = [
            stack(card("ConspiracyX", "Conspiracy"), 1, 0),
            stack(card("Bolt", "Instant"), 1, 0),
            stack(card("Goblin", "Creature"), 1, 0),
        ];
        const out = exportDeck({
            poolStacks: stacks,
            basicLands: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
            basicLandNames: BASIC_NAMES,
            title: "T",
        });
        const lines = out.split("\n").filter((l) => l.startsWith("// ") && !l.includes("Maindeck") && !/^\/\/ T$/.test(l));
        // Maindeck section type headers in order
        const idxCreature = out.indexOf("// 1 Creature");
        const idxInstant = out.indexOf("// 1 Instant");
        const idxOther = out.indexOf("// 1 Other");
        expect(idxCreature).toBeGreaterThan(0);
        expect(idxInstant).toBeGreaterThan(idxCreature);
        expect(idxOther).toBeGreaterThan(idxInstant);
        expect(lines.length).toBeGreaterThan(0);
    });

    it("alphabetizes cards within a type bucket", () => {
        const stacks = [
            stack(card("Zombie", "Creature"), 1, 0),
            stack(card("Angel", "Creature"), 1, 0),
            stack(card("Mongoose", "Creature"), 1, 0),
        ];
        const out = exportDeck({
            poolStacks: stacks,
            basicLands: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
            basicLandNames: BASIC_NAMES,
            title: "T",
        });
        const idxA = out.indexOf("Angel");
        const idxM = out.indexOf("Mongoose");
        const idxZ = out.indexOf("Zombie");
        expect(idxA).toBeLessThan(idxM);
        expect(idxM).toBeLessThan(idxZ);
    });
});
