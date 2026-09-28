#!/usr/bin/env node
/**
 * scripts/generate_map_svg.js
 * Pre-renders the 2D world map SVG at build time using the project's own
 * vendor.min.js (D3 + TopoJSON), data.js, and map.js logic.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT_DIR = path.resolve(__dirname, '..');

function roundCoordinates(d) {
  if (!d) return '';
  return d.replace(/(\d+\.\d{2,})/g, m => Number(m).toFixed(1).replace(/\.0$/, ''));
}

function generateSvg() {
  const vendorCode = fs.readFileSync(path.join(ROOT_DIR, 'js', 'vendor.min.js'), 'utf8');
  const dataCode = fs.readFileSync(path.join(ROOT_DIR, 'js', 'data.js'), 'utf8');
  const mapCode = fs.readFileSync(path.join(ROOT_DIR, 'js', 'map.js'), 'utf8');

  const sandbox = {
    console,
    document: {
      documentElement: { getAttribute: () => 'light' },
      getElementById: () => null
    },
    localStorage: { getItem: () => null },
    window: {}
  };
  sandbox.window = sandbox;
  sandbox.global = sandbox;
  sandbox.self = sandbox;
  vm.createContext(sandbox);

  vm.runInContext(vendorCode, sandbox);
  vm.runInContext(dataCode + '\nglobalThis.DataStore = DataStore;', sandbox);
  vm.runInContext(mapCode + '\nglobalThis.GeopoliticsMap = GeopoliticsMap;', sandbox);

  const { d3, topojson, DataStore, GeopoliticsMap } = sandbox;

  // Load and merge country and frontier call data
  const countriesData = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'data', 'countries.json'), 'utf8'));
  const frontierPath = path.join(ROOT_DIR, 'data', 'frontier_call.json');
  if (fs.existsSync(frontierPath)) {
    const frontierData = JSON.parse(fs.readFileSync(frontierPath, 'utf8'));
    for (const s of frontierData.signatories || []) {
      if (s.iso3 && countriesData.countries[s.iso3]) {
        const c = countriesData.countries[s.iso3];
        if (!c.frontier_call) {
          c.frontier_call = {
            status: 'leader_endorsement',
            role_label: `Endorsed by ${s.leader_title || 'Leader'}`,
            leader_title: s.leader_title,
            leader_name: s.leader_name,
            date: s.date,
            endorsed_by: `${s.leader_name} (${s.leader_title})`,
            is_co_initiator: Boolean(s.is_co_initiator),
            notes: s.notes || '',
            source_url: 'https://www.presidentti.fi/en/a-call-for-control-of-frontier-ai-models/'
          };
          if (c.alignment_category === 'none') {
            c.alignment_category = 'frontier_only';
          }
          c.active_initiatives_count = (c.active_initiatives_count || 0) + 1;
        }
      }
    }
  }

  // Initialize DataStore
  DataStore.raw = countriesData;
  DataStore.meta = countriesData.meta;
  DataStore.countries = countriesData.countries;
  DataStore.organizations = countriesData.organizations;
  DataStore.countriesList = Object.values(countriesData.countries);
  DataStore.countriesByIso3.clear();
  DataStore.countriesByNumeric.clear();
  DataStore.countriesByName.clear();

  for (const c of DataStore.countriesList) {
    if (!c.flag_emoji || c.flag_emoji === '🏳️') {
      if (c.iso2 && c.iso2.length === 2) {
        try {
          c.flag_emoji = String.fromCodePoint(...[...c.iso2.toUpperCase()].map(char => 127397 + char.charCodeAt(0)));
        } catch (_) {
          c.flag_emoji = '🏳️';
        }
      }
    }
    DataStore.countriesByIso3.set(c.iso3, c);
    if (c.numeric) DataStore.countriesByNumeric.set(String(c.numeric).padStart(3, '0'), c);
    DataStore.countriesByName.set(c.name.toLowerCase(), c);
  }

  // Setup Map Instance & TopoJSON Features
  const map = new GeopoliticsMap('map-viewport');
  const topo = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'data', 'world-110m.json'), 'utf8'));
  map.worldData = topo;
  map.countryFeatures = topojson.feature(topo, topo.objects.countries).features;
  map.injectCityStates(1);

  const width = 750;
  const height = 690;
  const scale = Math.min(width, height) * 0.21; // 144.9
  const projection = d3.geoNaturalEarth1().scale(scale).translate([width / 2, height / 2]);
  const pathGen = d3.geoPath().projection(projection);

  // Graticule
  const graticule = d3.geoGraticule10();
  const graticuleD = roundCoordinates(pathGen(graticule));

  // Pattern defs
  const defsHtml = `  <defs>
    <pattern id="pattern-split-pax-frontier" class="map-pattern-rotated" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="6" height="12" fill="#2563eb" />
      <rect x="6" width="6" height="12" fill="#d97706" />
    </pattern>
    <pattern id="pattern-split-waico-frontier" class="map-pattern-rotated" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="6" height="12" fill="#dc2626" />
      <rect x="6" width="6" height="12" fill="#d97706" />
    </pattern>
    <pattern id="pattern-split-waico-pax" class="map-pattern-rotated" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="6" height="12" fill="#dc2626" />
      <rect x="6" width="6" height="12" fill="#2563eb" />
    </pattern>
    <pattern id="pattern-split-tripartite" class="map-pattern-rotated" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="4" height="12" fill="#dc2626" />
      <rect x="4" width="4" height="12" fill="#2563eb" />
      <rect x="8" width="4" height="12" fill="#d97706" />
    </pattern>
    <pattern id="pattern-split-pax-obs-frontier" class="map-pattern-rotated" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="6" height="12" fill="#60a5fa" />
      <rect x="6" width="6" height="12" fill="#d97706" />
    </pattern>
    <pattern id="pattern-split-frontier-opportunity" class="map-pattern-rotated" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="6" height="12" fill="#d97706" />
      <rect x="6" width="6" height="12" fill="#0891b2" />
    </pattern>
    <pattern id="pattern-split-pax-frontier-dark" class="map-pattern-rotated" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="6" height="12" fill="#3b82f6" />
      <rect x="6" width="6" height="12" fill="#f59e0b" />
    </pattern>
    <pattern id="pattern-split-waico-frontier-dark" class="map-pattern-rotated" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="6" height="12" fill="#ef4444" />
      <rect x="6" width="6" height="12" fill="#f59e0b" />
    </pattern>
    <pattern id="pattern-split-waico-pax-dark" class="map-pattern-rotated" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="6" height="12" fill="#ef4444" />
      <rect x="6" width="6" height="12" fill="#3b82f6" />
    </pattern>
    <pattern id="pattern-split-tripartite-dark" class="map-pattern-rotated" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="4" height="12" fill="#ef4444" />
      <rect x="4" width="4" height="12" fill="#3b82f6" />
      <rect x="8" width="4" height="12" fill="#f59e0b" />
    </pattern>
    <pattern id="pattern-split-pax-obs-frontier-dark" class="map-pattern-rotated" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="6" height="12" fill="#93c5fd" />
      <rect x="6" width="6" height="12" fill="#f59e0b" />
    </pattern>
    <pattern id="pattern-split-frontier-opportunity-dark" class="map-pattern-rotated" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="6" height="12" fill="#f59e0b" />
      <rect x="6" width="6" height="12" fill="#06b6d4" />
    </pattern>
    <pattern id="pattern-pax-eu" class="map-pattern-fixed" width="8" height="8" patternUnits="userSpaceOnUse">
      <rect width="8" height="8" fill="#cbd5e1" />
      <circle cx="4" cy="4" r="1.8" fill="#2563eb" />
    </pattern>
    <pattern id="pattern-pax-eu-dark" class="map-pattern-fixed" width="8" height="8" patternUnits="userSpaceOnUse">
      <rect width="8" height="8" fill="#1e293b" />
      <circle cx="4" cy="4" r="1.8" fill="#60a5fa" />
    </pattern>
    <pattern id="pattern-pax-eu-frontier" class="map-pattern-fixed" width="8" height="8" patternUnits="userSpaceOnUse">
      <rect width="8" height="8" fill="#d97706" />
      <circle cx="4" cy="4" r="1.8" fill="#1e40af" />
    </pattern>
    <pattern id="pattern-pax-eu-frontier-dark" class="map-pattern-fixed" width="8" height="8" patternUnits="userSpaceOnUse">
      <rect width="8" height="8" fill="#f59e0b" />
      <circle cx="4" cy="4" r="1.8" fill="#1e3a8a" />
    </pattern>
    <pattern id="pattern-waico-observer" class="map-pattern-rotated" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="8" height="8" fill="#fee2e2" />
      <line x1="0" y1="0" x2="0" y2="8" stroke="#ef4444" stroke-width="2.5" />
    </pattern>
    <pattern id="pattern-waico-observer-dark" class="map-pattern-rotated" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="8" height="8" fill="#450a0a" />
      <line x1="0" y1="0" x2="0" y2="8" stroke="#f87171" stroke-width="2.5" />
    </pattern>
    <pattern id="pattern-pax-observer" class="map-pattern-fixed" width="8" height="8" patternUnits="userSpaceOnUse">
      <rect width="8" height="8" fill="#eff6ff" />
      <circle cx="4" cy="4" r="2.2" fill="#2563eb" />
    </pattern>
    <pattern id="pattern-pax-observer-dark" class="map-pattern-fixed" width="8" height="8" patternUnits="userSpaceOnUse">
      <rect width="8" height="8" fill="#1e293b" />
      <circle cx="4" cy="4" r="2.2" fill="#60a5fa" />
    </pattern>
    <pattern id="pattern-pax-participant" class="map-pattern-fixed" width="6" height="6" patternUnits="userSpaceOnUse">
      <rect width="6" height="6" fill="#f8fafc" />
      <circle cx="3" cy="3" r="1.5" fill="#3b82f6" />
    </pattern>
    <pattern id="pattern-pax-participant-dark" class="map-pattern-fixed" width="6" height="6" patternUnits="userSpaceOnUse">
      <rect width="6" height="6" fill="#0f172a" />
      <circle cx="3" cy="3" r="1.5" fill="#93c5fd" />
    </pattern>
  </defs>`;

  const baseFeatures = map.countryFeatures.filter(f => !f.isCityState);
  const cityStateFeatures = map.countryFeatures.filter(f => f.isCityState);

  const escapeAttr = str => String(str || '').replace(/"/g, '&quot;');

  // Base Country Paths
  let basePathsHtml = '';
  for (const f of baseFeatures) {
    const country = map.resolveCountry(f);
    const alliance = country ? DataStore.computeCountryAlliance(country, map.activeLayers, map.settings) : 'none';
    const fill = map.getCountryFill(f);
    const ariaLabel = escapeAttr(country ? `${country.name} (${country.iso3})` : (f.properties?.name || 'Territory'));
    const iso = country ? country.iso3 : '';
    const id = f.id !== undefined && f.id !== null ? String(f.id).padStart(3, '0') : '';
    const d = roundCoordinates(pathGen(f));
    basePathsHtml += `        <path class="country-path" data-iso="${iso}" data-id="${id}" data-alliance="${alliance}" tabindex="0" role="button" aria-label="${ariaLabel}" style="fill: ${fill};" d="${d}"></path>\n`;
  }

  // City States Paths
  let cityStatesPathsHtml = '';
  for (const f of cityStateFeatures) {
    const country = map.resolveCountry(f);
    const alliance = country ? DataStore.computeCountryAlliance(country, map.activeLayers, map.settings) : 'none';
    const fill = map.getCountryFill(f);
    const ariaLabel = escapeAttr(country ? `${country.name} (${country.iso3})` : (f.properties?.name || 'Territory'));
    const iso = country ? country.iso3 : '';
    const id = f.id !== undefined && f.id !== null ? String(f.id).padStart(3, '0') : '';
    const d = roundCoordinates(pathGen(f));
    cityStatesPathsHtml += `        <path class="country-path is-city-state" data-iso="${iso}" data-id="${id}" data-alliance="${alliance}" tabindex="0" role="button" aria-label="${ariaLabel}" style="fill: ${fill};" d="${d}"></path>\n`;
  }

  // City States Hitboxes
  let hitboxesHtml = '';
  for (const f of cityStateFeatures) {
    const d = roundCoordinates(pathGen(f));
    hitboxesHtml += `        <path class="country-hitbox" vector-effect="non-scaling-stroke" style="stroke-width: 5px;" aria-hidden="true" d="${d}"></path>\n`;
  }

  const svgHtml = `<svg class="map-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" aria-label="Interactive geopolitical map of AI alignments">
${defsHtml}
  <g class="map-root-group">
    <path class="graticule-layer graticule-path" d="${graticuleD}"></path>
    <g class="base-countries-layer">
${basePathsHtml}    </g>
    <g class="city-states-layer">
${cityStatesPathsHtml}${hitboxesHtml}    </g>
  </g>
</svg>`;

  return svgHtml;
}

if (require.main === module) {
  const svg = generateSvg();
  const outPath = process.argv[2];
  if (outPath) {
    fs.writeFileSync(outPath, svg, 'utf8');
    console.log(`✓ Map SVG written to ${outPath} (${(svg.length / 1024).toFixed(1)} KB)`);
  } else {
    process.stdout.write(svg);
  }
}

module.exports = { generateSvg };
