"""Every generated panorama panel: a background photo and a foreground layer.

Channels play their panels in this order (the strip order), so neighbours
should flow into each other. ORIENT h = landscape panels in a sideways strip,
v = portrait panels in a vertical strip.
"""

CHANNELS = {
    "below": {
        "orient": "v",
        "edge": "deep blue-green water, colour around #0d3a46",
        "front": "a few out-of-focus underwater elements very close to the camera: drifting strands of kelp or seagrass entering from the left and right edges, a small cluster of rising air bubbles, a few large blurry particles of marine snow",
        "panels": [
            ("damselfish", "A shallow, sunlit coral reef in American Samoa seen underwater: healthy branching and plate corals, small blue-green damselfish hovering over their patches, sun rays rippling down from the bright surface."),
            ("orcas", "Underwater in a cold Alaskan fjord just below the surface: a small pod of orcas (killer whales) gliding past, crisp black and white markings, green-blue water, rippling light from the surface above."),
            ("humpback", "Open water in a cold Alaskan fjord, a humpback whale gliding past in the middle distance, long pectoral fins, faint green-blue light from above, suspended particles."),
            ("bearded-seals", "Under Arctic sea ice near Svalbard: the underside of the ice glowing pale turquoise above, a bearded seal with long whiskers hanging vertically in the water below the ice, dim cold light."),
            ("blue-whale", "Vast open ocean far from land, deep blue water: an enormous blue whale, mottled blue-grey and impossibly long, gliding through the middle distance, faint light rays from far above, tiny drifting particles."),
            ("iceberg-tremor", "Deep underwater in the Southern Ocean, the enormous dark keel of an iceberg resting against the rocky seafloor, faint blue light filtering down its sheer ice walls."),
            ("iceberg-calving", "Deep blue Southern Ocean water beneath a disintegrating iceberg: fractured slabs and chunks of ice sinking through the water column, clouds of fine ice and bubbles, dark depths below."),
            ("upsweep", "The deep seafloor of the South Pacific beside an underwater volcanic ridge: dark basalt pillow lava, a faint orange glow from a distant volcanic vent, shimmering water, drifting particles, near-black blue water above."),
            ("bloop", "The deep ocean abyss near Antarctica: almost total darkness, a faint ghostly blue glow far above, a few drifting particles, an immense sense of empty space."),
        ],
    },
    "wild": {
        "orient": "h",
        "edge": "soft featureless mist in the scene's own light",
        "front": "close foreground vegetation silhouetted along the bottom edge and the lower left and right corners: leaves, ferns, grasses and a branch, slightly out of focus, as if seen past plants right in front of the camera",
        "panels": [
            ("gibbons", "Tropical rainforest canopy in southern Thailand at sunrise, seen from above the trees: tall dipterocarp trees, hanging vines, mist pooled in the valleys, the sun just rising over distant limestone hills."),
            ("howlers", "Tropical dry forest in Costa Rica in early morning: big spreading guanacaste trees, dense green canopy on rolling hills, morning haze. The sun itself is not visible."),
            ("bellbird", "A mossy New Zealand beech forest in soft morning light: twisted trunks thick with green moss, ferns, light filtering through the canopy. The sun itself is not visible."),
            ("lyrebird", "A fern gully in eastern Australia at midday: tall straight eucalyptus trunks, tree ferns, dappled light and leaf litter. The sun itself is not visible."),
            ("spadefoot-toads", "The Sonoran Desert in Arizona just after a summer monsoon storm at dusk: saguaro cacti, a shallow rain pool reflecting the sky, dark storm clouds breaking up. The sun itself is not visible."),
            ("loons", "Yellowstone Lake at evening: calm water, dark pine forest on the far shore, distant mountains, a pair of common loons small on the water. The sun itself is not visible."),
            ("nightingale", "A European river meadow with willow scrub at late twilight in May: deep blue sky, first stars, the willows dark against the last light. The sun itself is not visible."),
            ("higurashi", "A Japanese cedar forest on a hillside at dusk in late summer: tall straight cedar trunks, a small wooden shrine gate half hidden in the trees, warm last light in the haze. The sun itself is not visible."),
        ],
    },
    "cities": {
        "orient": "h",
        "edge": "soft out-of-focus shadow and haze",
        "front": "close foreground objects passing very near the camera, out of focus, along the bottom edge and the sides only: for example the edge of a table with a glass, a railing, a lamp post, a window frame edge, depending on the scene",
        "panels": [
            ("venice-dawn", "St Mark's Square in Venice at dawn, nearly empty: wet stone paving, the basilica and the campanile in pale early light, a few pigeons, soft morning mist."),
            ("cafe-istanbul", "Inside a traditional Istanbul café: small tables, tulip glasses of tea, a backgammon board mid-game, warm lamps, old tiles and patterned walls."),
            ("cairo-market", "A narrow covered market lane in Old Cairo: stalls of spices, brass lamps and fabrics, shafts of light through the roof, people as soft distant figures."),
            ("marrakech-adhan", "The Koutoubia Mosque minaret in Marrakech in late afternoon light, palm trees and rooftops, a warm dusty sky."),
            ("hongkong-harbour", "Victoria Harbour in Hong Kong in the evening: the skyline lights coming on, a Star Ferry crossing the dark water, blue hour sky."),
            ("seoul-subway", "Inside a Seoul subway train at night: bright clean carriage, seats, handrails, dark tunnel blurring past the windows, a few passengers as soft figures."),
            ("moscow-metro", "Mayakovskaya station in the Moscow metro: elegant steel arches, pink marble, oval ceiling mosaics glowing, a train arriving in the distance."),
            ("cafe-ammassalik", "A small cosy café in Tasiilaq, East Greenland, in Arctic winter twilight: a warm window looking out on snow, coloured wooden houses and icebergs in the fjord."),
        ],
    },
    "signals": {
        "orient": "h",
        "edge": "soft featureless darkness",
        "front": "dark foreground elements close to the camera along the bottom edge and lower corners: tall grass or snow-covered shrubs, a wooden fence post, cables or wires",
        "panels": [
            ("wow-signal", "The Big Ear radio telescope in Delaware, Ohio, at night in 1977: an enormous flat aluminium reflector field and a tilting flat reflector, its long ground plane gleaming under a starry summer sky, the Milky Way rising over the horizon toward Sagittarius."),
            ("aurora-radio", "A clearing in the Canadian boreal forest at night under bright green aurora, a small loop antenna on a tripod in the snow, faint glow from a receiver."),
            ("tohoku-quake", "Inside a seismic observatory tunnel cut into a mountain in Japan: rock walls, a seismometer on a concrete pier under a single lamp, cables running into the dark."),
            ("uvb76", "A tall lattice radio mast standing in a Russian birch forest on an overcast winter evening, guy wires, a red warning light at the top, snow on the ground."),
            ("gong-station", "A cold war era radio room in 1980s East Germany: grey metal receivers with dials and switches, a reel-to-reel tape recorder, an old wall clock, a single desk lamp."),
            ("cherry-ripe", "A field of shortwave transmitter antennas on a remote island at night: tall masts and wires against a starry sky, warning lights, the sea beyond."),
            ("g06-station", "A shortwave radio receiver glowing on a desk in a dark apartment at night, its dial lit amber, rain on the window, city lights blurred outside."),
        ],
    },
}

