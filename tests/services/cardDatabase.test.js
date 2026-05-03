import { describe, it, expect } from "vitest";
import { parseCardDatabase } from "../../src/services/cardDatabase.js";
import { SAMPLE_XML, INVALID_XML, EMPTY_XML } from "../fixtures/sampleDatabase.js";

describe("parseCardDatabase", () => {
    it("throws on XML missing the cockatrice_carddatabase root", () => {
        expect(() => parseCardDatabase(INVALID_XML)).toThrow(/Invalid card database XML/);
    });

    it("returns empty sets and cards when both are empty", () => {
        const { sets, cards } = parseCardDatabase(EMPTY_XML);
        expect(sets).toEqual({});
        expect(cards).toEqual([]);
    });

    it("parses sets keyed by code", () => {
        const { sets } = parseCardDatabase(SAMPLE_XML);
        expect(Object.keys(sets).sort()).toEqual(["LEA", "MMQ", "RAV"]);
        expect(sets.LEA).toMatchObject({
            code: "LEA",
            longName: "Limited Edition Alpha",
            type: "Core Set",
            releaseDate: "1993-08-05",
            priority: 0,
        });
        expect(sets.RAV.priority).toBe(10);
    });

    it("skips tokens", () => {
        const { cards } = parseCardDatabase(SAMPLE_XML);
        expect(cards.find((c) => c.name === "Some Token")).toBeUndefined();
    });

    it("parses card properties from the prop node", () => {
        const { cards } = parseCardDatabase(SAMPLE_XML);
        const bolt = cards.find((c) => c.name === "Lightning Bolt");
        expect(bolt).toBeDefined();
        expect(bolt).toMatchObject({
            name: "Lightning Bolt",
            manaCost: "R",
            cmc: 1,
            type: "Instant",
            mainType: "Instant",
            colors: "R",
            colorIdentity: "R",
            layout: "normal",
        });
        expect(bolt.text).toContain("3 damage");
    });

    it("collects all printings into the sets array", () => {
        const { cards } = parseCardDatabase(SAMPLE_XML);
        const bolt = cards.find((c) => c.name === "Lightning Bolt");
        expect(bolt.sets).toHaveLength(2);
        const lea = bolt.sets.find((s) => s.code === "LEA");
        expect(lea).toMatchObject({
            code: "LEA",
            uuid: "aaa-111",
            muid: "100",
            num: "161",
            rarity: "common",
            picUrl: "http://example.com/bolt.jpg",
        });
    });

    it("picks the highest-priority set as bestSet", () => {
        const { cards } = parseCardDatabase(SAMPLE_XML);
        const multi = cards.find((c) => c.name === "Multi Spell");
        // RAV has priority 10, MMQ has none — RAV should win
        expect(multi.bestSet).toBe("RAV");
        expect(multi.uuid).toBe("eee-555");
        expect(multi.rarity).toBe("mythic");
    });

    it("falls back to first set when no priority is set", () => {
        const { cards } = parseCardDatabase(SAMPLE_XML);
        // Lightning Bolt: LEA (priority 0) vs MMQ (priority 0) — first wins
        const bolt = cards.find((c) => c.name === "Lightning Bolt");
        expect(bolt.bestSet).toBe("LEA");
        expect(bolt.uuid).toBe("aaa-111");
    });

    it("handles cards with empty manacost", () => {
        const { cards } = parseCardDatabase(SAMPLE_XML);
        const forest = cards.find((c) => c.name === "Forest");
        expect(forest.manaCost).toBe("");
        expect(forest.cmc).toBe(0);
        expect(forest.mainType).toBe("Land");
    });

    it("handles a single card (non-array) in the cards node", () => {
        const xml = `<?xml version="1.0"?>
<cockatrice_carddatabase version="4">
    <sets>
        <set><name>X</name></set>
    </sets>
    <cards>
        <card>
            <name>Solo</name>
            <prop><type>Instant</type><cmc>2</cmc></prop>
            <set rarity="common" uuid="solo-1">X</set>
        </card>
    </cards>
</cockatrice_carddatabase>`;
        const { cards } = parseCardDatabase(xml);
        expect(cards).toHaveLength(1);
        expect(cards[0].name).toBe("Solo");
        expect(cards[0].sets).toHaveLength(1);
    });

    it("decodes HTML entities in card names", () => {
        const xml = `<?xml version="1.0"?>
<cockatrice_carddatabase version="4">
    <sets><set><name>X</name></set></sets>
    <cards>
        <card>
            <name>Borrowing 100,000 Arrows</name>
            <text>It says &quot;hi&quot;.</text>
            <prop><type>Sorcery</type></prop>
            <set rarity="common" uuid="x-1">X</set>
        </card>
    </cards>
</cockatrice_carddatabase>`;
        const { cards } = parseCardDatabase(xml);
        expect(cards[0].text).toContain('"hi"');
    });

    it("skips cards without a name", () => {
        const xml = `<?xml version="1.0"?>
<cockatrice_carddatabase version="4">
    <sets><set><name>X</name></set></sets>
    <cards>
        <card>
            <prop><type>Instant</type></prop>
            <set rarity="common" uuid="x-1">X</set>
        </card>
        <card>
            <name>Real</name>
            <prop><type>Instant</type></prop>
            <set rarity="common" uuid="x-2">X</set>
        </card>
    </cards>
</cockatrice_carddatabase>`;
        const { cards } = parseCardDatabase(xml);
        expect(cards.map((c) => c.name)).toEqual(["Real"]);
    });

    it("supports the legacy picURL attribute spelling", () => {
        const xml = `<?xml version="1.0"?>
<cockatrice_carddatabase version="4">
    <sets><set><name>X</name></set></sets>
    <cards>
        <card>
            <name>Legacy</name>
            <prop><type>Instant</type></prop>
            <set rarity="common" uuid="x-1" picURL="http://legacy/x.jpg">X</set>
        </card>
    </cards>
</cockatrice_carddatabase>`;
        const { cards } = parseCardDatabase(xml);
        expect(cards[0].sets[0].picUrl).toBe("http://legacy/x.jpg");
    });
});
