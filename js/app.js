/**
 * GeopoliticsAI.com - Main Application Controller (Condensed Layout)
 */

document.addEventListener('DOMContentLoaded', async () => {
  let mapInstance = null;
  let currentSort = { column: 'name', asc: true };

  // DOM Elements
  const mapViewport = document.getElementById('map-viewport');
  const layerWaico = document.getElementById('layer-waico');
  const layerPax = document.getElementById('layer-pax');
  const layerFrontier = document.getElementById('layer-frontier');
  const filterPreset = document.getElementById('filter-preset');
  const searchInput = document.getElementById('search-input');
  
  // Header / Controls
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  const themeIcon = document.getElementById('theme-icon');
  const proj2dBtn = document.getElementById('proj-2d-btn');
  const proj3dBtn = document.getElementById('proj-3d-btn');
  const autoRotateBtn = document.getElementById('auto-rotate-btn');
  const zoomInBtn = document.getElementById('zoom-in-btn');
  const zoomOutBtn = document.getElementById('zoom-out-btn');
  const resetViewBtn = document.getElementById('reset-view-btn');

  // Details Window
  const countryDetailsPanel = document.getElementById('country-details-panel');
  const detailsCloseBtn = document.getElementById('details-close-btn');

  // Modals
  const aboutModal = document.getElementById('about-modal');
  const aboutBtn = document.getElementById('about-btn');
  const aboutCloseBtn = document.getElementById('about-close-btn');

  const methodologyModal = document.getElementById('methodology-modal');
  const methodologyBtn = document.getElementById('methodology-btn');
  const methodologyCloseBtn = document.getElementById('methodology-close-btn');

  // Settings Modal
  const settingsModal = document.getElementById('settings-modal');
  const settingsBtn = document.getElementById('settings-btn');
  const settingsCloseBtn = document.getElementById('settings-close-btn');
  const settingsSaveBtn = document.getElementById('settings-save-btn');
  const settingOverlapSelect = document.getElementById('setting-overlap-style');
  const settingEuOverlapCheckbox = document.getElementById('setting-eu-overlap');

  function getSettings() {
    return {
      overlapStyle: localStorage.getItem('geopolitics_overlap_style') || 'stripes',
      includeEuInOverlap: localStorage.getItem('geopolitics_eu_overlap') === 'true'
    };
  }

  function initSettings() {
    const s = getSettings();
    const radio = document.querySelector(`input[name="setting-overlap-style"][value="${s.overlapStyle}"]`);
    if (radio) radio.checked = true;
    if (settingEuOverlapCheckbox) settingEuOverlapCheckbox.checked = s.includeEuInOverlap;
  }

  // Export Dropdown & Buttons
  const exportDropdown = document.getElementById('export-dropdown');
  const exportDropdownBtn = document.getElementById('export-dropdown-btn');
  const exportCsvBtn = document.getElementById('export-csv-btn');
  const exportJsonBtn = document.getElementById('export-json-btn');
  const exportXmlBtn = document.getElementById('export-xml-btn');

  // Table
  const tableBody = document.getElementById('table-body');
  const tableCountSpan = document.getElementById('table-count');

  // Orientation & Mobile Layout State Detection
  function updateOrientationState() {
    const isPortrait = window.matchMedia('(orientation: portrait)').matches;
    document.body.classList.toggle('is-mobile-layout', isPortrait);
    document.body.classList.toggle('is-desktop-layout', !isPortrait);
    if (mapInstance && typeof mapInstance.handleResize === 'function') {
      mapInstance.handleResize();
    }
  }

  const orientationMedia = window.matchMedia('(orientation: portrait)');
  if (typeof orientationMedia.addEventListener === 'function') {
    orientationMedia.addEventListener('change', updateOrientationState);
  } else if (typeof orientationMedia.addListener === 'function') {
    orientationMedia.addListener(updateOrientationState);
  }
  window.addEventListener('resize', () => {
    if (mapInstance && typeof mapInstance.handleResize === 'function') {
      mapInstance.handleResize();
    }
  });
  updateOrientationState();

  // 1. Initialize Theme (Light Mode Default)
  const savedTheme = localStorage.getItem('geopolitics_theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);

  themeToggleBtn.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('geopolitics_theme', next);
    updateThemeIcon(next);
    if (mapInstance) mapInstance.updateStyles();
  });

  function updateThemeIcon(theme) {
    if (theme === 'dark') {
      themeIcon.innerHTML = `
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="5"></circle>
          <line x1="12" y1="1" x2="12" y2="3"></line>
          <line x1="12" y1="21" x2="12" y2="23"></line>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
          <line x1="1" y1="12" x2="3" y2="12"></line>
          <line x1="21" y1="12" x2="23" y2="12"></line>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
        </svg>
      `;
      themeToggleBtn.setAttribute('title', 'Switch to Light Mode');
    } else {
      themeIcon.innerHTML = `
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
        </svg>
      `;
      themeToggleBtn.setAttribute('title', 'Switch to Dark Mode');
    }
  }

  // 2. Load Data & Initialize Map
  const mapLoader = document.getElementById('map-loader');

  try {
    await DataStore.init();

    // Show table and URL hash immediately before map finishes loading!
    updateCountsAndTable();
    checkUrlHash();

    // Load 110m (low-res) world map TopoJSON first for fast initial render
    let worldTopoJson;
    try {
      const worldResp = await fetch('https://cdn.jsdelivr.net/npm/visionscarto-world-atlas@0.1.0/world/110m.json');
      if (!worldResp.ok) throw new Error(`HTTP ${worldResp.status}`);
      worldTopoJson = await worldResp.json();
    } catch (cdnErr) {
      console.warn('[App] CDN 110m fetch failed, falling back to local data/world-110m.json:', cdnErr);
      try {
        const fallbackResp = await fetch('data/world-110m.json');
        if (!fallbackResp.ok) throw new Error(`110m fallback: ${fallbackResp.status}`);
        worldTopoJson = await fallbackResp.json();
      } catch (fallbackErr) {
        // Ultimate fallback: try 50m directly
        console.warn('[App] 110m not available, loading 50m directly:', fallbackErr);
        const resp50m = await fetch('https://cdn.jsdelivr.net/npm/visionscarto-world-atlas@0.1.0/world/50m.json');
        if (!resp50m.ok) {
          const local50m = await fetch('data/world-50m.json');
          if (!local50m.ok) throw new Error(`Failed to load any world map`);
          worldTopoJson = await local50m.json();
        } else {
          worldTopoJson = await resp50m.json();
        }
      }
    }

    // Initialize Map (Default: 2D Projection for best zooming)
    mapInstance = new GeopoliticsMap('map-viewport', {
      mode: '2d',
      onCountrySelect: (country) => {
        openCountryDetails(country);
        updateUrlHash(country.iso3);
      },
      onRotationChange: (isRotating) => {
        autoRotateBtn.classList.toggle('is-active', isRotating);
        autoRotateBtn.querySelector('span').textContent = isRotating ? 'Stop Spin' : 'Spin Globe';
      }
    });

    console.log('[App] Initializing mapInstance...');
    await mapInstance.init(worldTopoJson);
    mapInstance.setSettings(getSettings());
    console.log('[App] mapInstance.init completed. Paths in DOM:', document.querySelectorAll('.country-path').length);

    // Hide loading indicator smoothly
    if (mapLoader) {
      mapLoader.classList.add('is-hidden');
      setTimeout(() => {
        if (mapLoader.parentNode) mapLoader.remove();
      }, 350);
    }

    // Robust geometry and style sync once layout is calculated
    function ensureMapSized() {
      if (!mapInstance || !mapViewport) return;
      const w = mapViewport.clientWidth;
      const h = mapViewport.clientHeight;
      console.log('[App] ensureMapSized checking dims:', w, h);
      if (w > 100 && h > 100) {
        mapInstance.handleResize();
        mapInstance.updateStyles();
        console.log('[App] ensureMapSized done. Paths in DOM:', document.querySelectorAll('.country-path').length);
      } else {
        requestAnimationFrame(ensureMapSized);
      }
    }
    requestAnimationFrame(ensureMapSized);
    window.addEventListener('load', ensureMapSized);
    setTimeout(ensureMapSized, 100);
    setTimeout(ensureMapSized, 300);

    // Sync selected country if already chosen from table or hash
    const currentHash = window.location.hash;
    if (currentHash && currentHash.startsWith('#country=')) {
      const iso = currentHash.replace('#country=', '').toUpperCase();
      mapInstance.selectCountryByIso3(iso);
    }

    // Lazy-load 50m (high-res) TopoJSON in background for zoom-based upgrade
    (async () => {
      try {
        let hiRes;
        try {
          const resp = await fetch('https://cdn.jsdelivr.net/npm/visionscarto-world-atlas@0.1.0/world/50m.json');
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          hiRes = await resp.json();
        } catch (_) {
          const fallback = await fetch('data/world-50m.json');
          if (fallback.ok) hiRes = await fallback.json();
        }
        if (hiRes && mapInstance) {
          mapInstance.setHighResData(hiRes);
          console.log('[App] 50m high-res map loaded and available for zoom switching.');
        }
      } catch (err) {
        console.warn('[App] Failed to lazy-load 50m map, staying on 110m:', err);
      }
    })();

  } catch (err) {
    console.error('[App] Initialization error:', err);
    if (mapLoader) mapLoader.remove();
    mapViewport.innerHTML = `
      <div style="padding: 2rem; text-align: center; color: var(--color-waico);">
        <h3>Failed to initialize visualization</h3>
        <p>${err.message}</p>
      </div>
    `;
    return;
  }

  // 3. Layer Checkbox Events
  function getActiveLayers() {
    return {
      waico: layerWaico.checked,
      pax: layerPax.checked,
      frontier: layerFrontier.checked
    };
  }

  [layerWaico, layerPax, layerFrontier].forEach(el => {
    el.addEventListener('change', () => {
      mapInstance.activeLayers = getActiveLayers();
      mapInstance.updateStyles();
      updateCountsAndTable();
    });
  });

  // 4. (Pattern Mode removed)

  // 5. Segmented 2D Map / 3D Globe Projection Slider
  function updateProjectionUI(mode) {
    if (mode === 'globe') {
      proj3dBtn.classList.add('is-active');
      proj3dBtn.setAttribute('aria-checked', 'true');
      proj2dBtn.classList.remove('is-active');
      proj2dBtn.setAttribute('aria-checked', 'false');
      autoRotateBtn.style.display = 'inline-flex';
    } else {
      proj2dBtn.classList.add('is-active');
      proj2dBtn.setAttribute('aria-checked', 'true');
      proj3dBtn.classList.remove('is-active');
      proj3dBtn.setAttribute('aria-checked', 'false');
      autoRotateBtn.style.display = 'none';
    }
  }

  proj2dBtn.addEventListener('click', () => {
    mapInstance.setProjectionMode('2d');
    updateProjectionUI('2d');
  });

  proj3dBtn.addEventListener('click', () => {
    mapInstance.setProjectionMode('globe');
    updateProjectionUI('globe');
  });

  autoRotateBtn.addEventListener('click', () => {
    const isRotating = mapInstance.toggleAutoRotation();
    autoRotateBtn.classList.toggle('is-active', isRotating);
    autoRotateBtn.querySelector('span').textContent = isRotating ? 'Stop Spin' : 'Spin Globe';
  });

  // Floating On-Map Zoom Controls
  const floatingControls = document.querySelector('.map-floating-controls');
  if (floatingControls) {
    floatingControls.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
    floatingControls.addEventListener('touchmove', (e) => e.stopPropagation(), { passive: true });
    floatingControls.addEventListener('touchend', (e) => e.stopPropagation(), { passive: true });
    floatingControls.addEventListener('pointerdown', (e) => e.stopPropagation());
  }

  zoomInBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    mapInstance.zoomIn();
  });
  zoomOutBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    mapInstance.zoomOut();
  });
  resetViewBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    mapInstance.resetView();
  });

  // 6. Search and Preset Filter Events
  let searchDebounceTimer = null;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      renderTable();
    }, 120);
  });

  filterPreset.addEventListener('change', () => {
    renderTable();
  });

  // Quick shortcut: Ctrl+/ or Cmd+/ to search
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === '/') {
      e.preventDefault();
      searchInput.focus();
    }
  });

  // 7. Render Table & Counts
  function updateCountsAndTable() {
    updateSortHeaders();
    renderTable();
    renderLegend();
  }

  function renderTable() {
    const activeLayers = getActiveLayers();
    const categoryFilter = filterPreset.value;
    const query = searchInput.value.trim();

    const filtered = DataStore.filterCountries({
      activeLayers,
      categoryFilter,
      searchQuery: query,
      options: getSettings()
    });

    tableCountSpan.textContent = `(${filtered.length})`;

    // Sort
    filtered.sort((a, b) => {
      let valA = a[currentSort.column];
      let valB = b[currentSort.column];

      if (currentSort.column === 'waico') {
        valA = a.waico?.role_label || '';
        valB = b.waico?.role_label || '';
      } else if (currentSort.column === 'pax') {
        valA = a.pax_silica?.role_label || (a.ai_opportunity_statement?.signed ? 'AI Opportunity Statement' : '');
        valB = b.pax_silica?.role_label || (b.ai_opportunity_statement?.signed ? 'AI Opportunity Statement' : '');
      } else if (currentSort.column === 'frontier') {
        valA = a.frontier_call?.role_label || '';
        valB = b.frontier_call?.role_label || '';
      }

      if (typeof valA === 'string') {
        return currentSort.asc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return currentSort.asc ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
    });

    // Cell-colored table rendering
    tableBody.innerHTML = filtered.map(c => {
      // WAICO cell
      let waicoClass = 'cell-none';
      let waicoLabel = '—';
      if (c.waico) {
        const st = c.waico.status;
        if (st === 'invitee' || st === 'invited') {
          waicoClass = 'cell-status cell-waico-invitee';
          waicoLabel = c.waico.role_label || 'Invitee';
        } else if (st === 'observer') {
          waicoClass = 'cell-status cell-waico-observer';
          waicoLabel = 'Observer';
        } else {
          waicoClass = 'cell-status cell-waico-member';
          waicoLabel = c.waico.role_label || 'Member';
        }
      }

      // Pax cell
      let paxClass = 'cell-none';
      let paxLabel = '—';
      if (c.pax_silica) {
        const st = c.pax_silica.status;
        if (st === 'founding_signatory' || st === 'signatory') {
          paxClass = 'cell-status cell-pax-signatory';
          paxLabel = c.pax_silica.role_label || 'Signatory';
        } else if (st === 'eu_represented') {
          paxClass = 'cell-status cell-pax-eu';
          paxLabel = 'Via EU';
        } else if (st === 'observer') {
          paxClass = 'cell-status cell-pax-observer';
          paxLabel = c.pax_silica.role_label || 'Observer';
        } else if (st === 'participant') {
          paxClass = 'cell-status cell-pax-participant';
          paxLabel = 'Participant';
        } else if (st === 'opportunity_statement') {
          paxClass = 'cell-status cell-pax-opportunity';
          paxLabel = 'AI Opportunity';
        } else if (st === 'invited') {
          paxClass = 'cell-status cell-pax-invited';
          paxLabel = 'Invited';
        } else {
          paxClass = 'cell-status cell-pax-signatory';
          paxLabel = c.pax_silica.role_label || st;
        }
      } else if (c.ai_opportunity_statement?.signed) {
        paxClass = 'cell-status cell-pax-opportunity';
        paxLabel = 'AI Opportunity';
      }

      // Frontier cell
      let frontierClass = 'cell-none';
      let frontierLabel = '—';
      if (c.frontier_call) {
        frontierClass = 'cell-status cell-frontier-endorsed';
        frontierLabel = c.frontier_call.leader_title || 'Endorsed';
      }

      const isSelected = mapInstance && mapInstance.selectedIso3 === c.iso3;

      return `
        <tr data-iso="${c.iso3}" class="table-country-row ${isSelected ? 'is-selected' : ''}">
          <td>
            <div class="table-country-cell">
              <span class="country-flag">${c.flag_emoji || '🏳️'}</span>
              <span class="country-name-text">${c.name}</span>
            </div>
          </td>
          <td class="${waicoClass}"><span class="cell-status-label">${waicoLabel}</span></td>
          <td class="${paxClass}"><span class="cell-status-label">${paxLabel}</span></td>
          <td class="${frontierClass}"><span class="cell-status-label">${frontierLabel}</span></td>
          <td style="text-align: right;">
            <button class="btn btn-sm btn-details table-view-btn" data-iso="${c.iso3}" aria-label="View details for ${c.name}">Details</button>
          </td>
        </tr>
      `;
    }).join('');

    // Attach click handlers to row and details button
    tableBody.querySelectorAll('.table-country-row').forEach(row => {
      row.addEventListener('click', (e) => {
        const iso = row.getAttribute('data-iso');
        const country = DataStore.getCountryByIso3(iso);
        if (country) {
          if (mapInstance && typeof mapInstance.selectCountryByIso3 === 'function') {
            mapInstance.selectCountryByIso3(iso);
          }
          openCountryDetails(country);
          updateUrlHash(iso);
        }
      });
    });
  }

  // Dynamic Legend Generation (counts derived from data)
  function renderLegend() {
    const legendRow = document.getElementById('legend-items-row');
    if (!legendRow) return;

    const all = DataStore.countriesList;
    const activeLayers = getActiveLayers();
    const settings = getSettings();
    const isStripes = settings.overlapStyle === 'stripes';

    // Count statuses
    let waicoMembers = 0, waicoObservers = 0, waicoInvitees = 0;
    let paxSignatories = 0, paxEU = 0, paxObservers = 0, paxParticipants = 0, paxOpportunity = 0;
    let frontierEndorsers = 0;
    let tripartite = 0, paxFrontierOnly = 0, waicoFrontierOnly = 0, waicoPaxOnly = 0;
    let paxObsFrontier = 0, frontierOppOnly = 0;

    for (const c of all) {
      if (c.waico) {
        if (c.waico.status === 'founding_member' || c.waico.status === 'signatory') waicoMembers++;
        else if (c.waico.status === 'observer') waicoObservers++;
        else if (c.waico.status === 'invitee' || c.waico.status === 'invited') waicoInvitees++;
      }
      if (c.pax_silica) {
        if (c.pax_silica.status === 'founding_signatory' || c.pax_silica.status === 'signatory') paxSignatories++;
        else if (c.pax_silica.status === 'eu_represented') paxEU++;
        else if (c.pax_silica.status === 'observer') paxObservers++;
        else if (c.pax_silica.status === 'participant') paxParticipants++;
        else if (c.pax_silica.status === 'opportunity_statement') paxOpportunity++;
      }
      if (c.frontier_call && c.frontier_call.status === 'leader_endorsement') frontierEndorsers++;

      const alliance = DataStore.computeCountryAlliance(c, activeLayers, settings);
      if (alliance === 'tripartite') tripartite++;
      else if (alliance === 'pax_frontier') paxFrontierOnly++;
      else if (alliance === 'waico_frontier') waicoFrontierOnly++;
      else if (alliance === 'waico_pax') waicoPaxOnly++;
      else if (alliance === 'pax_observer_frontier') paxObsFrontier++;
      else if (alliance === 'frontier_opportunity') frontierOppOnly++;
    }

    const items = [];

    if (activeLayers.waico) {
      items.push(`
        <div class="legend-item" title="World Artificial Intelligence Cooperation Organization">
          <span class="legend-swatch swatch-waico"></span>
          <span class="legend-label-text">WAICO (${waicoMembers} members)</span>
        </div>
      `);

      if (waicoObservers > 0) {
        items.push(`
          <div class="legend-item" title="WAICO Observer States (e.g. Bangladesh)">
            <span class="legend-swatch swatch-waico-observer"></span>
            <span class="legend-label-text">WAICO Observer (${waicoObservers})</span>
          </div>
        `);
      }
    }

    if (activeLayers.pax) {
      items.push(`
        <div class="legend-item" title="Pax Silica Declaration formal direct signatories (24 sovereign countries + European Union)">
          <span class="legend-swatch swatch-pax"></span>
          <span class="legend-label-text">Pax Silica (${paxSignatories} formal signatories)</span>
        </div>
      `);

      if (paxEU > 0) {
        items.push(`
          <div class="legend-item" title="European Union member states represented via EU accession">
            <span class="legend-swatch swatch-pax-eu"></span>
            <span class="legend-label-text">via EU (${paxEU})</span>
          </div>
        `);
      }

      if (paxObservers > 0) {
        if (paxObsFrontier > 0 && activeLayers.frontier) {
          items.push(`
            <div class="legend-item" title="Pax Silica recognized observers with Frontier Control (Canada, Estonia)">
              <span class="legend-swatch ${isStripes ? 'swatch-pax-obs-frontier' : 'swatch-pax-observer'}"></span>
              <span class="legend-label-text">Pax Observer + Frontier (${paxObsFrontier})</span>
            </div>
          `);
        }
        const pureObservers = paxObservers - paxObsFrontier;
        if (pureObservers > 0) {
          items.push(`
            <div class="legend-item" title="Pax Silica recognized observers">
              <span class="legend-swatch swatch-pax-observer"></span>
              <span class="legend-label-text">Pax Observer (${pureObservers})</span>
            </div>
          `);
        }
      }

      const pureOppCount = all.filter(c => DataStore.computeCountryAlliance(c, activeLayers, settings) === 'opportunity_statement').length;
      if (pureOppCount > 0) {
        items.push(`
          <div class="legend-item" title="Signatories of the Joint Statement on AI Opportunity (Portugal, Paraguay)">
            <span class="legend-swatch swatch-opportunity"></span>
            <span class="legend-label-text">AI Opportunity Statement (${pureOppCount})</span>
          </div>
        `);
      }
    }

    if (activeLayers.frontier) {
      items.push(`
        <div class="legend-item" title="Call for Control of Frontier AI Models declaration">
          <span class="legend-swatch swatch-frontier"></span>
          <span class="legend-label-text">Frontier Control (${frontierEndorsers} countries + EU)</span>
        </div>
      `);

      if (frontierOppOnly > 0 && activeLayers.pax) {
        items.push(`
          <div class="legend-item" title="Frontier Control endorsers who signed the AI Opportunity Statement (Türkiye, Bahrain)">
            <span class="legend-swatch ${isStripes ? 'swatch-split-frontier-opportunity' : 'swatch-opportunity'}"></span>
            <span class="legend-label-text">Frontier + AI Opportunity (${frontierOppOnly})</span>
          </div>
        `);
      }
    }

    // Overlaps
    if (tripartite > 0 && activeLayers.waico && activeLayers.pax && activeLayers.frontier) {
      const swatchClass = isStripes ? 'swatch-split-tripartite' : 'swatch-blended-tripartite';
      items.push(`
        <div class="legend-item" title="Aligned across WAICO, Pax Silica, and Frontier Control (Kazakhstan)">
          <span class="legend-swatch ${swatchClass}"></span>
          <span class="legend-label-text">All three (${tripartite})</span>
        </div>
      `);
    }

    if (paxFrontierOnly > 0 && activeLayers.pax && activeLayers.frontier) {
      const swatchClass = isStripes ? 'swatch-split-pax-frontier' : 'swatch-blended-pax-frontier';
      items.push(`
        <div class="legend-item" title="Aligned with Pax Silica and Frontier Control only">
          <span class="legend-swatch ${swatchClass}"></span>
          <span class="legend-label-text">Pax + Frontier only (${paxFrontierOnly})</span>
        </div>
      `);
    }

    if (waicoFrontierOnly > 0 && activeLayers.waico && activeLayers.frontier) {
      const swatchClass = isStripes ? 'swatch-split-waico-frontier' : 'swatch-blended-waico-frontier';
      items.push(`
        <div class="legend-item" title="Aligned with WAICO and Frontier Control only">
          <span class="legend-swatch ${swatchClass}"></span>
          <span class="legend-label-text">WAICO + Frontier only (${waicoFrontierOnly})</span>
        </div>
      `);
    }

    if (waicoPaxOnly > 0 && activeLayers.waico && activeLayers.pax) {
      const swatchClass = isStripes ? 'swatch-split-waico-pax' : 'swatch-blended-waico-pax';
      items.push(`
        <div class="legend-item" title="Aligned with WAICO and Pax Silica only">
          <span class="legend-swatch ${swatchClass}"></span>
          <span class="legend-label-text">WAICO + Pax only (${waicoPaxOnly})</span>
        </div>
      `);
    }

    legendRow.innerHTML = items.join('');
  }

  // Column Sorting
  function updateSortHeaders() {
    document.querySelectorAll('.countries-table th[data-sort]').forEach(th => {
      const col = th.getAttribute('data-sort');
      const icon = th.querySelector('.sort-icon');
      if (currentSort.column === col) {
        th.classList.add('is-sorted');
        if (icon) icon.textContent = currentSort.asc ? '▲' : '▼';
      } else {
        th.classList.remove('is-sorted');
        if (icon) icon.textContent = '';
      }
    });
  }

  document.querySelectorAll('.countries-table th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.getAttribute('data-sort');
      if (currentSort.column === col) {
        currentSort.asc = !currentSort.asc;
      } else {
        currentSort.column = col;
        currentSort.asc = true;
      }
      updateCountsAndTable();
    });
  });

  // 8. Country Details Inline Window Logic
  function openCountryDetails(country) {
    if (!country) return;

    document.getElementById('details-name').textContent = country.name;
    document.getElementById('details-iso').textContent = country.iso3;
    document.getElementById('details-region').textContent = country.region || 'Global';
    const flagEl = document.getElementById('details-flag');
    if (flagEl) flagEl.textContent = country.flag_emoji || '🏳️';

    // EU Status Banner
    const euContainer = document.getElementById('details-eu-status');
    if (country.is_eu_member) {
      const direct = country.pax_silica?.is_direct;
      euContainer.innerHTML = `
        <div style="padding: 0.55rem 0.75rem; background: var(--bg-hover); border: 1px solid var(--border-strong); border-radius: var(--radius-md); font-size: 0.78rem; margin-bottom: 0.65rem;">
          <strong>🇪🇺 European Union Member State</strong><br/>
          ${direct 
            ? 'Signed Pax Silica directly in national capacity.' 
            : 'Covered under European Union Pax Silica accession signed on 23 June 2026. Colored as Pax Silica on the map.'}
        </div>
      `;
      euContainer.style.display = 'block';
    } else {
      euContainer.style.display = 'none';
    }

    // WAICO Card
    const waicoCard = document.getElementById('details-card-waico');
    if (country.waico) {
      waicoCard.style.display = 'block';
      document.getElementById('details-waico-status').textContent = country.waico.role_label;
      document.getElementById('details-waico-date').textContent = country.waico.date || 'July 2026';
      document.getElementById('details-waico-signatory').textContent = country.waico.signatory_title || 'Government Delegation';
      document.getElementById('details-waico-notes').textContent = country.waico.notes || '';
      document.getElementById('details-waico-source').href = country.waico.source_url || 'https://en.wikipedia.org/wiki/World_Artificial_Intelligence_Cooperation_Organization';
    } else {
      waicoCard.style.display = 'none';
    }

    // Pax Silica Card
    const paxCard = document.getElementById('details-card-pax');
    const isPaxOppOnly = country.pax_silica?.status === 'opportunity_statement';
    if (country.pax_silica && !isPaxOppOnly) {
      paxCard.style.display = 'block';
      let paxLabel = country.pax_silica.role_label || 'Signatory';
      if (country.is_eu_member && (country.pax_silica.status === 'eu_represented' || !country.pax_silica.is_direct) && !paxLabel.toLowerCase().includes('via eu')) {
        paxLabel += ' (via EU)';
      }
      paxLabel = paxLabel.replace(/(\s*\(via EU\))+/gi, ' (via EU)');
      document.getElementById('details-pax-status').textContent = paxLabel;
      document.getElementById('details-pax-date').textContent = country.pax_silica.date || 'December 2025';
      document.getElementById('details-pax-signatory').textContent = country.pax_silica.signatory_title || (country.pax_silica.is_direct ? 'National Representative' : 'European Commission');
      document.getElementById('details-pax-notes').textContent = country.pax_silica.notes || '';

      const singleSource = document.getElementById('details-pax-source');
      const multiSources = document.getElementById('details-pax-sources');
      if (country.pax_silica.sources && country.pax_silica.sources.length > 0) {
        if (singleSource) singleSource.style.display = 'none';
        if (multiSources) {
          multiSources.style.display = 'flex';
          multiSources.innerHTML = country.pax_silica.sources.map(s => `
            <a href="${s.url}" target="_blank" rel="noopener noreferrer" class="initiative-source-item" title="${s.title}">
              <span>${s.title}</span>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
            </a>
          `).join('');
        }
      } else {
        if (multiSources) multiSources.style.display = 'none';
        if (singleSource) {
          singleSource.style.display = 'inline-flex';
          singleSource.href = country.pax_silica.source_url || 'https://www.state.gov/releases/office-of-the-spokesperson/2026/06/outcomes-of-the-second-pax-silica-summit';
        }
      }
    } else {
      paxCard.style.display = 'none';
    }

    // Frontier Control Card
    const frontierCard = document.getElementById('details-card-frontier');
    if (country.frontier_call) {
      frontierCard.style.display = 'block';
      document.getElementById('details-frontier-status').textContent = country.frontier_call.role_label;
      document.getElementById('details-frontier-date').textContent = country.frontier_call.date || '21 September 2026';
      const endorserEl = document.getElementById('details-frontier-endorser') || document.getElementById('details-frontier-leader');
      if (endorserEl) {
        endorserEl.textContent = country.frontier_call.endorsed_by || 'Head of State/Government';
      }
      document.getElementById('details-frontier-notes').textContent = country.frontier_call.notes || '';
      document.getElementById('details-frontier-source').href = country.frontier_call.source_url || 'https://www.presidentti.fi/en/a-call-for-control-of-frontier-ai-models/';
    } else {
      frontierCard.style.display = 'none';
    }

    // AI Opportunity Statement Card
    const oppCard = document.getElementById('details-card-opportunity');
    const isPaxSignatoryOrObserver = country.pax_silica && (
      country.pax_silica.status === 'founding_signatory' ||
      country.pax_silica.status === 'signatory' ||
      country.pax_silica.status === 'eu_represented' ||
      country.pax_silica.status === 'observer'
    );
    const hasOpp = Boolean(country.ai_opportunity_statement?.signed || isPaxOppOnly);
    if (oppCard) {
      if (hasOpp) {
        oppCard.style.display = 'block';
        if (isPaxSignatoryOrObserver) {
          oppCard.classList.add('card-opportunity-pax-signatory');
        } else {
          oppCard.classList.remove('card-opportunity-pax-signatory');
        }
        const oppDate = country.ai_opportunity_statement?.date || country.pax_silica?.date || '26 June 2026';
        const oppNotes = isPaxOppOnly
          ? (country.pax_silica.notes || 'Signed Joint Statement on AI Opportunity at the Second Pax Silica Summit; not confirmed as a Pax Silica Declaration signatory.')
          : 'Signed Joint Statement on AI Opportunity at the Second Pax Silica Summit in Washington.';
        const oppSource = country.ai_opportunity_statement?.source_url || country.pax_silica?.source_url || 'https://www.state.gov/releases/office-of-the-spokesperson/2026/06/outcomes-of-the-second-pax-silica-summit';
        document.getElementById('details-opportunity-date').textContent = oppDate;
        document.getElementById('details-opportunity-notes').textContent = oppNotes;
        document.getElementById('details-opportunity-source').href = oppSource;
      } else {
        oppCard.style.display = 'none';
        oppCard.classList.remove('card-opportunity-pax-signatory');
      }
    }

    // Unaligned Notice
    const unalignedNotice = document.getElementById('details-unaligned-notice');
    if (!country.waico && (!country.pax_silica || isPaxOppOnly) && !country.frontier_call && !hasOpp) {
      unalignedNotice.style.display = 'block';
    } else {
      unalignedNotice.style.display = 'none';
    }

    // Copy permalink button
    const permalinkBtn = document.getElementById('copy-permalink-btn');
    permalinkBtn.onclick = (e) => {
      e.stopPropagation();
      const url = `${window.location.origin}${window.location.pathname}#country=${country.iso3}`;
      navigator.clipboard.writeText(url).then(() => {
        const textSpan = document.getElementById('copy-btn-text');
        if (textSpan) textSpan.textContent = 'Copied!';
        setTimeout(() => { if (textSpan) textSpan.textContent = 'Share'; }, 2000);
      });
    };

    // Open inline panel
    countryDetailsPanel.style.display = 'flex';
    countryDetailsPanel.classList.add('is-open');

    // Highlight row in table
    let selectedRowEl = null;
    document.querySelectorAll('.table-country-row').forEach(r => {
      const match = r.getAttribute('data-iso') === country.iso3;
      r.classList.toggle('is-selected', match);
      if (match) selectedRowEl = r;
    });

    // Center-jump-scroll selected table row so it isn't underneath the details box element
    const tableContainer = document.getElementById('table-container');
    if (selectedRowEl && tableContainer) {
      requestAnimationFrame(() => {
        const containerRect = tableContainer.getBoundingClientRect();
        const rowRect = selectedRowEl.getBoundingClientRect();
        const currentScroll = tableContainer.scrollTop;
        const rowOffsetInContainer = (rowRect.top - containerRect.top) + currentScroll;
        const targetScrollTop = rowOffsetInContainer - (tableContainer.clientHeight / 2) + (rowRect.height / 2);
        tableContainer.scrollTo({
          top: Math.max(0, targetScrollTop),
          behavior: 'smooth'
        });
      });
    }
  }

  function closeCountryDetails() {
    countryDetailsPanel.style.display = 'none';
    countryDetailsPanel.classList.remove('is-open');
    document.querySelectorAll('.table-country-row').forEach(r => r.classList.remove('is-selected'));
    if (mapInstance) {
      mapInstance.selectedIso3 = null;
      mapInstance.updateStyles();
    }
    if (window.location.hash.includes('country=')) {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }

  detailsCloseBtn.addEventListener('click', closeCountryDetails);

  // 9. Modals (About & Methodology)
  aboutBtn.addEventListener('click', () => aboutModal.showModal());
  aboutCloseBtn.addEventListener('click', () => aboutModal.close());

  methodologyBtn.addEventListener('click', () => methodologyModal.showModal());
  methodologyCloseBtn.addEventListener('click', () => methodologyModal.close());

  if (settingsBtn && settingsModal) {
    settingsBtn.addEventListener('click', () => {
      initSettings();
      settingsModal.showModal();
    });
  }
  if (settingsCloseBtn && settingsModal) {
    settingsCloseBtn.addEventListener('click', () => settingsModal.close());
  }
  if (settingsSaveBtn && settingsModal) {
    settingsSaveBtn.addEventListener('click', () => {
      const selectedRadio = document.querySelector('input[name="setting-overlap-style"]:checked');
      const overlapStyle = selectedRadio ? selectedRadio.value : 'stripes';
      const includeEu = settingEuOverlapCheckbox ? settingEuOverlapCheckbox.checked : false;
      localStorage.setItem('geopolitics_overlap_style', overlapStyle);
      localStorage.setItem('geopolitics_eu_overlap', includeEu ? 'true' : 'false');

      const newSettings = { overlapStyle, includeEuInOverlap: includeEu };
      if (mapInstance && typeof mapInstance.setSettings === 'function') {
        mapInstance.setSettings(newSettings);
      }
      renderLegend();
      updateCountsAndTable();
      settingsModal.close();
    });
  }

  [aboutModal, methodologyModal, settingsModal].filter(Boolean).forEach(m => {
    m.addEventListener('click', (e) => {
      const rect = m.getBoundingClientRect();
      const inDialog = (
        rect.top <= e.clientY && e.clientY <= rect.top + rect.height &&
        rect.left <= e.clientX && e.clientX <= rect.left + rect.width
      );
      if (!inDialog) m.close();
    });
  });

  // 10. Data Exports & Dropdown
  if (exportDropdownBtn && exportDropdown) {
    exportDropdownBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = exportDropdown.classList.toggle('is-open');
      exportDropdownBtn.setAttribute('aria-expanded', String(isOpen));
    });

    document.addEventListener('click', (e) => {
      if (!exportDropdown.contains(e.target)) {
        exportDropdown.classList.remove('is-open');
        exportDropdownBtn.setAttribute('aria-expanded', 'false');
      }
    });
  }

  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', () => {
      DataStore.exportToCSV();
      if (exportDropdown) {
        exportDropdown.classList.remove('is-open');
        if (exportDropdownBtn) exportDropdownBtn.setAttribute('aria-expanded', 'false');
      }
    });
  }

  if (exportJsonBtn) {
    exportJsonBtn.addEventListener('click', () => {
      DataStore.exportToJSON();
      if (exportDropdown) {
        exportDropdown.classList.remove('is-open');
        if (exportDropdownBtn) exportDropdownBtn.setAttribute('aria-expanded', 'false');
      }
    });
  }

  if (exportXmlBtn) {
    exportXmlBtn.addEventListener('click', () => {
      DataStore.exportToXML();
      if (exportDropdown) {
        exportDropdown.classList.remove('is-open');
        if (exportDropdownBtn) exportDropdownBtn.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // 11. URL Hash Support
  function updateUrlHash(iso3) {
    if (iso3) {
      history.replaceState(null, '', `#country=${iso3}`);
    }
  }

  function checkUrlHash() {
    const hash = window.location.hash;
    if (hash && hash.startsWith('#country=')) {
      const iso = hash.replace('#country=', '').toUpperCase();
      const country = DataStore.getCountryByIso3(iso);
      if (country) {
        if (mapInstance && typeof mapInstance.selectCountryByIso3 === 'function') {
          mapInstance.selectCountryByIso3(iso);
        }
        openCountryDetails(country);
      }
    }
  }

  window.addEventListener('hashchange', checkUrlHash);

  // Keyboard Shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (exportDropdown) {
        exportDropdown.classList.remove('is-open');
        if (exportDropdownBtn) exportDropdownBtn.setAttribute('aria-expanded', 'false');
      }
      if (countryDetailsPanel.classList.contains('is-open')) closeCountryDetails();
      if (aboutModal.open) aboutModal.close();
      if (methodologyModal.open) methodologyModal.close();
      if (settingsModal && settingsModal.open) settingsModal.close();
    }
  });
});