STYLE = (
    "Photorealistic, like a still from a calm high-end nature documentary or a large-format "
    "landscape photograph: natural light, real textures, gentle atmosphere and depth. "
    "Quiet and contemplative. No text, no lettering, no logos, no watermark, no border, no frame."
)


def back_prompt(ch, name, scene):
    c = CHANNELS[ch]
    if c["orient"] == "h":
        size = "1536x1024 (landscape)"
        seam = ("This is one panel of a long horizontal scrolling panorama. The leftmost and rightmost "
                f"12% of the image must fall off smoothly into {c['edge']}, so neighbouring panels "
                "can be cross-faded together invisibly. Keep the main subject in the centre-right.")
    else:
        size = "1024x1536 (portrait)"
        seam = ("This is one panel of a tall vertical scrolling panorama the viewer descends through. "
                f"The top 12% and bottom 12% must fall off smoothly into {c['edge']}, so stacked panels "
                "can be cross-faded together invisibly. Nothing important touches the top or bottom edge.")
    return size, f"{STYLE} {seam} Scene: {scene}"


def front_prompt(ch, name, scene):
    c = CHANNELS[ch]
    size = "1536x1024 (landscape)" if c["orient"] == "h" else "1024x1536 (portrait)"
    return size, (
        "A foreground layer for a parallax animation, photorealistic, as a PNG with a TRANSPARENT "
        "background (real alpha channel, background: transparent). "
        f"Show only {c['front']}, belonging to this place: {scene} "
        "Everything else, including the whole centre and upper half, must be fully transparent: "
        "no sky, no scenery, no backdrop, no colour fill. Clean, natural edges. "
        "No text, no watermark, no border."
    )
