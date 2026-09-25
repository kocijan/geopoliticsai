# GeopoliticsAI.com

### *Map of AI Geopolitics*

An interactive, source-linked geospatial tracker of international AI governance, semiconductor supply chains, and frontier-model safety alignments across **WAICO**, **Pax Silica**, and the **Call for Control of Frontier AI Models**.

---

## Overview & Mission

Global artificial intelligence governance is dividing not into rigid Cold War-style blocs, but into overlapping, institutionally distinct coalitions:

1. **WAICO (World Artificial Intelligence Cooperation Organization)**:
   - *Legal Form:* Intergovernmental treaty organization.
   - *Launch:* 16 July 2026 in Shanghai on the eve of the World AI Conference (WAIC).
   - *Focus:* Digital capacity building in the Global South, open technology cooperation, and equitable AI infrastructure access.
   - *Secretariat:* Headquartered in Shanghai with a Ministerial Council.

2. **Pax Silica**:
   - *Legal Form:* Non-binding economic-security and supply-chain framework coordinated by the U.S. Department of State.
   - *Launch:* 12 December 2025 at the inaugural Pax Silica Summit in Washington, D.C.
   - *Focus:* Securing advanced chip supply chains, critical minerals refining, AI data centers, and trusted international investment to reduce strategic or excessive dependencies and address non-market practices.

3. **Call for Control of Frontier AI Models ("Frontier Control")**:
   - *Legal Form:* Open multilateral political declaration.
   - *Launch:* 21 September 2026 on the sidelines of the UN General Assembly in New York.
   - *Initiators:* Spearheaded by Finnish President Alexander Stubb and Norwegian Prime Minister Jonas Gahr Støre; launched on 21 September 2026 and currently endorsed by 28 leaders and senior officials representing 26 countries, together with the President of the European Commission.
   - *Focus:* Mandatory pre-deployment testing, independent safety evaluations, incident reporting, and exploring an international institution capable of standard-setting and verification for frontier models.

### Key Nuances & Institutional Distinctions
- **Tripartite Overlap:** **Kazakhstan** signed the WAICO founding treaty, joined Pax Silica at the Second Summit, and President Kassym-Jomart Tokayev personally endorsed the Frontier Control declaration.
- **Two-Way Alliances:** **Singapore** signed Pax Silica, endorsed Frontier Control, and is an invited state considering WAICO; **South Africa** and **Kenya** are WAICO founding members whose heads of state endorsed Frontier Control; **Direct Pax + Frontier only:** 7 countries under the default direct-signatory methodology (Australia, Germany, Netherlands, Norway, Singapore, UAE, and Kazakhstan as tripartite; plus observers Estonia and Canada).
- **The European Union Nuance:** The European Union signed Pax Silica on 23 June 2026, and European Commission President Ursula von der Leyen endorsed Frontier Control on 21 September 2026. This tracker distinguishes individual EU member states that directly signed in a national capacity (Germany, Greece, Netherlands, Sweden, Finland, Italy) from 19 member states represented visually through the EU’s institutional signature (displayed with blue dots over a neutral grey background, or blue dots over gold for Frontier Control endorsers such as France). Portugal is separately tracked as a signatory of the Joint Statement on AI Opportunity.
- **Taxonomy & Statuses:** Distinguishes formal national signatories (24 countries + EU), EU-represented member states (19), observers (Canada, Estonia), announced observers (Bangladesh), invited states under consideration (Singapore), non-signatory participants (Taiwan), and AI Opportunity Statement signatories.

---

## Features

- 🌍 **Dual Projections (2D World Map & 3D Globe):**
  - **2D Natural Earth Map (Default):** Optimized for smooth panning and deep zooming into smaller island states and micro-territories (e.g. Singapore, Bahrain, Qatar, Netherlands, Dominica, Brunei).
  - **3D Orthographic Globe:** Smooth touch/mouse spherical rotation with inertial dampening, atmospheric glow, and auto-spin mode.
- 🎨 **Cell-Colored Table & Map Symbology:**
  - Modern cell-colored status indicator system with clear text labels and tinted backgrounds.
  - Multi-initiative overlap styling: customizable between consecutive alternating stripes side-by-side or composite solid colors.
  - Visual distinction for EU-represented states (blue with golden yellow dots) and observers.
- 🎛️ **Multi-Layer Checkboxes & Presets:**
  - Independently toggle any combination of WAICO, Pax Silica, and Frontier Control.
  - Filter by Tripartite Overlap, Two-Way Overlaps, Direct Signatories, Observers, EU Member States, or AI Opportunity Statement.
  - Display & Overlap Settings modal for customizing overlap visualization and EU inclusion.
