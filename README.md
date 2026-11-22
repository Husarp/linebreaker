# Linebreaker

Linebreaker z systemem RPG — progresja rang, XP, osiągnięcia, misje dzienne/tygodniowe, ekwipunek, muzyka. Czyste HTML/CSS/JS, bez zewnętrznych frameworków.

---

## Struktura plików

```
Linebreaker/
├── index.html          # Cały UI — menu, gra, overlaye, panele
├── app.js              # Cała logika — jeden duży IIFE (~10 500+ linii)
├── style.css           # Style — układ, animacje, motywy
├── assets/
│   ├── music.json      # Katalog utworów (tytuł, artysta, kategoria, tagi)
│   └── music/*.ogg     # Prywatne pliki Ogg Opus (menu / game / intense)
├── missions_design.md  # Szczegółowy opis systemu misji
├── README.md           # Ten plik
├── CHANGELOG.md        # Historia zmian
└── plans.md            # Notatki i plany
```

---

## Architektura

Cały kod JS to jeden IIFE. Brak modułów, brak bundlera — jeden plik działa bezpośrednio w przeglądarce.

**Persystencja:**
- `saveData` — postęp gracza (XP, rangi, osiągnięcia, ekwipunek, misje, leaderboard) — zapisywany do pliku JSON przez Web File System API albo lokalnie w aplikacji natywnej
- `settings` — ustawienia UI/audio — w `localStorage`
- Zapis JSON ma pole `schemaVersion`; stare zapisy są migrowane przy odczycie. Daty są zapisane jako `yyyy-mm-dd`.
- `data/missions.json` — katalog misji ładowany przy starcie. Zapis zawiera tylko identyfikatory i stan misji. Przy zmianie katalogu zaktualizuj też kopię awaryjną w `app.js`.

---

## Systemy

### Gra — Linebreaker

Standard Linebreaker: siatka 10×22 (2 ukryte rzędy spawn zone), 7 klasycznych kształtów, 7-bag randomizer.

- **Hard drop** (spacja) — natychmiastowy drop + lock
- **Soft drop** (↓) — przyśpieszony drop
- **Obrót** (↑) — z wall kickami (SRS)
- **Hold** (H) — opcjonalna, wymaga odblokowania Gold I
- **Ghost piece** — opcjonalna, wymaga odblokowania Silver I
- **DAS/ARR** — konfigurowalne w ustawieniach
- **Line clear speed** — konfigurowalna (0–300ms)

**Scoring:** punkty za linie × speed multiplier × score multiplier (opcje trybu gry). Combo bonus za kolejne cleary. Float text feedback przy każdym lądowaniu.

**Speed levels:** 15 tierów (mnożniki prędkości 1.0–3.8×). Gracz widzi aktualny poziom i combo.

---

### System rang

8 rang × 10 poziomów każda, plus Celestite (endless po Diamond 10):

| # | Ranga | Kolor | Kształt badge | XP/poziom |
|---|-------|-------|---------------|-----------|
| 1 | BRONZE | `#cd7f32` | Koła | 1 000 |
| 2 | SILVER | `#c8d8e8` | Kwadraty | 2 000 |
| 3 | GOLD | `#ffd700` | Pięciokąty | 3 500 |
| 4 | EMERALD | `#50c878` | Sześciokąty | 5 500 |
| 5 | SAPPHIRE | `#3377ff` | Gwiazdy 4-ram. | 8 000 |
| 6 | RUBY | `#ff0033` | Gwiazdy 5-ram. | 11 000 |
| 7 | AMETHYST | `#8e44ad` | Gwiazdy 8-ram. | 14 500 |
| 8 | DIAMOND | `#94ffff` | Gwiazdy 10-ram. | 18 500 |
| ∞ | CELESTITE | `#7ec8e3` | Tarcza + aurora | 24 000 |

**Celestite:** tarcza ze złotym outline, animacją aurora, iskierkami i cykliczną zmianą kolorów (biały → złoty → jasnoniebieski). Numer poziomu renderowany fontem Noto Serif.

**Badge XP z osiągnięć:** common 500 XP, rare 2 000, epic 5 000, legendary 10 000, mythic 20 000. System "pending claims" — gracz odbiera XP w zakładce Achievements.

---

### Misje (Missions)

Dostępne z przycisku **MISSIONS** w menu głównym (zielony, top-left w siatce 2×2).

