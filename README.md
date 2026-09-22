# GeopoliticsAI.com

### *The Geopolitics of AI, Mapped*

An interactive, source-linked geospatial tracker of international AI governance, semiconductor supply chains, and frontier-model safety alignments across **WAICO**, **Pax Silica**, and the **Call for Control of Frontier AI Models**.

---

## Overview & Mission

Global artificial intelligence governance is dividing not into rigid Cold War-style blocs, but into overlapping, institutionally distinct coalitions:

1. **WAICO (World Artificial Intelligence Cooperation Organization)**:
   - *Legal Form:* Intergovernmental treaty organization.
   - *Launch:* 16 July 2026 in Shanghai on the eve of the World AI Conference (WAIC).
   - *Focus:* Digital capacity building in the Global South and adoption of open-weight/open-source AI architectures (e.g. DeepSeek, Kimi).
   - *Secretariat:* Headquartered in Shanghai with a Ministerial Council.

2. **Pax Silica**:
   - *Legal Form:* Non-binding economic-security and supply-chain framework coordinated by the U.S. Department of State.
   - *Launch:* 12 December 2025 at the inaugural Pax Silica Summit in Washington, D.C.
   - *Focus:* Securing advanced chip supply chains, critical minerals refining, AI data centers, and trusted international investment to eliminate coercive dependencies.

3. **Call for Control of Frontier AI Models**:
   - *Legal Form:* Open multilateral political declaration.
   - *Launch:* 21 September 2026 on the sidelines of the UN General Assembly in New York.
   - *Initiators:* Spearheaded by Finnish President Alexander Stubb and Norwegian Prime Minister Jonas Gahr Støre, endorsed by 22 world leaders and the European Commission.
   - *Focus:* Mandatory pre-deployment testing, independent safety evaluations, incident reporting, and exploring a UN-style international oversight institution for frontier models.

### Key Nuances & Institutional Distinctions
- **Tripartite Overlap:** **Kazakhstan** signed the WAICO founding treaty, joined Pax Silica at the Second Summit, and President Kassym-Jomart Tokayev personally endorsed the Frontier AI Call.
- **Two-Way Alliances:** **Singapore** signed Pax Silica, endorsed the Frontier AI Call, and is an invited state considering WAICO; **South Africa** and **Kenya** are WAICO founding members whose heads of state endorsed the Frontier Call; **Australia**, **Canada**, **Germany**, **Netherlands**, **Norway**, **UAE**, and **Estonia** bridge Pax Silica and the Frontier AI Call.
- **The European Union Nuance:** The European Union signed Pax Silica on 23 June 2026, and European Commission President Ursula von der Leyen endorsed the Frontier AI Call on 21 September 2026. This tracker distinguishes individual EU member states that directly signed in a national capacity (e.g. Germany, Greece, Netherlands, Sweden, Finland, Portugal, Italy) from those covered via EU competence, as well as leaders who endorsed the Frontier Call in their national capacity.

---

## Features

- 🌍 **Dual Projections (2D World Map & 3D Globe):**
  - **2D Natural Earth Map (Default):** Optimized for smooth panning and deep zooming into smaller island states and micro-territories (e.g. Singapore, Bahrain, Qatar, Netherlands, Dominica, Brunei).
  - **3D Orthographic Globe:** Smooth touch/mouse spherical rotation with inertial dampening, atmospheric glow, and auto-spin mode.
- ♿ **Tactile Patterns & Textures Mode (A11y):**
  - Color-blind friendly palette (Crimson, Azure, Amber Gold).
  - Toggleable SVG pattern hatching (stripes for WAICO, stipple dots for Pax Silica, grid mesh for Frontier Call, complex weave for tripartite overlaps).
  - Distinct symbolic badges (`◆` WAICO, `■` Pax Silica, `★` Frontier Call) so meaning is never encoded by color alone.
- 🎛️ **Multi-Layer Checkboxes & Presets:**
  - Independently toggle any combination of WAICO, Pax Silica, and the Frontier Call.
  - Filter by Tripartite Overlap, Two-Way Overlaps, Direct Signatories, Observers, or EU Member States.
