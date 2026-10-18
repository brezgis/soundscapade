# Soundscapade

A soundscape escapade: a full-screen, slowly drifting window onto strange real sounds — Saturn's radio, seals trilling under Arctic ice, a café in Greenland, the oldest recorded human voice, cold-war numbers stations, the Wow! signal, and open microphones somewhere in the world right now.

It opens straight onto a random channel and a random sound. Click anywhere for sound (browsers won't play audio before you do), then just leave it running.

## Channels

| | | |
|---|---|---|
| **Above** | Earth's chorus from the Van Allen Probes ("Earthsong"); Mars wind, a dust devil and a meteoroid impact; Juno passing Ganymede; Saturn's auroral radio and lightning; Voyager 1 in interstellar plasma; the Perseus black hole | real NASA images, climbing with the gaps between worlds to scale |
| **Below** | a reef, orcas, a humpback, bearded seals, a blue whale, a singing iceberg, an iceberg breaking up, the Upsweep, the Bloop | layered underwater panorama, descending |
| **Wild** | gibbons, howler monkeys, a bellbird, a lyrebird, spadefoot toads, loons, a nightingale, higurashi | layered panorama, dawn to dusk |
| **Cities** | Venice at dawn, cafés in Istanbul and Greenland, Cairo's market, Marrakech, Hong Kong harbour, the Seoul subway, the Moscow metro | real photographs and generated scenes, joined by dark "tunnels" |
| **Voices** | the 1860 phonautograph, Brahms, Tennyson, Florence Nightingale, the Voyager greetings, Tuvan overtone singing, whistled Yoruba | archival photographs along a timeline |
| **Signals** | the Wow! signal, aurora natural radio, the Tōhoku earthquake, the Buzzer, the Gong, Cherry Ripe, the German lady | listening posts, with the signal itself drawn in: a live spectrogram, a seismograph trace, the 6EQUJ5 printout, numbers surfacing |
| **Now** | live Locus Sonus open microphones in Kyoto, Amsterdam, Bristol, Brussels, the Alps and Jeju | a globe that turns to the microphone |

Every caption is quoted from a real source (NASA, NOAA, the National Park Service, the BBC catalogue, the recordists' notes, Wikipedia) and says whose words and whose recording it is.

Keys: `1`–`7` channels · `→` or `n` next sound · `↑`/`↓` neighbouring channel · `m` mute.

## Run it

Static site, no build step:

```sh
python3 -m http.server 8000
# open http://localhost:8000/
```

## How it works

- **Sound** (`js/audio.js`): each channel has a synthesized noise bed (thin air, deep water, wind) under real recordings that cycle with cross-fades. Short clips recur with silences between them, like calls in the distance, so nothing sounds looped. Live streams are metered and auto-levelled, and skipped if offline or sending dead air. Everything feeds one analyser that the visuals listen to.
- **Panoramas** (`js/panorama.js`): one image panel per sound, in strip order, cross-faded at feathered seams. The camera creeps across the current panel and glides to the next one when the sound changes — sideways, up or down depending on the channel. Panels can have a transparent foreground layer that moves 1.6× faster for parallax, with mist, light shafts, particles and fireflies drawn between the layers.
- **Procedural scenes** (`js/scenes.js`) for channels without a panorama, including the Signals waterfall.
- **Catalogue** (`js/channels.js`): every track, caption, source and credit.
- **Art pipeline** (`art/tools/`): `manifest.py` holds the scene prompts, `run.py` generates background and foreground layers, `prep.py` turns them into WebP.

The Wow! signal has no recording — Big Ear only printed numbers — so it's sonified here from Jerry Ehman's published intensities (`6EQUJ5`, one value every 12 s) as a 1420.4556 Hz tone, the signal's frequency scaled down a million times. The Tōhoku earthquake is IU.MAJO seismometer data from EarthScope, sped up 400×.

## Credits and licences

The **code** is MIT (see `LICENSE`). The sounds, images and quoted texts belong to their creators:

- **NASA / JPL-Caltech / University of Iowa** — Mars, Saturn, Jupiter (Juno), Voyager and Van Allen Probes sounds and images; Voyager Golden Record. Public domain.
- **NASA Chandra X-ray Center** — Perseus cluster sonification (NASA/CXC/SAO; K. Arcand, SYSTEM Sounds) and image (NASA/CXC/GSFC).
- **Kalleheikki Kannisto** — enhanced Juno image of Ganymede, CC BY.
- **NOAA PMEL Acoustics Program** — icebergs, the Bloop, the Upsweep, a blue whale, damselfish. U.S. government work.
- **National Park Service** — humpback, orcas, spadefoot toads; NPS & MSU Acoustic Atlas — loons. Public domain.
- **Wikimedia Commons** contributors — gibbons, howler monkeys, bellbird, lyrebird, nightingale, higurashi, bearded seals (Max Eastley), Marrakech, Seoul subway, the historical voices, Yoruba whistling, Tuvan singing, the numbers stations, archival photographs. Public domain, CC0, CC BY or CC BY-SA as credited in each caption.
- **BBC Sound Effects archive** — the Istanbul, Greenland, Venice, Cairo, Hong Kong and Moscow recordings, under the RemArc licence: **personal, educational and research use only**.
- **Stephen P. McGreevy**, via the University of Iowa — VLF natural radio. Licence not stated.
- **Locus Sonus** — live open-microphone streams.
- Caption texts quote the sources named in each caption, including Wikipedia (CC BY-SA) and Priyom.org (CC BY-NC-SA).
- **Photographs** in Cities and Signals (Venice, Moscow, the Churchill aurora, the Matsushiro tunnel) and the Tuva steppe in Voices come from Wikimedia Commons contributors under CC BY / CC BY-SA, credited in each caption.
- Other panorama scenes and the foreground layers are AI-generated illustrations.

If you're a rights-holder and would like a credit corrected or something removed, please open an issue.