#### Daily Quests

- **5 questów dziennie** (3 easy + 2 normal base)
- **Ewolucja tierów:** każda easy ma 20% szans na upgrade do normal; każda normal ma 20% szans na upgrade do hard
- **Secret Quest:** 30% szans, pojawia się jako 6. quest (bonus). Tytuł "???" — opis ukryty do ukończenia. Tier normal lub hard wyświetlany normalnie. Nie można zmienić.
- **Odświeżenie:** raz dziennie (sprawdzane przy załadowaniu)
- **Change button:** raz dziennie można zmienić 1 quest na inny tego samego tieru

**Punkty za ukończenie questa:**
| Tier | Punkty |
|------|--------|
| Easy | 10 |
| Normal | 20 |
| Hard | 40 |
| Secret | 60 |

**Daily milestones** (codziennie resetowane):

| Próg | Nagroda |
|------|---------|
| 20 pts | +1 Part |
| 40 pts | +2 Parts |
| 70 pts | +5 Parts |
| 120 pts | +10 Parts |

Maksimum bazowe z jednego dnia (3E+2N): `3×10 + 2×20 = 70 pts`. Przy ewolucji i secret: nawet 150+ pts.

#### Weekly Missions

- **5 misji tygodniowo** (2 easy + 2 normal + 1 hard base)
- **Ewolucja:** 50% szans że jedna losowa misja awansuje o 1 tier. Jeśli już hard — target ×1.5 zamiast awansu tieru
- **Change button:** raz w tygodniu

**Punkty za ukończenie:**
| Tier | Punkty |
|------|--------|
| Easy | 10 |
| Normal | 15 |
| Hard | 20 |

Punkty z daily questów **też się liczą** do weekly progress bara. Daily quest pts są logowane per dzień.

**Weekly milestones:**

| Próg | Nagroda |
|------|---------|
| 40 pts | +2 Parts |
| 80 pts | +4 Parts |
| 120 pts | +7 Parts |
| 160 pts | +10 Parts |
| 200 pts | +15 Parts |

#### Sortowanie

Questy wyświetlane: hard → normal → easy, w ramach tieru sortowane malejąco po % postępu. Secret ostatni (przed sekcją Completed).

#### Sortowanie i układ

- Tier badge (HARD/NORMAL/EASY) po prawej stronie karty
- Postęp po lewej (tytuł, opis, pasek)
- Karta mniejsza = bardziej kompaktowa niż classyczne

#### Streak

**Daily streak:** zalicza się gdy ukończono ≥1 daily quest danego dnia.

**XP Multiplier z daily streak** (tylko gameplay XP, czyli game over screen):
| Streak | Mnożnik |
|--------|---------|
| 5 dni | ×1.25 |
| 10 dni | ×1.50 |
| 20 dni | ×1.75 |
| 30 dni | ×2.00 |

**Weekly streak:** zalicza się gdy ukończono ≥1 weekly mission w danym tygodniu.

Streak badge w prawym górnym rogu ekranu misji. Hover → tooltip z detalami i perkami.

#### Pasek postępu (styl XP baru)

Pionowe separatory w pozycjach milestone. Pod separatorami ikona pudełka:
- Szara = nieosiągnięta
- Pomarańczowa + pulsacja = osiągnięta, do odebrania (kliknij)
- Zielona ✓ = odebrana

Weekly pasek: hover pokazuje ile punktów każdy dzień wniósł.

#### Odznaki misji

| ID | Opis | Rarity |
|----|------|--------|
| `mq_first_easy` | Ukończ 1 easy quest | Common |
| `mq_normal_10` | Ukończ 10 normal questów | Rare |
| `mq_hard_5` | Ukończ 5 hard questów | Rare |
| `mq_secret_1` | Ukończ 1 secret quest | Epic |
| `mq_total_50` | Ukończ łącznie 50 questów/misji | Epic |
| `mq_streak_7` | 7-day daily streak | Rare |
| `mq_streak_30` | 30-day daily streak | Legendary |
| `mq_daily_perfect` | Ukończ wszystkie 5 questów + secret w 1 dzień | Secret/Rare |

---

### Osiągnięcia

~65+ osiągnięć w kategoriach:

**Basic (tierowane):** Score, Games, Speed, Survival, Streak, Speed Stack, Block Layer, Line Cruncher, Speedrunner, Quad Killer, Combo, Low Rider, Booster Fan, Fun Run, I-Piece Devotion, Daily Grind, Daily XP, Mirror Score, Fun², One at a Time, No Spin Zone, Spinner, Audiophile, Collector.

