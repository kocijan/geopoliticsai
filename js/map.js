/**
 * GeopoliticsAI.com - Map & 3D Globe Visualization Engine (D3.js + TopoJSON)
 */

class GeopoliticsMap {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    this.options = Object.assign({
      mode: '2d', // '2d' (Natural Earth) or 'globe' (Orthographic)
      onCountrySelect: null,
      onHover: null,
      onRotationChange: null
    }, options);

    this.svg = null;
    this.g = null;
    this.projection = null;
    this.path = null;
    this.graticule = null;
    this.worldData = null;
    this.countryFeatures = [];
    this.activeLayers = { waico: true, pax: true, frontier: true };
    this.textureMode = false;
    this.selectedIso3 = null;

    // 3D Globe rotation and interaction state
    this.rotation = [0, -15];
    this.isRotating = false;
    this.spinTimer = null;
    this.isDraggingGlobe = false;
    this.dragStartPos = [0, 0];
    this.dragStartRotation = [0, 0];

    // 2D Zoom state
    this.zoomBehavior = null;
    this.current2DTransform = d3.zoomIdentity;
    this.baseScale2D = 170;
    this.baseScaleGlobe = 250;
    this.globeScale = 250;

    // Dual-resolution map data
    this.worldDataLowRes = null;   // 110m TopoJSON
    this.worldDataHighRes = null;  // 50m TopoJSON
    this.currentResolution = 'low'; // 'low' or 'high'
    this.resolutionSwitchThreshold = 2.5; // zoom scale at which to switch

    // City-state configuration for zoom-dependent sizing
    this.cityStateConfigs = [];
    this.lastCityStateZoom = 1;

