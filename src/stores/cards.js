import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { parseCardDatabase } from "../services/cardDatabase";

export const useCardStore = defineStore("cards", () => {
    const allCards = ref([]);
    const sets = ref({});
    const loading = ref(false);
    const loaded = ref(false);
    const selectedCard = ref(null);

    // Filters
    const searchQuery = ref("");
    const colorFilter = ref([]);
    const typeFilter = ref("");
    const rarityFilter = ref("");
    const sortBy = ref("name");

    const filteredCards = computed(() => {
        let result = allCards.value;
        const query = searchQuery.value.toLowerCase().trim();

        if (query) {
            result = result.filter(
                (c) => c.name.toLowerCase().includes(query) || c.text.toLowerCase().includes(query)
            );
        }

        if (colorFilter.value.length > 0) {
            result = result.filter((c) => {
                const cardColors = c.colors.toUpperCase();
                if (colorFilter.value.includes("C")) {
                    if (!cardColors) return true;
                }
                return colorFilter.value.some((color) => cardColors.includes(color));
            });
        }

        if (typeFilter.value) {
            const t = typeFilter.value.toLowerCase();
            result = result.filter((c) => c.type.toLowerCase().includes(t));
        }

        if (rarityFilter.value) {
            result = result.filter((c) => c.rarity.toLowerCase() === rarityFilter.value.toLowerCase());
        }

        if (sortBy.value === "name") {
            result = [...result].sort((a, b) => a.name.localeCompare(b.name));
        } else if (sortBy.value === "cmc") {
            result = [...result].sort((a, b) => a.cmc - b.cmc || a.name.localeCompare(b.name));
        } else if (sortBy.value === "color") {
            result = [...result].sort((a, b) => a.colors.localeCompare(b.colors) || a.name.localeCompare(b.name));
        } else if (sortBy.value === "type") {
            result = [...result].sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));
        }

        return result;
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
        colorFilter.value = [];
        typeFilter.value = "";
        rarityFilter.value = "";
        sortBy.value = "name";
    }

    return {
        allCards,
        sets,
        loading,
        loaded,
        selectedCard,
        searchQuery,
        colorFilter,
        typeFilter,
        rarityFilter,
        sortBy,
        filteredCards,
        parseDatabase,
        selectCard,
        clearSelection,
        resetFilters,
    };
});