- 📋 **Comprehensive Country Profile Drawer:**
  - Full details on accession dates, signatory titles, leader names, and notes.
  - Direct clickable links to primary government press releases (State Department, foreign ministries, official communiqués) with transparent tagging for any secondary sources pending confirmation.
  - One-click copyable shareable permalinks (`#country=KAZ`).
- 📊 **Searchable & Sortable Countries & Territories:**
  - Instant fuzzy search with typo tolerance, subsequence matching, and score ranking across countries, leaders, and ISO-3166 codes.
  - Sort by any column (Country, Region, WAICO status, Pax Silica status, Frontier Control endorsement).
  - Accurate coverage of 252 total entities: 249 official ISO 3166-1 entities plus 3 additional project entities (Kosovo `XKX`, Somaliland `SOL`, Northern Cyprus `XNC`).
- 💾 **Comprehensive Data Export:**
  - Download full dataset as **CSV**, **JSON**, or **XML** for academic and policy research, with full multi-source citations, AI Opportunity Statement data, and supranational organization records (EU/Commission).
- 🛡️ **Authoritative Curation:**
  - Strict verification against primary diplomatic texts, government portals, and official foreign ministry declarations.

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
│   └── data.js                  # Data store, active layer filtering, and CSV/JSON/XML exports
├── data/
│   ├── countries.json           # Master unified dataset with ISO-3166 codes & alliance statuses
│   ├── frontier_call.json       # Verified primary dataset of the endorsing world leaders and officials
│   ├── iso_countries.json       # ISO-3166-1 standard country codes (249 entities)
│   └── world-50m.json           # Visionscarto 50m TopoJSON (242 countries, clean topology)
├── scripts/
│   ├── compare_wikipedia_report.py  # Informative comparison report script (manual diagnostic tool; not in CI/CD)
│   └── generate_thumbnail.py        # Generates high-res Open Graph social sharing card
├── .github/
│   └── workflows/
│       └── deploy.yml           # GitHub Actions workflow for deployment & thumbnail generation
├── LICENSE                      # MIT License
└── README.md                    # Project documentation
```

---

## Local Development

Because GeopoliticsAI.com is built with vanilla web technologies, running it locally requires no build steps or bundlers:

```bash
# Clone the repository
git clone https://github.com/kocijan/geopoliticsai.git
cd geopoliticsai

# Start any local HTTP server
python3 -m http.server 8000
# or: npx serve
```

Open your browser at `http://localhost:8000`.

### Comparing Data with Wikipedia

To run a live comparison of current Wikipedia wikitext against `data/countries.json` (strictly read-only diagnostic report):

```bash
python3 scripts/compare_wikipedia_report.py
```

---

## Evidentiary Methodology & Sources

Data integrity follows a strict five-tier evidentiary hierarchy:
1. **Official initiative roster or declaration** (e.g. [Presidentti.fi official declaration](https://www.presidentti.fi/en/a-call-for-control-of-frontier-ai-models/), [Norwegian Government Declaration text](https://www.regjeringen.no/contentassets/35b2ea6933304966bd739ff4b8107300/a-call-for-control-of-frontier-ai-models-final.pdf)).
2. **Depositary, treaty registry, or organizing government** (e.g. [U.S. Department of State Pax Silica Initiative & Fact Sheets](https://www.state.gov/pax-silica), Shanghai Municipal Government / WAIC Secretariat).
3. **Acceding country’s foreign ministry or head-of-government office** (e.g. [Singapore MDDI Parliamentary response](https://www.mddi.gov.sg/newsroom/mddi-response-to-pq-on-singapore-position-on-the-world-artificial-intelligence-cooperation-association/), [Estonian MFA Press Release](https://www.vm.ee/en/news/foreign-minister-tsahkna-pax-silica-agreement-opportunity-advance-technology-innovation-and), [Bangladesh MOFA announcement via UNB](https://unb.com.bd/category/Bangladesh/bangladesh-decides-to-join-shanghai-based-waico-as-observer-mofa/192071)).
4. **Reputable wire service or established publication** (e.g. Politico, Reuters, The Diplomat).
5. **Wikipedia** is used strictly for discovering potential newly reported developments, never as the final evidentiary source. Records with pending primary confirmation are transparently labeled as secondary sources.

---

## Author & Community Contributions

Improvements, corrections, and additions are warmly welcomed:
- Found a newly signed accession or missing leader endorsement? Open a [GitHub Issue](https://github.com/kocijan/geopoliticsai/issues) or submit a Pull Request.
- Citations must include primary government statements, treaty registry entries, or official diplomatic press releases.

---

## License

This project is licensed under the [MIT License](LICENSE).
