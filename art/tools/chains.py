"""Continuous panoramas: each panel is outpainted from the edge of the one before.

A chain is generated in strip order. Panel 0 is generated fresh; every later
panel is an EDIT of a canvas whose leading SEED fraction is the trailing edge
of the previous panel, so neighbours share pixels where the player cross-fades
them. The last panel is seeded at both ends (its other end is panel 0's
leading edge), which closes the loop.

side 'left':  the next panel lies to the RIGHT (channel dir 'left');
              a panel's seed sits on its left.
side 'right': the next panel lies to the LEFT (channel dir 'right', mirrored);
              a panel's seed sits on its right.

Each scene says what the panel shows; `into` (optional) says what its far
edge should start becoming, so the next panel has something to grow from.
"""

SEED = 0.3      # must match the channel's `overlap` in js/channels.js
SIZE = (1536, 1024)

STYLE = (
    "Hyperrealistic and immersive, like a frame from a high-end documentary shot on a large-format "
    "camera: natural light, real textures, atmospheric depth, quiet and contemplative. One continuous "
    "photograph with a single consistent horizon line and camera height. No people looking at the camera. "
    "No text, no lettering, no signs with legible writing, no logos, no watermark, no border, no frame, "
    "no vignette, no split-screen, no collage."
)

CHAINS = {
    "cities": {
        "side": "left",
        "panels": [
            ("venice-dawn",
             "St Mark's Square in Venice at dawn, nearly empty: wet stone paving reflecting the pink sky, "
             "the basilica and the campanile in pale early light, a few pigeons, soft morning mist.",
             "the long colonnaded arcade of the Procuratie, with warm lamps glowing under its arches"),
            ("cafe-istanbul",
             "Through one of the arches the arcade becomes the inside of a traditional Istanbul tea house: "
             "small wooden tables, tulip glasses of tea on saucers, a backgammon board mid-game, warm brass "
             "lamps, old Iznik tiles on the walls, through a far window a glimpse of the Bosphorus.",
             "a carved wooden doorway at the back of the tea house opening onto a narrow covered market lane"),
            ("cairo-market",
             "The doorway leads straight on into a narrow covered market lane in Old Cairo: stalls of "
             "spices heaped in cones, hanging brass lamps and patterned fabrics, shafts of dusty daylight "
             "through holes in the roof, people as soft distant figures.",
             "the lane ending in a bright opening onto sunlit rooftops"),
            ("marrakech-adhan",
             "The market opens onto a rooftop terrace in Marrakech in late afternoon: terracotta rooftops "
             "and palm trees, the Koutoubia Mosque minaret glowing in warm dusty light, the Atlas mountains "
             "faint on the horizon.",
             "the rooftops stepping down to a waterfront as the sky deepens into blue dusk"),
            ("hongkong-harbour",
             "The dusk deepens to blue hour over Victoria Harbour in Hong Kong: the skyline lights coming "
             "on across dark water, a green-and-white Star Ferry crossing, a stone promenade with railings "
             "in the foreground.",
             "the promenade leading to the brightly lit glass entrance of an underground railway"),
            ("seoul-subway",
             "Inside a Seoul subway train at night: a bright clean carriage, blue seats, steel handrails "
             "and hanging straps, the dark tunnel blurring past the windows, a few passengers as soft "
             "figures looking at their phones.",
             "the end door of the carriage open onto a grand underground station with marble and arches"),
            ("moscow-metro",
             "The carriage opens onto Mayakovskaya station in the Moscow metro: elegant stainless steel "
             "arches, pink rhodonite marble, oval ceiling mosaics glowing in their cupolas, a train "
             "arriving in the distance.",
             "a stairway at the end of the hall rising toward cold blue twilight and snow"),
            ("cafe-ammassalik",
             "At the top of the stairs is a small cosy café in Tasiilaq, East Greenland, in Arctic winter "
             "twilight: candles and coffee cups on wooden tables, woollen throws, a big warm window looking "
             "out on snow, coloured wooden houses and icebergs in the fjord under a pink-violet sky.",
             None),
        ],
    },
    "signals": {
        "side": "right",
        "panels": [
            ("wow-signal",
             "The Big Ear radio telescope in Delaware, Ohio, on a summer night in 1977: an enormous flat "
             "aluminium reflector field and a great tilting flat reflector on steel girders, its ground plane "
             "gleaming faintly under a starry sky, the Milky Way rising over the horizon, tall summer grass.",
             "the grass and the open fields running away into darker country that turns snowy and wooded"),
            ("aurora-radio",
             "A snowy clearing in the Canadian boreal forest at night under bright green aurora curtains, "
             "black spruce silhouettes, a small loop antenna on a tripod in the snow with a cable running to "
             "a receiver glowing faintly in a case.",
             "the ground rising into a dark rocky mountainside with the lit mouth of a tunnel cut into it"),
            ("tohoku-quake",
             "Looking into a seismic observatory tunnel cut deep into a mountain in Japan: rough rock walls, "
             "a seismometer on a concrete pier under a single warm lamp, cables running away into the dark, "
             "the night mountainside around the tunnel mouth.",
             "the rock giving way to a snowy Russian birch forest on an overcast winter evening"),
            ("uvb76",
             "A tall lattice radio mast standing in a Russian birch forest on an overcast winter evening, "
             "guy wires stretching down through the trees, a red warning light at the very top, snow on the "
             "ground, a faint orange glow low in the clouds.",
             "the birch forest seen through the large window of a dim room full of old radio equipment"),
            ("gong-station",
             "A cold war era radio monitoring room in 1980s East Germany: grey metal receivers with lit "
             "dials and switches, a reel-to-reel tape recorder, an old wall clock, a single desk lamp, a "
             "large window onto the snowy forest.",
             "a second window in the room looking out at night onto a dark sea with tall radio masts"),
            ("cherry-ripe",
             "The radio room's wall ends at the edge of its window and the view steps outside, out of doors, "
             "onto the island itself, with no more window frames: a field of tall shortwave transmitter masts and curtain antennas on a remote island at night: "
             "wires against a starry sky, red warning lights, the dark sea beyond with the moon's path on it, "
             "wind-flattened grass.",
             "the coastline curving into the lights of a city at night, seen through rain on a window"),
            ("g06-station",
             "A shortwave radio receiver glowing on a wooden desk in a dark apartment at night, its dial "
             "lit amber, headphones and a notebook beside it, rain streaking a big window, city lights "
             "blurred outside.",
             None),
        ],
    },
    "wild": {
        "side": "right",
        "panels": [
            ("gibbons",
             "Tropical rainforest canopy in southern Thailand at sunrise, seen from above the trees: tall "
             "dipterocarp trees, hanging vines, mist pooled in the valleys, the sun just rising over distant "
             "limestone karst hills.",
             "the forest rolling on over drier hills with big spreading trees in morning haze"),
            ("howlers",
             "Tropical dry forest in Costa Rica in early morning: big spreading guanacaste trees, dense green "
             "canopy on rolling hills, soft morning haze. The sun itself is not visible.",
             "the camera sinking toward the ground into a mossy forest with twisted trunks"),
            ("bellbird",
             "Inside a mossy New Zealand beech forest in soft morning light: twisted trunks thick with green "
             "moss, ferns, light filtering through the canopy. The sun itself is not visible.",
             "the forest becoming taller and straighter, pale eucalyptus trunks and tree ferns"),
            ("lyrebird",
             "A fern gully in eastern Australia at midday: tall straight pale eucalyptus trunks, tree ferns, "
             "a small creek, dappled light and leaf litter. The sun itself is not visible.",
             "the trees thinning out into dry open desert country under a stormy sky"),
            ("spadefoot-toads",
             "The Sonoran Desert in Arizona just after a summer monsoon storm at dusk: saguaro cacti, a "
             "shallow rain pool reflecting the glowing sky, dark storm clouds breaking up. The sun itself is "
             "not visible.",
             "the land rising into a dark pine forest beside a calm mountain lake at evening"),
            ("loons",
             "Yellowstone Lake at evening: calm water reflecting the sky, dark pine forest on the far shore, "
             "distant mountains, a pair of common loons small on the water. The sun itself is not visible.",
             "the lake narrowing into a quiet river with willows in late twilight"),
            ("nightingale",
             "A European river meadow with willow scrub at late twilight in May: deep blue sky, first stars, "
             "the willows dark against the last light, a slow river. The sun itself is not visible.",
             "the river bank rising into a hillside of tall dark cedars in warm hazy dusk"),
            ("higurashi",
             "A Japanese cedar forest on a hillside at dusk in late summer: tall straight cedar trunks, a "
             "small weathered wooden torii gate half hidden in the trees, warm last light in the haze. The "
             "sun itself is not visible.",
             None),
        ],
    },
}


