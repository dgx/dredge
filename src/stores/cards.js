import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { parseCardDatabase } from "../services/cardDatabase";
import { parseSealedPool } from "../services/sealedParser";
import { groupCards, isLand, typeKey, TYPE_ORDER } from "../services/cardGrouping";

const BASIC_COLORS = ["W", "U", "B", "R", "G", "C"];
const BASIC_LAND_NAMES = {
    W: "Plains",
    U: "Island",
    B: "Swamp",
    R: "Mountain",
    G: "Forest",
    C: "Wastes",
};

function emptyBasicLands() {
    return { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
}

export const useCardStore = defineStore("cards", () => {
    const allCards = ref([]);
    const sets = ref({});
    const loading = ref(false);
    const loaded = ref(false);
    const selectedCard = ref(null);

    // Sealed pool state
    const sealedPool = ref([]);
    const sealedMode = ref(false);
    const showImport = ref(true);
    const importErrors = ref([]);

    // Deck-building state
    const deckIds = ref(new Set());
    const basicLands = ref(emptyBasicLands());
    const GROUP_SLOTS = 3;
    const DEFAULT_GROUP_BY = ["color", "cmc", null];
    const VALID_GROUP_TYPES = ["type", "color", "cmc", "rarity"];
    const groupBy = ref([...DEFAULT_GROUP_BY]);

    function setGroupLevel(index, value) {
        if (index < 0 || index >= GROUP_SLOTS) return;
        const next = Array.from({ length: GROUP_SLOTS }, (_, i) => groupBy.value[i] ?? null);
        const normalized = !value || value === "none" ? null : value;
        if (normalized && !VALID_GROUP_TYPES.includes(normalized)) return;
        // Remove the value from any other slot to enforce uniqueness across slots
        if (normalized) {
            for (let i = 0; i < GROUP_SLOTS; i++) {
                if (i !== index && next[i] === normalized) next[i] = null;
            }
        }
        next[index] = normalized;
        groupBy.value = next;
    }
    const deckView = ref("all");
    const showSidebar = ref(true);

    // Filters
    const searchQuery = ref("");
    const colorFilter = ref([...BASIC_COLORS]);
    const typeFilter = ref("");
    const rarityFilter = ref("");
    const sortBy = ref("name");

    function setColorFilter(next) {
        const arr = Array.isArray(next) ? next : [];
        colorFilter.value = arr.length === 0 ? [...BASIC_COLORS] : arr;
    }

    function cardPassesColorFilter(card) {
        const cardColors = (card.colors || "").toUpperCase();
        if (!cardColors) return colorFilter.value.includes("C");
        for (const ch of cardColors) {
            if (!"WUBRG".includes(ch)) continue;
            if (!colorFilter.value.includes(ch)) return false;
        }
        return true;
    }

    function applyFilters(list) {
        let result = list;
        const query = searchQuery.value.toLowerCase().trim();

        if (query) {
            result = result.filter(
                (c) => c.name.toLowerCase().includes(query) || c.text.toLowerCase().includes(query)
            );
        }

        result = result.filter(cardPassesColorFilter);

        if (typeFilter.value) {
            const t = typeFilter.value.toLowerCase();
            result = result.filter((c) => c.type.toLowerCase().includes(t));
        }

        if (rarityFilter.value) {
            result = result.filter((c) => c.rarity.toLowerCase() === rarityFilter.value.toLowerCase());
        }

        return result;
    }

    function applySort(list) {
        if (sortBy.value === "name") {
            return [...list].sort((a, b) => a.name.localeCompare(b.name));
        } else if (sortBy.value === "cmc") {
            return [...list].sort((a, b) => a.cmc - b.cmc || a.name.localeCompare(b.name));
        } else if (sortBy.value === "color") {
            return [...list].sort((a, b) => a.colors.localeCompare(b.colors) || a.name.localeCompare(b.name));
        } else if (sortBy.value === "type") {
            return [...list].sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));
        }
        return list;
    }

    const filteredCards = computed(() => {
        const source = sealedMode.value ? sealedPool.value : allCards.value;
        return applySort(applyFilters(source));
    });

    // Map poolId -> card for fast lookups
    const poolIdMap = computed(() => {
        const map = new Map();
        for (const c of sealedPool.value) map.set(c.poolId, c);
        return map;
    });

    // Group all pool cards by name, collect their poolIds
    const poolStacks = computed(() => {
        const byName = new Map();
        for (const c of sealedPool.value) {
            const key = c.name;
            if (!byName.has(key)) {
                byName.set(key, { card: c, poolIds: [] });
            }
            byName.get(key).poolIds.push(c.poolId);
        }
        const result = [];
        for (const { card, poolIds } of byName.values()) {
            const inDeck = poolIds.filter((id) => deckIds.value.has(id)).length;
            const total = poolIds.length;
            result.push({
                card,
                poolIds,
                total,
                inDeck,
                available: total - inDeck,
            });
        }
        return result;
    });

    // Stacks to render based on current deckView. Each has a `count` for the visual stack.
    // "all" view shows every pool stack at full pool count (with in-deck count still exposed
    // on the stack so the UI can badge/dim). "deck" view shows only cards currently in the deck.
    const visibleStacks = computed(() => {
        const isDeckView = deckView.value === "deck";
        const filtered = [];
        for (const s of poolStacks.value) {
            const count = isDeckView ? s.inDeck : s.total;
            if (count <= 0) continue;
            if (!passesFilters(s.card)) continue;
            filtered.push({ ...s, count });
        }
        return filtered;
    });

    function passesFilters(card) {
        const query = searchQuery.value.toLowerCase().trim();
        if (query && !card.name.toLowerCase().includes(query) && !card.text.toLowerCase().includes(query)) {
            return false;
        }
        if (!cardPassesColorFilter(card)) return false;
        if (typeFilter.value) {
            if (!card.type.toLowerCase().includes(typeFilter.value.toLowerCase())) return false;
        }
        if (rarityFilter.value) {
            if (card.rarity.toLowerCase() !== rarityFilter.value.toLowerCase()) return false;
        }
        return true;
    }

    const groupedStacks = computed(() => groupCards(visibleStacks.value, groupBy.value));

    const deckNonLandCount = computed(() => {
        let count = 0;
        for (const id of deckIds.value) {
            const card = poolIdMap.value.get(id);
            if (card && !isLand(card)) count++;
        }
        return count;
    });

    const deckPoolLandCount = computed(() => {
        let count = 0;
        for (const id of deckIds.value) {
            const card = poolIdMap.value.get(id);
            if (card && isLand(card)) count++;
        }
        return count;
    });

    const basicLandTotal = computed(() => {
        return BASIC_COLORS.reduce((sum, c) => sum + (basicLands.value[c] || 0), 0);
    });

    const deckLandCount = computed(() => deckPoolLandCount.value + basicLandTotal.value);
    const deckTotal = computed(() => deckIds.value.size + basicLandTotal.value);

    const manaCurve = computed(() => {
        const keys = ["0", "1", "2", "3", "4", "5", "6", "7+"];
        const buckets = {};
        for (const k of keys) {
            buckets[k] = { count: 0, colors: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0, multi: 0 } };
        }
        for (const id of deckIds.value) {
            const card = poolIdMap.value.get(id);
            if (!card || isLand(card)) continue;
            const cmc = Math.max(0, Math.floor(card.cmc || 0));
            const key = cmc >= 7 ? "7+" : String(cmc);
            const bucket = buckets[key];
            bucket.count++;
            const distinct = new Set();
            for (const ch of (card.colors || "").toUpperCase()) {
                if ("WUBRG".includes(ch)) distinct.add(ch);
            }
            if (distinct.size === 0) bucket.colors.C++;
            else if (distinct.size > 1) bucket.colors.multi++;
            else bucket.colors[[...distinct][0]]++;
        }
        return buckets;
    });

    const typeCurve = computed(() => {
        const buckets = {};
        for (const t of TYPE_ORDER) {
            buckets[t] = { count: 0, colors: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0, multi: 0 } };
        }
        for (const id of deckIds.value) {
            const card = poolIdMap.value.get(id);
            if (!card) continue;
            const bucket = buckets[typeKey(card)];
            bucket.count++;
            const distinct = new Set();
            for (const ch of (card.colors || "").toUpperCase()) {
                if ("WUBRG".includes(ch)) distinct.add(ch);
            }
            if (distinct.size === 0) bucket.colors.C++;
            else if (distinct.size > 1) bucket.colors.multi++;
            else bucket.colors[[...distinct][0]]++;
        }
        const landBucket = buckets.Land;
        for (const color of BASIC_COLORS) {
            const n = basicLands.value[color] || 0;
            if (n <= 0) continue;
            landBucket.count += n;
            landBucket.colors[color] += n;
        }
        return buckets;
    });

    async function parseDatabase(xmlString) {
        const { sets: parsedSets, cards } = parseCardDatabase(xmlString);
        sets.value = parsedSets;
        allCards.value = cards;
        loaded.value = true;
    }

    function selectCard(card) {
        selectedCard.value = card;
    }

    function clearSelection() {
        selectedCard.value = null;
    }

    function resetFilters() {
        searchQuery.value = "";
        colorFilter.value = [...BASIC_COLORS];
        typeFilter.value = "";
        rarityFilter.value = "";
        sortBy.value = "name";
    }

    function importSealedPool(text) {
        const { entries, basicLands: parsedBasic, errors } = parseSealedPool(text);
        const nameMap = new Map();
        for (const card of allCards.value) {
            nameMap.set(card.name.toLowerCase(), card);
        }

        const pool = [];
        const newErrors = errors.map((line) => ({ line, reason: "parse" }));
        const initialDeckIds = new Set();
        let counter = 0;

        for (const entry of entries) {
            const card = nameMap.get(entry.name.toLowerCase());
            if (!card) {
                newErrors.push({
                    line: `${entry.count} ${entry.name} [${entry.setCode}:${entry.number}]`,
                    reason: "unmatched",
                });
                continue;
            }
            const setEntry = card.sets.find((s) => s.code.toUpperCase() === entry.setCode.toUpperCase());
            for (let i = 0; i < entry.count; i++) {
                const poolId = `pool-${counter++}`;
                pool.push({
                    ...card,
                    uuid: setEntry?.uuid || card.uuid,
                    rarity: setEntry?.rarity || card.rarity,
                    bestSet: setEntry?.code || card.bestSet,
                    poolId,
                    poolSetCode: entry.setCode,
                    poolNumber: entry.number,
                    poolFoil: entry.foil,
                });
                if (entry.section === "main") initialDeckIds.add(poolId);
            }
        }

        importErrors.value = newErrors;
        if (pool.length === 0) {
            return;
        }
        sealedPool.value = pool;
        sealedMode.value = true;
        showImport.value = false;
        resetFilters();
        clearDeck();
        if (initialDeckIds.size > 0) deckIds.value = initialDeckIds;
        basicLands.value = { ...emptyBasicLands(), ...parsedBasic };
        groupBy.value = [...DEFAULT_GROUP_BY];
        deckView.value = "all";
    }

    function clearSealedPool() {
        sealedPool.value = [];
        importErrors.value = [];
        sealedMode.value = false;
        showImport.value = true;
        clearDeck();
    }

    function openImport() {
        showImport.value = true;
    }

    function closeImport() {
        showImport.value = false;
    }

    function setSealedMode(on) {
        sealedMode.value = !!on;
    }

    function addCardToDeck(poolIds) {
        for (const id of poolIds) {
            if (!deckIds.value.has(id)) {
                const next = new Set(deckIds.value);
                next.add(id);
                deckIds.value = next;
                return;
            }
        }
    }

    function removeCardFromDeck(poolIds) {
        for (let i = poolIds.length - 1; i >= 0; i--) {
            if (deckIds.value.has(poolIds[i])) {
                const next = new Set(deckIds.value);
                next.delete(poolIds[i]);
                deckIds.value = next;
                return;
            }
        }
    }

    function addPoolIdsToDeck(poolIds) {
        if (!poolIds || poolIds.length === 0) return;
        const next = new Set(deckIds.value);
        const before = next.size;
        for (const id of poolIds) next.add(id);
        if (next.size !== before) deckIds.value = next;
    }

    function removePoolIdsFromDeck(poolIds) {
        if (!poolIds || poolIds.length === 0) return;
        const next = new Set(deckIds.value);
        const before = next.size;
        for (const id of poolIds) next.delete(id);
        if (next.size !== before) deckIds.value = next;
    }

    function adjustBasicLand(color, delta) {
        if (!BASIC_COLORS.includes(color)) return;
        const current = basicLands.value[color] || 0;
        const updated = Math.max(0, current + delta);
        basicLands.value = { ...basicLands.value, [color]: updated };
    }

    function setBasicLand(color, value) {
        if (!BASIC_COLORS.includes(color)) return;
        basicLands.value = { ...basicLands.value, [color]: Math.max(0, value | 0) };
    }

    function clearDeck() {
        deckIds.value = new Set();
        basicLands.value = emptyBasicLands();
    }

    return {
        allCards,
        sets,
        loading,
        loaded,
        selectedCard,
        sealedPool,
        sealedMode,
        showImport,
        importErrors,
        deckIds,
        basicLands,
        groupBy,
        deckView,
        showSidebar,
        searchQuery,
        colorFilter,
        typeFilter,
        rarityFilter,
        sortBy,
        filteredCards,
        poolStacks,
        visibleStacks,
        groupedStacks,
        manaCurve,
        typeCurve,
        deckTotal,
        deckNonLandCount,
        deckPoolLandCount,
        deckLandCount,
        basicLandTotal,
        BASIC_COLORS,
        BASIC_LAND_NAMES,
        parseDatabase,
        selectCard,
        clearSelection,
        resetFilters,
        setColorFilter,
        importSealedPool,
        clearSealedPool,
        openImport,
        closeImport,
        setSealedMode,
        addCardToDeck,
        removeCardFromDeck,
        addPoolIdsToDeck,
        removePoolIdsFromDeck,
        adjustBasicLand,
        setBasicLand,
        clearDeck,
        setGroupLevel,
        GROUP_SLOTS,
        VALID_GROUP_TYPES,
    };
});
