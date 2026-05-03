export const SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<cockatrice_carddatabase version="4">
    <sets>
        <set>
            <name>LEA</name>
            <longname>Limited Edition Alpha</longname>
            <settype>Core Set</settype>
            <releasedate>1993-08-05</releasedate>
        </set>
        <set>
            <name>MMQ</name>
            <longname>Mercadian Masques</longname>
            <settype>Expansion</settype>
            <releasedate>1999-10-04</releasedate>
        </set>
        <set>
            <name>RAV</name>
            <longname>Ravnica</longname>
            <settype>Expansion</settype>
            <releasedate>2005-10-07</releasedate>
            <priority>10</priority>
        </set>
    </sets>
    <cards>
        <card>
            <name>Lightning Bolt</name>
            <text>Lightning Bolt deals 3 damage to any target.</text>
            <prop>
                <manacost>R</manacost>
                <cmc>1</cmc>
                <type>Instant</type>
                <maintype>Instant</maintype>
                <colors>R</colors>
                <coloridentity>R</coloridentity>
                <layout>normal</layout>
            </prop>
            <set rarity="common" uuid="aaa-111" muid="100" num="161" picurl="http://example.com/bolt.jpg">LEA</set>
            <set rarity="uncommon" uuid="bbb-222" num="200">MMQ</set>
        </card>
        <card>
            <name>Forest</name>
            <text></text>
            <prop>
                <manacost></manacost>
                <cmc>0</cmc>
                <type>Basic Land — Forest</type>
                <maintype>Land</maintype>
                <colors></colors>
                <coloridentity>G</coloridentity>
            </prop>
            <set rarity="common" uuid="ccc-333" num="347">LEA</set>
        </card>
        <card>
            <name>Some Token</name>
            <token>1</token>
            <prop>
                <type>Token Creature</type>
            </prop>
            <set rarity="token" uuid="tok-1">LEA</set>
        </card>
        <card>
            <name>Multi Spell</name>
            <text>Do something cool.</text>
            <prop>
                <manacost>2WU</manacost>
                <cmc>4</cmc>
                <type>Sorcery</type>
                <maintype>Sorcery</maintype>
                <colors>WU</colors>
                <coloridentity>WU</coloridentity>
            </prop>
            <set rarity="rare" uuid="ddd-444" num="50">MMQ</set>
            <set rarity="mythic" uuid="eee-555" num="60">RAV</set>
        </card>
    </cards>
</cockatrice_carddatabase>`;

export const INVALID_XML = `<?xml version="1.0"?><wrong_root></wrong_root>`;

export const EMPTY_XML = `<?xml version="1.0"?>
<cockatrice_carddatabase version="4">
    <sets></sets>
    <cards></cards>
</cockatrice_carddatabase>`;