- 📋 **Comprehensive Country Profile Drawer:**
  - Full details on accession dates, signatory titles, leader names, and notes.
  - Direct clickable links to primary government press releases, treaties, and Wikipedia records.
  - One-click copyable shareable permalinks (`#country=KAZ`).
- 📊 **Searchable & Sortable Register:**
  - Instant fuzzy search across countries, leaders, and ISO-3166 codes.
  - Sort by any column (Country, Region, WAICO status, Pax Silica status, Frontier Call endorsement).
- 💾 **Data Export:**
  - Download full dataset as **CSV**, **JSON**, or **XML** for academic and policy research.
- 🤖 **Automated Daily Ingestion (GitHub Actions):**
  - Workflow scrapes Wikipedia MediaWiki APIs for newly ratified accessions and builds the site artifact daily without polluting the git commit history.

---

## Project Structure

```
├── index.html                   # Main application shell
├── css/
│   ├── style.css                # Light/dark theme variables, modern typography & layout
│   └── accessibility.css        # Tactile pattern definitions, colorblindness & high-contrast styles
├── js/
│   ├── app.js                   # Application state, event listeners, drawer & modal controller
│   ├── map.js                   # D3.js 2D Natural Earth & 3D Globe rendering engine
│   ├── data.js                  # Data store, active layer filtering, and CSV/JSON/XML exports
│   └── vendor/
│       ├── d3.min.js            # Vendored D3.js v7 (zero external runtime latency)
│       └── topojson-client.min.js
├── data/
│   ├── countries.json           # Master unified dataset with ISO-3166 codes & alliance statuses
│   ├── frontier_call.json       # Verified primary dataset of the 22 endorsing world leaders
│   ├── iso_countries.json       # ISO-3166-1 standard country codes (249 entities)
│   └── world-110m.json          # Clean vector world atlas TopoJSON
├── scripts/
│   └── fetch_wikipedia_data.py  # Python ingestion script to parse Wikipedia API & build countries.json
├── .github/
│   └── workflows/
│       └── deploy.yml           # GitHub Actions workflow for daily automated build & Pages deployment
├── LICENSE                      # MIT License
└── README.md                    # Project documentation
```

---

## Local Development

Because GeopoliticsAI.com is built with vanilla web technologies and vendored libraries, running it locally requires no build steps or bundlers:

```bash
# Clone the repository
git clone https://github.com/kocijan/geopoliticsai.git
cd geopoliticsai

# Start any local HTTP server
python3 -m http.server 8000
# or: npx serve
```

Open your browser at `http://localhost:8000`.

### Updating the Data Manually

To fetch the latest accessions from Wikipedia and rebuild `data/countries.json`:

```bash
python3 scripts/fetch_wikipedia_data.py
```

---

## Primary Sources & Truth Citations

- **Call for Control of Frontier AI Models:**
  - [Official Declaration PDF (Norwegian Government)](https://www.regjeringen.no/contentassets/35b2ea6933304966bd739ff4b8107300/a-call-for-control-of-frontier-ai-models-final.pdf)
  - [Office of the President of Finland (Presidentti.fi)](https://www.presidentti.fi/en/a-call-for-control-of-frontier-ai-models/)
  - [Politico Europe Reporting](https://www.politico.eu/article/20-countries-urge-to-strenghten-oversight-of-ai-to-keep-it-under-human-control/)
- **World Artificial Intelligence Cooperation Organization (WAICO):**
  - [WAICO on Wikipedia](https://en.wikipedia.org/wiki/World_Artificial_Intelligence_Cooperation_Organization)
  - State Council of the People's Republic of China & Ministry of Foreign Affairs releases.
- **Pax Silica:**
  - [Pax Silica on Wikipedia](https://en.wikipedia.org/wiki/Pax_Silica)
  - [U.S. Department of State: Pax Silica Initiative](https://www.state.gov/pax-silica)

---

## Author & Community Contributions

Built by **[Martin Josip Kocijan](https://github.com/kocijan)**.

Improvements, corrections, and additions are warmly welcomed:
- Found a newly signed accession or missing leader endorsement? Open a [GitHub Issue](https://github.com/kocijan/geopoliticsai/issues) or submit a Pull Request.
- Citations must include primary government statements, treaty registry entries, or official diplomatic press releases.

---

## License

This project is licensed under the [MIT License](LICENSE).