def prompt(ch, i):
    """The instruction for panel i of a chain, and which edges are seeded."""
    c = CHAINS[ch]
    panels = c["panels"]
    name, scene, into = panels[i]
    n = len(panels)
    pct = round(SEED * 100)
    lead, trail = ("left", "right") if c["side"] == "left" else ("right", "left")
    if i == 0:
        edges = []
        how = ("Create a new image. This is the first panel of a very long continuous horizontal "
               "panorama, so the image must run right off both side edges with no falloff, darkening "
               "or framing: the scene simply continues beyond them.")
    elif i < n - 1:
        edges = [lead]
        how = (f"EDIT the attached image (use it as the input image to edit). Its {lead} {pct}% is a "
               f"finished photograph; the flat grey area is empty canvas. Keep the {lead} {pct}% exactly "
               f"as it is, same position and scale, and fill the grey area by continuing the same "
               f"photograph seamlessly to the {trail}, as one continuous wide panorama.")
    else:
        edges = [lead, trail]
        how = (f"EDIT the attached image (use it as the input image to edit). Its {lead} {pct}% and its "
               f"{trail} {pct}% are both finished photographs; the flat grey band between them is empty "
               f"canvas. Keep both ends exactly as they are, same position and scale, and fill the grey "
               f"band so that the whole image is one continuous photograph that flows from the {lead} "
               f"end, through the scene below, into the {trail} end without any visible join.")
    nxt = (f" Toward the {trail} edge the scene starts turning into {into}, so the panorama can carry on "
           f"there.") if into else ""
    body = (f"{how} Scene: {scene} Keep the main subject near the middle of the image, clear of the outer quarter on each side.{nxt} {STYLE}")
    return name, edges, body