**Missions (tierowane):** patrz tabela wyżej.

**Secret (jednorazowe):** ~30 ukrytych osiągnięć z podpowiedziami. Zablokowane ikony losowane z puli. Gracz nie zna wymagań z góry.

---

### Ekwipunek i sklep

**Waluty:**
- **Parts** — zbierane z milestone nagród, level-upów. Waluta per-skin (każdy skin ma swój własny licznik)
- **Universal Parts** — waluta ogólna, użyteczna do dowolnego skinu/przedmiotu

**Odblokowanie** odbywa się przez zakładkę Inventory (pasek postępu części → odblokuj).

**Dostępne przedmioty:**
- **Skiny bloków:** 14 (neon, retro, glass, shadow, outline, metal, holo, puffy, bordered, journey, gem, gloss2k, lumines, minimal)
- **Motywy kolorystyczne:** 10 (default, ocean, forest, fire, dragon, void, sunset, arctic, midnight, sakura) + Custom Color picker
- **Palety bloków:** 8 (classic, greyscale, ice, pastel, dark, synthwave, earth, neon) + Custom Palette (per piece / auto shade / single color) + Random + Shuffle
- **Style siatki:** 4 (lines, dots, boxes, dotboxes)
- **Ghost color:** white lub colored
- **SFX Packs:** 5 (default, retro, arcade, cyber, zen)
- **Intense Tracks Pack** (muzyka podczas intensywnej gry)

---

### Tryby gry

**Normal** — standardowy Linebreaker z opcjami modyfikującymi mnożnik score:

| Opcja | Odblokowanie | Zmiana |
|-------|-------------|--------|
| Mirror | Silver I | +20% |
| No Next | Emerald I | +10% |
| Ghost Piece | Silver I | −20% |
| Hold | Gold I | −20% |
| 3 Next | Emerald I | −10% |

**Fun** — konfigurowalne wymiary planszy (4–14 kolumn, 10–28 rzędów) i startowy speed. Brak mnożnika score. **Fun Mode nie pozwala robić daily questów ani weekly missions** — wyraźna informacja w opisie trybu.

---

### Leaderboard

Przechowuje wszystkie wyniki z normalnych gier. Wyświetla top 50 z podium (top 3). "Load More" ładuje kolejne 50. Zakładki: Leaderboard, Pinned (przypięte wyniki), Highscores (najlepsze per speed level).

---

### Muzyka i dźwięk

Oryginalna ścieżka syntezowana: `menu`, `game` i `intense`. Kompilacja wydania używa `assets/music.release.json` i nie zawiera prywatnych nagrań. Zobacz [dokumentację muzyki](docs/MUSIC.md).

**SFX:** 11 syntezowanych dźwięków (Web Audio API): clear, drop, levelup, click, gameover, unlock, gift, booster, achievement, rankup, newrank.

**SFX Packs:** 5 stylów: Default, Retro, Arcade, Cyber, Zen. Każdy z unikalnym zestawem dźwięków.

Playlist panel: toggle tracki menu/game niezależnie, podgląd i odtwarzanie dźwięków.

---

### Ustawienia

- **Audio:** głośność muzyki/SFX, mute, SFX pack
- **Gameplay:** DAS, ARR, hard drop lock delay, line clear speed, screen shake, speed-up text
- **Wizualia:** motyw, skin, paleta bloków, styl siatki, ghost color, random/shuffle colors
- **Skala:** game scale, font size
- **Style paki:** pixel, modern, minimal, dark, glass, arcade

---

### Zapis gry

Plik `.lbsave` — XOR-szyfrowany + Base64. Importowany/eksportowany przez Transfer overlay. Dane przechowują:

- XP, poziom, ranga
- Wszystkie osiągnięcia (stan + daty)
- Ekwipunek (posiadane skiny, motywy, palety, grid style, itp.)
- Parts per item, universal parts
- Leaderboard (wszystkie gry)
- Misje (daily quests, weekly missions, streaki, punkty, milestones)
- Daily quest stats (byTier, totalCompleted, streak)

---

## Credity

- **Gemini** — podstawowy kod i struktura (wczesny etap)
- **Claude** — cały dalszy rozwój po początkowym setupie
