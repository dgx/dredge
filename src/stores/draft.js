import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { useCardStore } from "./cards.js";
import {
    fetchSetData,
    listDraftableSets,
    findSupplementalSets,
} from "../services/boosterData.js";
import {
    pickBoosterType,
    listDraftableBoosterTypes,
    hasDraftableBooster,
    buildCardIndex,
    mergeCardsIntoIndex,
    collectMissingSheetUuids,
    rollPack,
} from "../services/boosterSimulator.js";
import { buildScryfallIndex, resolvePack } from "../services/draftResolver.js";

const DEFAULT_PACKS_PER_SET = 6;

let selectionCounter = 0;
function nextSelectionId() {
    return `sel-${selectionCounter++}`;
}

export const useDraftStore = defineStore("draft", () => {
    // Phases:
    //   "setup"    – picking sets / pack counts
    //   "loading"  – fetching MTGJSON, rolling packs
    //   "opening"  – revealing packs one at a time
    //   "finished" – pool handed off to deckbuilder
    const phase = ref("setup");
    const error = ref(null);

    // Set catalog (loaded from MTGJSON SetList).
    const setOptions = ref([]);
    const setOptionsLoaded = ref(false);
    const setOptionsLoading = ref(false);
    const setOptionsError = ref(null);

    // Per-set MTGJSON full data we've already fetched, by set code.
    const loadedSetData = ref(new Map());
    const loadingSets = ref(new Set());
    const setLoadErrors = ref(new Map());

    // Up to 3 selections.
    const selections = ref([
        { id: nextSelectionId(), setCode: "", count: DEFAULT_PACKS_PER_SET, boosterType: "" },
    ]);

    // Rolled packs for the current draft session.
    const packQueue = ref([]); // [{ setCode, packIndex, total, simResult, resolved (lazy) }]
    const currentPackIndex = ref(0);

    // Audio preference (mirrored into packAudio.setMuted by the component layer).
    const muted = ref(false);

    // ---- derived ---------------------------------------------------------

    // Kept as a computed so the template/v-if shape doesn't have to change.
    // No upper bound — users can add as many set slots as they want.
    const canAddSelection = computed(() => true);

    const totalPacks = computed(() =>
        selections.value.reduce((sum, s) => sum + (Number(s.count) || 0), 0)
    );

    const validSelections = computed(() =>
        selections.value.filter((s) => {
            if (!s.setCode || (Number(s.count) || 0) <= 0) return false;
            const data = loadedSetData.value.get(s.setCode);
            // Pre-load not required to be valid in setup view; only required
            // at startDraft time. Treat as valid if it has a setCode + count.
            return !data || hasDraftableBooster(data);
        })
    );

    const canStart = computed(() => {
        if (totalPacks.value <= 0) return false;
        for (const s of selections.value) {
            if (s.setCode && (Number(s.count) || 0) > 0) return true;
        }
        return false;
    });

    const currentPack = computed(() => packQueue.value[currentPackIndex.value] || null);

    const packsRemaining = computed(() =>
        Math.max(0, packQueue.value.length - currentPackIndex.value)
    );

    // ---- actions ---------------------------------------------------------

    async function loadSetOptions() {
        if (setOptionsLoaded.value || setOptionsLoading.value) return;
        setOptionsLoading.value = true;
        setOptionsError.value = null;
        try {
            const list = await listDraftableSets();
            setOptions.value = list;
            setOptionsLoaded.value = true;
        } catch (err) {
            setOptionsError.value = err.message || String(err);
        } finally {
            setOptionsLoading.value = false;
        }
    }

    async function ensureSetData(setCode) {
        const code = String(setCode || "").toUpperCase();
        if (!code) return null;
        if (loadedSetData.value.has(code)) return loadedSetData.value.get(code);
        if (loadingSets.value.has(code)) {
            // Wait for the in-flight fetch in boosterData (already memoized there).
        }
        const next = new Set(loadingSets.value);
        next.add(code);
        loadingSets.value = next;
        try {
            const data = await fetchSetData(code);
            const m = new Map(loadedSetData.value);
            m.set(code, data);
            loadedSetData.value = m;
            // Clear any previous error for this set.
            if (setLoadErrors.value.has(code)) {
                const errs = new Map(setLoadErrors.value);
                errs.delete(code);
                setLoadErrors.value = errs;
            }
            return data;
        } catch (err) {
            const errs = new Map(setLoadErrors.value);
            errs.set(code, err.message || String(err));
            setLoadErrors.value = errs;
            throw err;
        } finally {
            const next2 = new Set(loadingSets.value);
            next2.delete(code);
            loadingSets.value = next2;
        }
    }

    function addSelection() {
        selections.value = [
            ...selections.value,
            { id: nextSelectionId(), setCode: "", count: DEFAULT_PACKS_PER_SET, boosterType: "" },
        ];
    }

    function removeSelection(id) {
        if (selections.value.length <= 1) return;
        selections.value = selections.value.filter((s) => s.id !== id);
    }

    function updateSelection(id, patch) {
        selections.value = selections.value.map((s) =>
            s.id === id ? { ...s, ...patch } : s
        );
    }

    // Build a card index for a set, pulling in supplemental sets when the
    // booster sheets reference UUIDs not present in the parent's own cards
    // array (e.g. TLA's `sourceMaterial` sheet → cards live in TLE).
    async function buildResolvedCardIndex(setCode, data) {
        const idx = buildCardIndex(data.cards);
        let missing = collectMissingSheetUuids(data.booster, idx);
        if (missing.size === 0) return idx;

        let children = [];
        try {
            children = await findSupplementalSets(setCode);
        } catch {
            return idx;
        }
        // Try every supplemental set; bail early once all UUIDs are resolved.
        for (const child of children) {
            if (missing.size === 0) break;
            try {
                const childData = await ensureSetData(child.code);
                if (childData?.cards) {
                    mergeCardsIntoIndex(idx, childData.cards);
                    missing = collectMissingSheetUuids(data.booster, idx);
                }
            } catch {
                // Skip children that fail to load — we may still have enough.
            }
        }
        return idx;
    }

    function boosterTypesFor(setCode) {
        const data = loadedSetData.value.get(setCode);
        if (!data?.booster) return [];
        return listDraftableBoosterTypes(data.booster);
    }

    async function startDraft() {
        if (!canStart.value) return;
        phase.value = "loading";
        error.value = null;

        try {
            // Resolve sets in parallel.
            const uniqueSetCodes = [...new Set(
                selections.value
                    .filter((s) => s.setCode && (Number(s.count) || 0) > 0)
                    .map((s) => s.setCode)
            )];
            await Promise.all(uniqueSetCodes.map((c) => ensureSetData(c)));

            // Validate every selection has draftable booster data.
            for (const sel of selections.value) {
                if (!sel.setCode || (Number(sel.count) || 0) <= 0) continue;
                const data = loadedSetData.value.get(sel.setCode);
                if (!data || !hasDraftableBooster(data)) {
                    throw new Error(
                        `${sel.setCode} doesn't have draftable booster data in MTGJSON.`
                    );
                }
            }

            // Roll all packs upfront. Doing it now (rather than per-open) means
            // any random-but-rare distribution issues surface immediately, and
            // the user can see total-pack progress.
            const rolled = [];
            for (const sel of selections.value) {
                const count = Number(sel.count) || 0;
                if (!sel.setCode || count <= 0) continue;
                const data = loadedSetData.value.get(sel.setCode);
                const cardIndex = await buildResolvedCardIndex(sel.setCode, data);
                const type = pickBoosterType(data.booster, sel.boosterType || undefined);
                if (!type) {
                    throw new Error(`No usable booster type for ${sel.setCode}.`);
                }
                for (let i = 0; i < count; i++) {
                    const sim = rollPack(data.booster, type, cardIndex);
                    rolled.push({
                        setCode: sel.setCode,
                        packIndex: i,
                        total: count,
                        simResult: sim,
                    });
                }
            }

            packQueue.value = rolled;
            currentPackIndex.value = 0;
            phase.value = "opening";
        } catch (err) {
            error.value = err.message || String(err);
            phase.value = "setup";
        }
    }

    // Resolve the cards in the current pack against the local card DB. Done
    // lazily so we don't pay the lookup cost for packs the user hasn't opened
    // yet (and so cards.allCards has time to load on slow startups).
    function resolveCurrentPack() {
        const pack = currentPack.value;
        if (!pack) return [];
        if (pack.resolved) return pack.resolved;
        const cards = useCardStore();
        const idx = buildScryfallIndex(cards.allCards);
        pack.resolved = resolvePack(pack.simResult, pack.setCode, idx);
        return pack.resolved;
    }

    // Add the current pack's resolved cards to the running pool, advance.
    function commitCurrentPack() {
        const pack = currentPack.value;
        if (!pack) return;
        const resolved = resolveCurrentPack();
        const cards = useCardStore();
        cards.appendDraftedCards(resolved);
        currentPackIndex.value += 1;
        if (currentPackIndex.value >= packQueue.value.length) {
            phase.value = "finished";
        }
    }

    // Skip remaining packs and finalize whatever's been kept so far.
    function finishDraft() {
        phase.value = "finished";
    }

    function exitToDeckBuilder() {
        // The cards store already holds the pool. Just close the draft view.
        const cards = useCardStore();
        cards.setSealedMode(true);
        cards.closeImport();
        phase.value = "setup"; // ready for a new draft if user comes back
    }

    function reset() {
        phase.value = "setup";
        error.value = null;
        packQueue.value = [];
        currentPackIndex.value = 0;
    }

    return {
        // state
        phase,
        error,
        setOptions,
        setOptionsLoaded,
        setOptionsLoading,
        setOptionsError,
        loadedSetData,
        loadingSets,
        setLoadErrors,
        selections,
        packQueue,
        currentPackIndex,
        muted,
        // derived
        canAddSelection,
        totalPacks,
        validSelections,
        canStart,
        currentPack,
        packsRemaining,
        // actions
        loadSetOptions,
        ensureSetData,
        addSelection,
        removeSelection,
        updateSelection,
        boosterTypesFor,
        startDraft,
        resolveCurrentPack,
        commitCurrentPack,
        finishDraft,
        exitToDeckBuilder,
        reset,
    };
});