    // Tooltip
    this.tooltip = document.getElementById('map-tooltip');
  }

  async init(worldTopoJson) {
    this.worldData = worldTopoJson;
    // Store as low-res by default (caller may provide 110m or 50m)
    this.worldDataLowRes = worldTopoJson;
    this.countryFeatures = topojson.feature(this.worldData, this.worldData.objects.countries).features;
    this.injectCityStates(1);

    this.setupSvg();
    this.setupDefs();
    this.setupProjection();
    this.setupGraticule();
    this.setupInteractions();
    this.render();

    window.addEventListener('resize', () => this.handleResize());
    if (window.ResizeObserver) {
      new ResizeObserver(() => this.handleResize()).observe(this.container);
    }
  }

  /**
   * Accept high-resolution (50m) TopoJSON for lazy upgrade.
   * Swaps features when zoom passes the threshold.
   */
  setHighResData(worldTopoJson50m) {
    this.worldDataHighRes = worldTopoJson50m;
    // If already zoomed in past threshold, switch immediately
    const currentZoom = this.getCurrentZoomScale();
    if (currentZoom >= this.resolutionSwitchThreshold) {
      this.switchResolution('high');
    }
  }

  getCurrentZoomScale() {
    if (this.options.mode === '2d') {
      return this.current2DTransform ? this.current2DTransform.k : 1;
    } else {
      return this.globeScale / this.baseScaleGlobe;
    }
  }

  switchResolution(targetRes) {
    if (targetRes === this.currentResolution) return;
    const topoData = targetRes === 'high' ? this.worldDataHighRes : this.worldDataLowRes;
    if (!topoData) return;

    this.currentResolution = targetRes;
    this.worldData = topoData;
    this.countryFeatures = topojson.feature(topoData, topoData.objects.countries).features;
    const zoomScale = this.getCurrentZoomScale();
    this.injectCityStates(zoomScale);
    this.render();
    this.updateStyles();
    console.log(`[Map] Switched to ${targetRes}-res (${targetRes === 'high' ? '50m' : '110m'})`);
  }

  checkResolutionSwitch(zoomScale) {
    if (!this.worldDataHighRes) return; // high-res not loaded yet
    const shouldBeHigh = zoomScale >= this.resolutionSwitchThreshold;
    const targetRes = shouldBeHigh ? 'high' : 'low';
    if (targetRes !== this.currentResolution) {
      this.switchResolution(targetRes);
    }
  }

  injectCityStates(zoomScale = 1) {
    // City-states: small geographic radius when synthetic circle is necessary (110m)
    const cityStates = [
      { id: '702', a3: 'SGP', name: 'Singapore', lon: 103.8198, lat: 1.3521, r: 0.20 },
      { id: '492', a3: 'MCO', name: 'Monaco', lon: 7.4246, lat: 43.7384, r: 0.12 },
      { id: '336', a3: 'VAT', name: 'Holy See', lon: 12.4534, lat: 41.9029, r: 0.10 },
      { id: '674', a3: 'SMR', name: 'San Marino', lon: 12.4578, lat: 43.9424, r: 0.12 },
      { id: '438', a3: 'LIE', name: 'Liechtenstein', lon: 9.5554, lat: 47.1660, r: 0.12 },
      { id: '470', a3: 'MLT', name: 'Malta', lon: 14.3754, lat: 35.9375, r: 0.18 },
      { id: '020', a3: 'AND', name: 'Andorra', lon: 1.5218, lat: 42.5063, r: 0.15 },
      { id: '048', a3: 'BHR', name: 'Bahrain', lon: 50.5577, lat: 26.0667, r: 0.18 }
    ];

    // Store configs for dynamic resizing
    this.cityStateConfigs = cityStates;
    this.lastCityStateZoom = zoomScale;

    for (const cs of cityStates) {
      const existing = this.countryFeatures.find(f =>
        (f.id !== undefined && f.id !== null && String(f.id).padStart(3, '0') === cs.id) ||
        (f.properties?.a3 && f.properties.a3 === cs.a3) ||
        (f.properties?.name && f.properties.name.toLowerCase() === cs.name.toLowerCase())
      );

      // Fixed geographic radius on 110m — does NOT depend on zoom
      const fixedRadius = cs.r;

      const rawCircleGeo = typeof d3.geoCircle === 'function'
        ? d3.geoCircle().center([cs.lon, cs.lat]).radius(fixedRadius)()
        : null;
      const circleGeo = this.normalizeCityStateGeometry(rawCircleGeo);

      if (existing) {
        // Country exists in this TopoJSON resolution (e.g. 50m has all of them as real polygons)
        // Keep its real geographic geometry — do NOT replace with a circle!
        existing.isCityState = true;
        existing._cityStateConfig = cs;
        existing._usesCircle = false;
      } else if (circleGeo) {
        // Country not present in current TopoJSON at all (110m) — inject as a (small!) synthetic circle
        this.countryFeatures.push({
          type: 'Feature',
          id: cs.id,
          properties: { name: cs.name, a3: cs.a3 },
          geometry: circleGeo,
          isCityState: true,
          _cityStateConfig: cs,
          _usesCircle: true
        });
      }
    }

    // Sort features so larger countries render first and smaller/city states render last (on top in SVG DOM order)
    this.countryFeatures.forEach(f => {
      try {
        f._area = typeof d3.geoArea === 'function' ? d3.geoArea(f) : 0;
      } catch (_) {
        f._area = 0;
      }
    });

    this.countryFeatures.sort((a, b) => {
      if (a.isCityState && !b.isCityState) return 1;
      if (!a.isCityState && b.isCityState) return -1;
      return b._area - a._area;
    });
  }

  /**
   * Compute hitbox stroke-width for city-state based on zoom level.
   * At zoom 1: generous ~18px for easy clicking. At higher zoom: scales smoothly
   * so the clickable area stays easy to click without overlapping neighbors.
   */
  computeCityStateHitboxStroke(zoomScale) {
    return Math.max(8, 18 / Math.sqrt(Math.max(1, zoomScale)));
  }

  /**
   * Update city-state hitbox stroke widths when zoom changes.
   * Circle geometry is fixed and does not change with zoom.
   */
  updateCityStateGeometry(zoomScale) {
    // Only update if zoom changed enough to matter
    const ratio = zoomScale / (this.lastCityStateZoom || 1);
    if (ratio > 0.85 && ratio < 1.18) return;

    this.lastCityStateZoom = zoomScale;

    // Update hitbox stroke-width based on zoom
    const strokeW = this.computeCityStateHitboxStroke(zoomScale);
    this.g.selectAll('.country-hitbox').style('stroke-width', strokeW + 'px');
  }

  normalizeCityStateGeometry(geometry) {
    if (!geometry || geometry.type !== 'Polygon' || !Array.isArray(geometry.coordinates)) return null;

    // Guard against ring winding issues that can make tiny polygons render as near-world masks.
    if (typeof d3.geoArea === 'function' && d3.geoArea(geometry) > (2 * Math.PI)) {
      return {
        type: 'Polygon',
        coordinates: geometry.coordinates.map(ring => Array.isArray(ring) ? [...ring].reverse() : ring)
      };
    }

    return geometry;
  }

  setupSvg() {
    const rawW = this.container ? this.container.clientWidth : 0;
    const rawH = this.container ? this.container.clientHeight : 0;
    const width = Math.max(300, rawW || 800);
    const height = Math.max(300, rawH || 560);

    this.svg = d3.select(this.container)
      .append('svg')
      .attr('class', 'map-svg')
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('preserveAspectRatio', 'xMidYMid meet')
      .attr('aria-label', 'Interactive geopolitical map of AI alignments');

    this.g = this.svg.append('g').attr('class', 'map-root-group');
  }

  setupDefs() {
    const defs = this.svg.append('defs');

    // 1. WAICO Stripes (Diagonal Red)
    defs.append('pattern')
      .attr('id', 'pattern-waico-stripes')
      .attr('width', 8)
      .attr('height', 8)
      .attr('patternUnits', 'userSpaceOnUse')
      .attr('patternTransform', 'rotate(45)')
      .html(`
        <rect width="8" height="8" fill="#fee2e2"/>
        <line x1="0" y1="0" x2="0" y2="8" stroke="#dc2626" stroke-width="3.5" />
      `);

    // 2. Pax Silica Dots (Stipple Blue)
    defs.append('pattern')
      .attr('id', 'pattern-pax-dots')
      .attr('width', 8)
      .attr('height', 8)
      .attr('patternUnits', 'userSpaceOnUse')
      .html(`
        <rect width="8" height="8" fill="#dbeafe"/>
        <circle cx="4" cy="4" r="2.2" fill="#2563eb" />
      `);

    // 3. Frontier Call Grid (Gold Square Crossbars)
    defs.append('pattern')
      .attr('id', 'pattern-frontier-grid')
      .attr('width', 8)
      .attr('height', 8)
      .attr('patternUnits', 'userSpaceOnUse')
      .html(`
        <rect width="8" height="8" fill="#fef3c7"/>
        <line x1="0" y1="4" x2="8" y2="4" stroke="#d97706" stroke-width="2" />
        <line x1="4" y1="0" x2="4" y2="8" stroke="#d97706" stroke-width="2" />
      `);

    // 4. Tripartite Weave (All 3)
    defs.append('pattern')
      .attr('id', 'pattern-tripartite-weave')
      .attr('width', 10)
      .attr('height', 10)
      .attr('patternUnits', 'userSpaceOnUse')
      .html(`
        <rect width="10" height="10" fill="#ede9fe"/>
        <line x1="0" y1="0" x2="10" y2="10" stroke="#dc2626" stroke-width="2.5" />
        <circle cx="5" cy="5" r="2.2" fill="#2563eb" />
        <line x1="10" y1="0" x2="0" y2="10" stroke="#d97706" stroke-width="2" />
      `);

    // 5. Pax + Frontier Cross
    defs.append('pattern')
      .attr('id', 'pattern-pax-frontier-cross')
      .attr('width', 8)
      .attr('height', 8)
      .attr('patternUnits', 'userSpaceOnUse')
      .html(`
        <rect width="8" height="8" fill="#ccfbf1"/>
        <circle cx="4" cy="4" r="2" fill="#2563eb" />
        <line x1="0" y1="4" x2="8" y2="4" stroke="#0d9488" stroke-width="2" />
      `);

    // 6. WAICO + Frontier Zigzag
    defs.append('pattern')
      .attr('id', 'pattern-waico-frontier-zigzag')
      .attr('width', 8)
      .attr('height', 8)
      .attr('patternUnits', 'userSpaceOnUse')
      .html(`
        <rect width="8" height="8" fill="#ffedd5"/>
        <line x1="0" y1="0" x2="8" y2="8" stroke="#dc2626" stroke-width="2" />
        <line x1="0" y1="8" x2="8" y2="0" stroke="#ea580c" stroke-width="1.5" />
      `);

    // 7. WAICO + Pax Blend
    defs.append('pattern')
      .attr('id', 'pattern-waico-pax-blend')
      .attr('width', 8)
      .attr('height', 8)
      .attr('patternUnits', 'userSpaceOnUse')
      .html(`
        <rect width="8" height="8" fill="#f3e8ff"/>
        <line x1="0" y1="0" x2="8" y2="8" stroke="#dc2626" stroke-width="2" />
        <circle cx="4" cy="4" r="2" fill="#9333ea" />
      `);
  }

  setupProjection() {
    const rawW = this.container ? this.container.clientWidth : 0;
    const rawH = this.container ? this.container.clientHeight : 0;
    const width = Math.max(300, rawW || 800);
    const height = Math.max(300, rawH || 560);
    console.log('[Map] setupProjection: container raw dims =', rawW, rawH, 'effective =', width, height);

    this.baseScale2D = Math.min(width, height) * 0.28;
    this.baseScaleGlobe = Math.min(width, height) * 0.44;
    this.globeScale = this.baseScaleGlobe;

    if (this.options.mode === 'globe') {
      this.projection = d3.geoOrthographic()
        .scale(this.globeScale)
        .translate([width / 2, height / 2])
        .rotate(this.rotation)
        .clipAngle(90);
    } else {
      this.projection = d3.geoNaturalEarth1()
        .scale(this.baseScale2D)
        .translate([width / 2, height / 2]);
    }

    this.path = d3.geoPath().projection(this.projection);
    this.graticule = d3.geoGraticule10();
  }

  setupGraticule() {
    this.g.selectAll('.sphere-layer').remove();
    this.g.selectAll('.graticule-layer').remove();

    if (this.options.mode === 'globe') {
      this.g.append('path')
        .datum({ type: 'Sphere' })
        .attr('class', 'sphere-layer globe-sphere')
        .attr('d', this.path);

      this.g.append('path')
        .datum({ type: 'Sphere' })
        .attr('class', 'sphere-layer globe-halo')
        .attr('d', this.path);
    }

    this.g.append('path')
      .datum(this.graticule)
      .attr('class', 'graticule-layer graticule-path')
      .attr('d', this.path);
  }

  setupInteractions() {
    const self = this;
    const container = this.container;

    // D3 Zoom exclusively for 2D Mode
    this.zoomBehavior = d3.zoom()
      .scaleExtent([0.75, 12])
      .filter(event => {
        // Only allow D3 zoom when in 2D mode!
        if (self.options.mode !== '2d') return false;
        // Allow touch events and primary mouse button
        return (!event.ctrlKey || event.type === 'wheel') && !event.button;
      })
      .on('zoom', event => {
        if (self.options.mode === '2d') {
          self.current2DTransform = event.transform;
          self.g.attr('transform', event.transform);

          // Update city-state sizes and check resolution switch on zoom
          const k = event.transform.k;
          self.updateCityStateGeometry(k);
          self.checkResolutionSwitch(k);
        }
      });

    d3.select(container).call(this.zoomBehavior);

    // Native pointer events for 3D Globe Drag Rotation & Wheel Zoom
    let pointerMoved = false;
    let rAFPending = false;

    container.addEventListener('pointerdown', (e) => {
      if (self.options.mode !== 'globe') return;
      // Don't intercept clicks on floating control buttons
      if (e.target.closest('.map-floating-controls')) return;
      self.isDraggingGlobe = true;
      pointerMoved = false;
      self.dragStartPos = [e.clientX, e.clientY];
      self.dragStartRotation = [...self.rotation];
      try { container.setPointerCapture(e.pointerId); } catch (_) {}

      if (self.isRotating) {
        self.stopRotation();
        if (self.options.onRotationChange) self.options.onRotationChange(false);
      }
    });

    container.addEventListener('pointermove', (e) => {
      if (!self.isDraggingGlobe || self.options.mode !== 'globe') return;
      const dx = e.clientX - self.dragStartPos[0];
      const dy = e.clientY - self.dragStartPos[1];
      
      if (!pointerMoved && Math.hypot(dx, dy) > 3) {
        pointerMoved = true;
      }

      if (pointerMoved) {
        const k = 57.3 / self.globeScale; // 180 / pi = 57.296: exactly 1:1 with mouse cursor in orthographic projection
        self.rotation[0] = self.dragStartRotation[0] + dx * k;
        self.rotation[1] = Math.max(-85, Math.min(85, self.dragStartRotation[1] - dy * k));
        
        if (!rAFPending) {
          rAFPending = true;
          requestAnimationFrame(() => {
            self.projection.rotate(self.rotation);
            self.updatePaths();
            rAFPending = false;
          });
        }
      }
    });

    const finishDrag = (e) => {
      if (self.isDraggingGlobe) {
        const wasDragging = pointerMoved;
        self.isDraggingGlobe = false;
        pointerMoved = false;
        try { container.releasePointerCapture(e.pointerId); } catch (_) {}

        // If pointer was released without dragging in globe mode, treat as click
        if (!wasDragging && self.options.mode === 'globe') {
          const el = document.elementFromPoint(e.clientX, e.clientY);
          const pathEl = el ? el.closest('.country-path, .country-hitbox') : null;
          if (pathEl && pathEl.__data__) {
            self.handleCountryClick(pathEl.__data__);
          }
        }
      }
    };

    container.addEventListener('pointerup', finishDrag);
    container.addEventListener('pointercancel', finishDrag);

    // Mouse wheel zoom for 3D Globe
    container.addEventListener('wheel', (e) => {
      if (self.options.mode !== 'globe') return;
      e.preventDefault();
      const delta = -e.deltaY;
      const zoomFactor = delta > 0 ? 1.15 : 0.87;
      self.globeScale = Math.max(100, Math.min(3500, self.globeScale * zoomFactor));
      self.projection.scale(self.globeScale);
      self.updatePaths();

      // Update city-state sizes and check resolution switch on globe zoom
      const globeZoomScale = self.globeScale / self.baseScaleGlobe;
      self.updateCityStateGeometry(globeZoomScale);
      self.checkResolutionSwitch(globeZoomScale);
    }, { passive: false });
  }

  render() {
    const self = this;
    console.log('[Map] render called: feature count =', this.countryFeatures ? this.countryFeatures.length : 0);
    this.g.selectAll('.countries-layer').remove();
    this.g.selectAll('.base-countries-layer').remove();
    this.g.selectAll('.city-states-layer').remove();

    const baseFeatures = this.countryFeatures.filter(f => !f.isCityState);
    const cityStateFeatures = this.countryFeatures.filter(f => f.isCityState);

    const baseLayer = this.g.append('g').attr('class', 'base-countries-layer');
    const cityStatesLayer = this.g.append('g').attr('class', 'city-states-layer');

    // 1. Base Countries Layer
    baseLayer.selectAll('.country-path')
      .data(baseFeatures)
      .enter()
      .append('path')
      .attr('class', d => {
        const country = self.resolveCountry(d);
        const isSelected = country && country.iso3 === self.selectedIso3;
        return `country-path ${isSelected ? 'is-selected' : ''}`.trim();
      })
      .attr('d', this.path)
      .attr('tabindex', '0')
      .attr('role', 'button')
      .attr('aria-label', d => {
        const country = self.resolveCountry(d);
        return country ? `${country.name} (${country.iso3})` : (d.properties?.name || 'Territory');
      })
      .attr('data-alliance', d => {
        const country = self.resolveCountry(d);
        return country ? DataStore.computeCountryAlliance(country, self.activeLayers) : 'none';
      })
      .style('fill', d => self.getCountryFill(d))
      .on('mouseenter', function(event, d) {
        self.handleMouseEnter(this, event, d);
      })
      .on('mousemove', function(event) {
        self.handleMouseMove(event);
      })
      .on('mouseleave', function() {
        self.handleMouseLeave(this);
      })
      .on('click', function(event, d) {
        event.stopPropagation();
        try { this.blur(); } catch (_) {}
        self.handleCountryClick(d);
      })
      .on('keydown', function(event, d) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          self.handleCountryClick(d);
        }
      });

    // 2. City States Layer (Always on top of base countries!)
    cityStatesLayer.selectAll('.country-path')
      .data(cityStateFeatures)
      .enter()
      .append('path')
      .attr('class', d => {
        const country = self.resolveCountry(d);
        const isSelected = country && country.iso3 === self.selectedIso3;
        return `country-path is-city-state ${isSelected ? 'is-selected' : ''}`.trim();
      })
      .attr('d', this.path)
      .attr('tabindex', '0')
      .attr('role', 'button')
      .attr('aria-label', d => {
        const country = self.resolveCountry(d);
        return country ? `${country.name} (${country.iso3})` : (d.properties?.name || 'Territory');
      })
      .attr('data-alliance', d => {
        const country = self.resolveCountry(d);
        return country ? DataStore.computeCountryAlliance(country, self.activeLayers) : 'none';
      })
      .style('fill', d => self.getCountryFill(d))
      .each(function(d) {
        d._pathElement = this;
      })
      .on('mouseenter', function(event, d) {
        self.handleMouseEnter(this, event, d);
      })
      .on('mousemove', function(event) {
        self.handleMouseMove(event);
      })
      .on('mouseleave', function() {
        self.handleMouseLeave(this);
      })
      .on('click', function(event, d) {
        event.stopPropagation();
        try { this.blur(); } catch (_) {}
        self.handleCountryClick(d);
      })
      .on('keydown', function(event, d) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          self.handleCountryClick(d);
        }
      });

    // 3. Generous 16px Hitbox Overlay for City States
    cityStatesLayer.selectAll('.country-hitbox')
      .data(cityStateFeatures)
      .enter()
      .append('path')
      .attr('class', 'country-hitbox')
      .attr('d', this.path)
      .attr('vector-effect', 'non-scaling-stroke')
      .style('stroke-width', () => self.computeCityStateHitboxStroke(self.getCurrentZoomScale()) + 'px')
      .attr('aria-hidden', 'true')
      .on('mouseenter', function(event, d) {
        self.handleMouseEnter(d._pathElement, event, d);
      })
      .on('mousemove', function(event) {
        self.handleMouseMove(event);
      })
      .on('mouseleave', function(event, d) {
        self.handleMouseLeave(d._pathElement);
      })
      .on('click', function(event, d) {
        event.stopPropagation();
        self.handleCountryClick(d);
      });
  }

  updatePaths() {
    this.g.selectAll('.sphere-layer').attr('d', this.path);
    this.g.selectAll('.graticule-path').attr('d', this.path);
    this.g.selectAll('.country-path').attr('d', this.path);
    this.g.selectAll('.country-hitbox').attr('d', this.path);
  }

  resolveCountry(d) {
    const id = d.id !== undefined && d.id !== null ? String(d.id).padStart(3, '0') : null;
    let country = id ? DataStore.getCountryByNumeric(id) : null;
    if (!country && d.properties?.a3) {
      if (d.properties.a3 === 'CYN') country = DataStore.getCountryByIso3('XNC');
      else country = DataStore.getCountryByIso3(d.properties.a3);
    }
    if (!country && d.properties?.name) {
      const rawName = d.properties.name.trim();
      const lower = rawName.toLowerCase();
      if (lower === 'n. cyprus' || lower === 'northern cyprus') {
        country = DataStore.getCountryByIso3('XNC');
      } else if (lower === 'kosovo') {
        country = DataStore.getCountryByIso3('XKX');
      } else if (lower === 'somaliland') {
        country = DataStore.getCountryByIso3('SOL');
      } else {
        country = DataStore.getCountryByName(rawName);
      }
    }
    return country;
  }

  getCountryFill(d) {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const neutralGrey = isDark ? '#1e293b' : '#94a3b8';

    const country = this.resolveCountry(d);
    if (!country) return neutralGrey;

    const alliance = DataStore.computeCountryAlliance(country, this.activeLayers);

    // Pattern Mode
    if (this.textureMode) {
      if (alliance === 'tripartite') return 'url(#pattern-tripartite-weave)';
      if (alliance === 'waico_only') return 'url(#pattern-waico-stripes)';
      if (alliance === 'pax_only') return 'url(#pattern-pax-dots)';
      if (alliance === 'frontier_only') return 'url(#pattern-frontier-grid)';
      if (alliance === 'pax_frontier') return 'url(#pattern-pax-frontier-cross)';
      if (alliance === 'waico_frontier') return 'url(#pattern-waico-frontier-zigzag)';
      if (alliance === 'waico_pax') return 'url(#pattern-waico-pax-blend)';
      return neutralGrey;
    }

    // Concrete Hex Fallback Colors (works 100% across all engines)
    switch (alliance) {
      case 'tripartite':
        return isDark ? '#a855f7' : '#7c3aed';
      case 'waico_pax':
        return isDark ? '#c084fc' : '#9333ea';
      case 'pax_frontier':
        return isDark ? '#14b8a6' : '#0d9488';
      case 'waico_frontier':
        return isDark ? '#f97316' : '#ea580c';
      case 'waico_only':
        return isDark ? '#ef4444' : '#dc2626';
      case 'pax_only':
        return isDark ? '#3b82f6' : '#2563eb';
      case 'frontier_only':
        return isDark ? '#f59e0b' : '#d97706';
      case 'covered_via_eu':
        return isDark ? '#3b82f6' : '#2563eb'; // Colored into Pax Silica!
      default:
        return neutralGrey;
    }
  }

  updateStyles() {
    const self = this;
    this.g.selectAll('.country-path')
      .attr('data-alliance', d => {
        const country = self.resolveCountry(d);
        return country ? DataStore.computeCountryAlliance(country, self.activeLayers) : 'none';
      })
      .style('fill', d => self.getCountryFill(d))
      .classed('is-selected', d => {
        const country = self.resolveCountry(d);
        return country && country.iso3 === self.selectedIso3;
      });

    if (this.selectedIso3) {
      this.g.selectAll('.country-path.is-selected').raise();
    }
  }

  handleMouseEnter(element, event, d) {
    const country = this.resolveCountry(d);
    if (!country) return;

    if (element) {
      d3.select(element).raise().classed('is-hovered', true);
    }

    if (this.tooltip) {
      let badgesHtml = '';

      if (country.waico) {
        badgesHtml += `
          <div class="tooltip-badge-row">
            <span class="symbology-badge symbol-waico">◆</span>
            <strong>WAICO:</strong> ${country.waico.role_label}
          </div>
        `;
      }

      if (country.pax_silica) {
        let paxRole = country.pax_silica.role_label || 'Pax Silica';
        if (!country.pax_silica.is_direct && !paxRole.includes('(via EU)')) {
          paxRole += ' (via EU)';
        }
        paxRole = paxRole.replace(/(\s*\(via EU\))+/g, ' (via EU)');

        badgesHtml += `
          <div class="tooltip-badge-row">
            <span class="symbology-badge symbol-pax">■</span>
            <strong>Pax Silica:</strong> ${paxRole}
          </div>
        `;
      }

      if (country.frontier_call) {
        badgesHtml += `
          <div class="tooltip-badge-row">
            <span class="symbology-badge symbol-frontier">★</span>
            <strong>Frontier Call:</strong> ${country.frontier_call.role_label}
          </div>
        `;
      }

      if (!country.waico && !country.pax_silica && !country.frontier_call) {
        badgesHtml = `<div style="color: var(--text-muted);">No recorded alignment</div>`;
      }

      this.tooltip.innerHTML = `
        <div class="tooltip-country-name">
          <span class="tooltip-flag">${country.flag_emoji || '🏳️'}</span>
          <span class="tooltip-name-text">${country.name}</span>
          <span class="tooltip-iso">${country.iso3}</span>
        </div>
        <div class="tooltip-badges">${badgesHtml}</div>
      `;

      this.tooltip.classList.add('is-visible');
      this.positionTooltip(event);
    }

    if (this.options.onHover) this.options.onHover(country);
  }

  handleMouseMove(event) {
    this.positionTooltip(event);
  }

  positionTooltip(event) {
    if (!this.tooltip) return;
    const bounds = this.container.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const y = event.clientY - bounds.top;
    const w = bounds.width;
    const h = bounds.height;

    // Edge thresholds (fraction of container dimensions)
    const edgeMarginX = 0.18; // 18% from sides
    const edgeMarginTop = 0.20; // 20% from top

    // Determine vertical positioning
    let translateY;
    if (y < h * edgeMarginTop) {
      // Near top: show tooltip below cursor
      translateY = '15px';
    } else {
      // Default: show above cursor
      translateY = 'calc(-100% - 15px)';
    }

    // Determine horizontal positioning
    // Use right-based positioning near right edge to prevent container clipping
    const nearRight = x > w * (1 - edgeMarginX);
    const nearLeft = x < w * edgeMarginX;

    if (nearRight) {
      // Near right edge: anchor from right side so tooltip expands leftward without clipping
      this.tooltip.style.left = 'auto';
      this.tooltip.style.right = `${w - x + 14}px`;
      this.tooltip.style.top = `${y}px`;
      this.tooltip.style.transform = `translate(0, ${translateY})`;
    } else if (nearLeft) {
      // Near left edge: anchor from left side with positive offset
      this.tooltip.style.right = 'auto';
      this.tooltip.style.left = `${x + 14}px`;
      this.tooltip.style.top = `${y}px`;
      this.tooltip.style.transform = `translate(0, ${translateY})`;
    } else {
      // Default: centered on cursor
      this.tooltip.style.right = 'auto';
      this.tooltip.style.left = `${x}px`;
      this.tooltip.style.top = `${y}px`;
      this.tooltip.style.transform = `translate(-50%, ${translateY})`;
    }
  }

  handleMouseLeave(element) {
    if (element) {
      d3.select(element).classed('is-hovered', false);
    }
    if (this.tooltip) {
      this.tooltip.classList.remove('is-visible');
    }
  }

  handleCountryClick(d) {
    const country = this.resolveCountry(d);
    if (!country) return;

    this.selectedIso3 = country.iso3;
    this.updateStyles();

    if (this.options.onCountrySelect) {
      this.options.onCountrySelect(country);
    }

    if (this.options.mode === 'globe') {
      const centroid = d3.geoCentroid(d);
      if (centroid && !isNaN(centroid[0])) {
        this.rotateTo([-centroid[0], -centroid[1]]);
      }
    }
  }

  rotateTo(targetRotation, duration = 650) {
    this.stopRotation();
    const self = this;
    const interpolator = d3.interpolate(this.rotation, targetRotation);
    const startTime = performance.now();

    function step(now) {
      const progress = Math.min(1, (now - startTime) / duration);
      const eased = d3.easeCubicOut(progress);
      self.rotation = interpolator(eased);
      self.projection.rotate(self.rotation);
      self.updatePaths();

      if (progress < 1) {
        requestAnimationFrame(step);
      }
    }

    requestAnimationFrame(step);
  }

  setProjectionMode(mode) {
    if (this.options.mode === mode) return;
    this.options.mode = mode;

    // Reset 2D zoom transform
    d3.select(this.container).call(this.zoomBehavior.transform, d3.zoomIdentity);
    this.g.attr('transform', null);

    this.setupProjection();
    this.setupGraticule();
    this.render();

    if (mode === 'globe' && this.isRotating) {
      this.startRotation();
    } else {
      this.stopRotation();
    }
  }

  toggleAutoRotation() {
    if (this.isRotating) {
      this.stopRotation();
    } else {
      this.startRotation();
    }
    return this.isRotating;
  }

  startRotation() {
    if (this.options.mode !== 'globe') return;
    const wasRotating = this.isRotating;
    this.isRotating = true;
    if (!wasRotating && this.options.onRotationChange) {
      this.options.onRotationChange(true);
    }
    const self = this;

    if (this.spinTimer) this.spinTimer.stop();

    this.spinTimer = d3.timer(() => {
      if (!self.isRotating || self.options.mode !== 'globe') return true;
      self.rotation[0] += 0.22;
      self.projection.rotate(self.rotation);
      self.updatePaths();
    });
  }

  stopRotation() {
    const wasRotating = this.isRotating;
    this.isRotating = false;
    if (this.spinTimer) {
      this.spinTimer.stop();
      this.spinTimer = null;
    }
    if (wasRotating && this.options.onRotationChange) {
      this.options.onRotationChange(false);
    }
  }

  zoomIn() {
    if (this.options.mode === '2d') {
      d3.select(this.container).transition().duration(250).call(this.zoomBehavior.scaleBy, 1.4);
    } else {
      this.globeScale = Math.min(3500, this.globeScale * 1.35);
      this.projection.scale(this.globeScale);
      this.updatePaths();
      const globeZoomScale = this.globeScale / this.baseScaleGlobe;
      this.updateCityStateGeometry(globeZoomScale);
      this.checkResolutionSwitch(globeZoomScale);
    }
  }

  zoomOut() {
    if (this.options.mode === '2d') {
      d3.select(this.container).transition().duration(250).call(this.zoomBehavior.scaleBy, 0.72);
    } else {
      this.globeScale = Math.max(100, this.globeScale * 0.74);
      this.projection.scale(this.globeScale);
      this.updatePaths();
      const globeZoomScale = this.globeScale / this.baseScaleGlobe;
      this.updateCityStateGeometry(globeZoomScale);
      this.checkResolutionSwitch(globeZoomScale);
    }
  }

  resetView() {
    if (this.options.mode === '2d') {
      d3.select(this.container).transition().duration(350).call(this.zoomBehavior.transform, d3.zoomIdentity);
    } else {
      this.rotateTo([0, -15]);
      this.globeScale = this.baseScaleGlobe;
      this.projection.scale(this.globeScale);
      this.updatePaths();
      const globeZoomScale = 1;
      this.updateCityStateGeometry(globeZoomScale);
      this.checkResolutionSwitch(globeZoomScale);
    }
  }

  selectCountryByIso3(iso3) {
    this.selectedIso3 = iso3 ? iso3.toUpperCase() : null;
    this.updateStyles();

    if (this.selectedIso3) {
      const feature = this.countryFeatures.find(f => {
        const c = this.resolveCountry(f);
        return c && c.iso3 === this.selectedIso3;
      });

      if (!feature) return;

      if (this.options.mode === 'globe') {
        const centroid = d3.geoCentroid(feature);
        if (centroid && !isNaN(centroid[0])) {
          this.rotateTo([-centroid[0], -centroid[1]]);
        }
      } else if (this.options.mode === '2d') {
        // If 2D map is zoomed in, smoothly pan/jump to center on that country
        if (this.current2DTransform && this.current2DTransform.k > 1.05) {
          let center = null;
          try {
            const pCentroid = this.path.centroid(feature);
            if (pCentroid && !isNaN(pCentroid[0]) && !isNaN(pCentroid[1])) {
              center = pCentroid;
            }
          } catch (_) {}

          if (!center) {
            try {
              const gCentroid = d3.geoCentroid(feature);
              if (gCentroid && !isNaN(gCentroid[0]) && !isNaN(gCentroid[1])) {
                center = this.projection(gCentroid);
              }
            } catch (_) {}
          }

          if (center && !isNaN(center[0]) && !isNaN(center[1])) {
            const k = this.current2DTransform.k;
            const rawW = this.container ? this.container.clientWidth : 0;
            const rawH = this.container ? this.container.clientHeight : 0;
            const width = Math.max(300, rawW || 800);
            const height = Math.max(300, rawH || 560);
            const tx = width / 2 - k * center[0];
            const ty = height / 2 - k * center[1];
            const targetTransform = d3.zoomIdentity.translate(tx, ty).scale(k);

            d3.select(this.container)
              .transition()
              .duration(550)
              .ease(d3.easeCubicOut)
              .call(this.zoomBehavior.transform, targetTransform);
          }
        }
      }
    }
  }

  handleResize() {
    if (!this.container || !this.projection) return;
    const rawW = this.container.clientWidth;
    const rawH = this.container.clientHeight;

    if (!rawW || rawW < 100 || !rawH || rawH < 100) {
      return;
    }

    const width = rawW;
    const height = rawH;

    this.baseScale2D = Math.min(width, height) * 0.28;
    this.baseScaleGlobe = Math.min(width, height) * 0.44;

    if (this.options.mode === 'globe') {
      this.globeScale = this.baseScaleGlobe;
      this.projection
        .scale(this.globeScale)
        .translate([width / 2, height / 2]);
    } else {
      this.projection
        .scale(this.baseScale2D)
        .translate([width / 2, height / 2]);
    }

    if (this.svg) {
      this.svg.attr('viewBox', `0 0 ${width} ${height}`);
    }

    this.updatePaths();
  }
}
