import { XMLParser } from "fast-xml-parser";

const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    isArray: (name) => ["card", "set", "related", "reverse-related"].includes(name),
    textNodeName: "#text",
    htmlEntities: true,
    processEntities: { enabled: true, maxTotalExpansions: 100000 },
});

export function parseCardDatabase(xmlString) {
    const parsed = parser.parse(xmlString);
    const db = parsed.cockatrice_carddatabase; // XML root tag from card database format
    if (!db) throw new Error("Invalid card database XML");

    const sets = parseSets(db.sets);
    const cards = parseCards(db.cards, sets);

    return { sets, cards };
}

function parseSets(setsNode) {
    if (!setsNode?.set) return {};

    const sets = {};
    const setList = Array.isArray(setsNode.set) ? setsNode.set : [setsNode.set];

    for (const s of setList) {
        const code = typeof s.name === "object" ? s.name["#text"] : s.name;
        if (!code) continue;

        sets[code] = {
            code,
            longName: s.longname || "",
            type: s.settype || "",
            releaseDate: s.releasedate || "",
            priority: parseInt(s.priority) || 0,
        };
    }
    return sets;
}

function parseCards(cardsNode, sets) {
    if (!cardsNode?.card) return [];

    const cardList = Array.isArray(cardsNode.card) ? cardsNode.card : [cardsNode.card];
    const cards = [];

    for (const c of cardList) {
        const name = typeof c.name === "object" ? c.name["#text"] : c.name;
        if (!name) continue;

        // Skip tokens
        if (c.token === 1 || c.token === "1") continue;

        const props = c.prop || {};
        const cardSets = parseCardSets(c.set);

        // Pick best set by priority
        let bestSet = cardSets[0];
        for (const cs of cardSets) {
            const setInfo = sets[cs.code];
            if (setInfo && (!sets[bestSet.code] || setInfo.priority > (sets[bestSet.code]?.priority || 0))) {
                bestSet = cs;
            }
        }

        cards.push({
            name,
            text: c.text || "",
            manaCost: props.manacost != null ? String(props.manacost) : "",
            cmc: parseFloat(props.cmc) || 0,
            type: props.type || "",
            mainType: props.maintype || "",
            colors: props.colors || "",
            colorIdentity: props.coloridentity || "",
            pt: props.pt || "",
            loyalty: props.loyalty || "",
            layout: props.layout || "",
            side: props.side || "",
            sets: cardSets,
            bestSet: bestSet?.code || "",
            uuid: bestSet?.uuid || "",
            rarity: bestSet?.rarity || "",
        });
    }

    return cards;
}

function parseCardSets(setNodes) {
    if (!setNodes) return [];
    const list = Array.isArray(setNodes) ? setNodes : [setNodes];

    return list.map((s) => {
        const code = typeof s === "object" ? s["#text"] : s;
        return {
            code: code || "",
            uuid: s?.["@_uuid"] || "",
            muid: s?.["@_muid"] || "",
            picUrl: s?.["@_picurl"] || s?.["@_picURL"] || "",
            num: s?.["@_num"] || "",
            rarity: s?.["@_rarity"] || "",
        };
    });
}
