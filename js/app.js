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
  const textureToggleBtn = document.getElementById('texture-toggle-btn');
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

  // Export Buttons
  const exportCsvBtn = document.getElementById('export-csv-btn');
  const exportJsonBtn = document.getElementById('export-json-btn');
  const exportXmlBtn = document.getElementById('export-xml-btn');

  // Table
  const tableBody = document.getElementById('table-body');
  const tableCountSpan = document.getElementById('table-count');

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
  try {
    await DataStore.init();

    const worldResp = await fetch('data/world-110m.json');
    if (!worldResp.ok) throw new Error(`Failed to load world map: ${worldResp.status}`);
    const worldTopoJson = await worldResp.json();

    // Initialize Map (Default: 2D Projection for best zooming)
    mapInstance = new GeopoliticsMap('map-viewport', {
      mode: '2d',
      onCountrySelect: (country) => {
        openCountryDetails(country);
        updateUrlHash(country.iso3);
      }
    });

    console.log('[App] Initializing mapInstance...');
    await mapInstance.init(worldTopoJson);
    console.log('[App] mapInstance.init completed. Paths in DOM:', document.querySelectorAll('.country-path').length);

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

    // Initial render of table and url hash
    updateCountsAndTable();
    checkUrlHash();

  } catch (err) {
    console.error('[App] Initialization error:', err);
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

  // 4. Pattern Mode Toggle
  textureToggleBtn.addEventListener('click', () => {
    mapInstance.textureMode = !mapInstance.textureMode;
    document.body.classList.toggle('texture-mode-active', mapInstance.textureMode);
    mapInstance.updateStyles();
  });

  // Alt+A Shortcut for Patterns
  document.addEventListener('keydown', (e) => {
    if (e.altKey && (e.key === 'a' || e.key === 'A')) {
      e.preventDefault();
      textureToggleBtn.click();
    }
  });

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
  zoomInBtn.addEventListener('click', () => mapInstance.zoomIn());
  zoomOutBtn.addEventListener('click', () => mapInstance.zoomOut());
  resetViewBtn.addEventListener('click', () => mapInstance.resetView());

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
    renderTable();
  }

  function renderTable() {
    const activeLayers = getActiveLayers();
    const categoryFilter = filterPreset.value;
    const query = searchInput.value.trim();

    const filtered = DataStore.filterCountries({
      activeLayers,
      categoryFilter,
      searchQuery: query
    });

    tableCountSpan.textContent = `(${filtered.length} countries)`;

    // Sort
    filtered.sort((a, b) => {
      let valA = a[currentSort.column];
      let valB = b[currentSort.column];

      if (currentSort.column === 'waico') {
        valA = a.waico?.role_label || '';
        valB = b.waico?.role_label || '';
      } else if (currentSort.column === 'pax') {
        valA = a.pax_silica?.role_label || '';
        valB = b.pax_silica?.role_label || '';
      } else if (currentSort.column === 'frontier') {
        valA = a.frontier_call?.role_label || '';
        valB = b.frontier_call?.role_label || '';
      }

      if (typeof valA === 'string') {
        return currentSort.asc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return currentSort.asc ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
    });

    // Render Table Rows (no 3-letter ISO in Country column, compact badges)
    tableBody.innerHTML = filtered.map(c => {
      let waicoBadge = '<span class="status-tag inactive">None</span>';
      if (c.waico) {
        waicoBadge = `<span class="table-badge" style="background:var(--color-waico-bg); color:var(--color-waico); border:1px solid var(--color-waico-border);">
          <span class="symbology-badge symbol-waico">◆</span> ${c.waico.role_label}
        </span>`;
      }

      let paxBadge = '<span class="status-tag inactive">None</span>';
      if (c.pax_silica) {
        let paxLabel = c.pax_silica.role_label || 'Signatory';
        if (!c.pax_silica.is_direct && !paxLabel.includes('(via EU)')) {
          paxLabel += ' (via EU)';
        }
        const style = c.pax_silica.is_direct
          ? 'background:var(--color-pax-bg); color:var(--color-pax); border:1px solid var(--color-pax-border);'
          : 'background:rgba(37,99,235,0.08); color:var(--color-pax); border:1px dashed var(--color-pax-border);';

        paxBadge = `<span class="table-badge" style="${style}">
          <span class="symbology-badge symbol-pax">■</span> ${paxLabel}
        </span>`;
      }

      let frontierBadge = '<span class="status-tag inactive">None</span>';
      if (c.frontier_call) {
        const leaderTitle = c.frontier_call.leader_title || 'Endorsed';
        frontierBadge = `<span class="table-badge" style="background:var(--color-frontier-bg); color:var(--color-frontier); border:1px solid var(--color-frontier-border);" title="${c.frontier_call.endorsed_by}">
          <span class="symbology-badge symbol-frontier">★</span> ${leaderTitle}
        </span>`;
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
          <td>${waicoBadge}</td>
          <td>${paxBadge}</td>
          <td>${frontierBadge}</td>
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
          mapInstance.selectCountryByIso3(iso);
          openCountryDetails(country);
          updateUrlHash(iso);
        }
      });
    });
  }

  // Column Sorting
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
    if (country.pax_silica) {
      paxCard.style.display = 'block';
      let paxLabel = country.pax_silica.role_label || 'Signatory';
      if (!country.pax_silica.is_direct && !paxLabel.includes('(via EU)')) {
        paxLabel += ' (via EU)';
      }
      document.getElementById('details-pax-status').textContent = paxLabel;
      document.getElementById('details-pax-date').textContent = country.pax_silica.date || 'December 2025';
      document.getElementById('details-pax-signatory').textContent = country.pax_silica.signatory_title || (country.pax_silica.is_direct ? 'National Representative' : 'European Commission');
      document.getElementById('details-pax-notes').textContent = country.pax_silica.notes || '';
      document.getElementById('details-pax-source').href = country.pax_silica.source_url || 'https://en.wikipedia.org/wiki/Pax_Silica';
    } else {
      paxCard.style.display = 'none';
    }

    // Frontier AI Call Card
    const frontierCard = document.getElementById('details-card-frontier');
    if (country.frontier_call) {
      frontierCard.style.display = 'block';
      document.getElementById('details-frontier-status').textContent = country.frontier_call.role_label;
      document.getElementById('details-frontier-date').textContent = country.frontier_call.date || '21 September 2026';
      document.getElementById('details-frontier-endorser').textContent = country.frontier_call.endorsed_by || 'Head of State/Government';
      document.getElementById('details-frontier-notes').textContent = country.frontier_call.notes || '';
      document.getElementById('details-frontier-source').href = country.frontier_call.source_url || 'https://www.regjeringen.no/contentassets/35b2ea6933304966bd739ff4b8107300/a-call-for-control-of-frontier-ai-models-final.pdf';
    } else {
      frontierCard.style.display = 'none';
    }

    // Unaligned Notice
    const unalignedNotice = document.getElementById('details-unaligned-notice');
    if (!country.waico && !country.pax_silica && !country.frontier_call) {
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
    document.querySelectorAll('.table-country-row').forEach(r => {
      r.classList.toggle('is-selected', r.getAttribute('data-iso') === country.iso3);
    });
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

  [aboutModal, methodologyModal].forEach(m => {
    m.addEventListener('click', (e) => {
      const rect = m.getBoundingClientRect();
      const inDialog = (
        rect.top <= e.clientY && e.clientY <= rect.top + rect.height &&
        rect.left <= e.clientX && e.clientX <= rect.left + rect.width
      );
      if (!inDialog) m.close();
    });
  });

  // 10. Data Exports
  exportCsvBtn.addEventListener('click', () => DataStore.exportToCSV());
  exportJsonBtn.addEventListener('click', () => DataStore.exportToJSON());
  exportXmlBtn.addEventListener('click', () => DataStore.exportToXML());

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
        mapInstance.selectCountryByIso3(iso);
        openCountryDetails(country);
      }
    }
  }

  window.addEventListener('hashchange', checkUrlHash);

  // Keyboard Shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (countryDetailsPanel.classList.contains('is-open')) closeCountryDetails();
      if (aboutModal.open) aboutModal.close();
      if (methodologyModal.open) methodologyModal.close();
    }
  });
});
