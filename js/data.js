/**
 * GeopoliticsAI.com - Data Store & Export Utilities
 */

const DataStore = {
  raw: null,
  meta: null,
  countriesList: [],
  countriesByIso3: new Map(),
  countriesByNumeric: new Map(),
  countriesByName: new Map(),

  async init() {
    try {
      const resp = await fetch('data/countries.json');
      if (!resp.ok) throw new Error(`HTTP error ${resp.status}`);
      const data = await resp.json();
      this.raw = data;
      this.meta = data.meta;
      this.countriesList = Object.values(data.countries);

      // Indexing
      this.countriesByIso3.clear();
      this.countriesByNumeric.clear();
      this.countriesByName.clear();

      for (const c of this.countriesList) {
        if (!c.flag_emoji || c.flag_emoji === '🏳️') {
          if (c.iso2 && c.iso2.length === 2) {
            try {
              c.flag_emoji = String.fromCodePoint(...[...c.iso2.toUpperCase()].map(char => 127397 + char.charCodeAt(0)));
            } catch (_) {
              c.flag_emoji = '🏳️';
            }
          }
        }
        this.countriesByIso3.set(c.iso3, c);
        if (c.numeric) this.countriesByNumeric.set(String(c.numeric).padStart(3, '0'), c);
        this.countriesByName.set(c.name.toLowerCase(), c);
      }

      console.log(`[DataStore] Loaded ${this.countriesList.length} countries. Data current as of ${this.meta?.data_current_as_of}`);
      return this;
    } catch (err) {
      console.error('[DataStore] Failed to load data/countries.json:', err);
      throw err;
    }
  },

  getCountryByIso3(iso3) {
    if (!iso3) return null;
    return this.countriesByIso3.get(iso3.toUpperCase()) || null;
  },

  getCountryByNumeric(num) {
    if (!num) return null;
    return this.countriesByNumeric.get(String(num).padStart(3, '0')) || null;
  },

  getCountryByName(name) {
    if (!name) return null;
    return this.countriesByName.get(name.toLowerCase()) || null;
  },

  /**
   * Determine dynamic alliance styling given active layer checkboxes.
   */
  computeCountryAlliance(country, activeLayers = { waico: true, pax: true, frontier: true }) {
    if (!country) return 'none';

    const hasWaico = activeLayers.waico && country.waico && Boolean(country.waico.status);
    
    // Pax includes founding signatories, later accessions, observers, and EU member states covered via EU
    const hasPax = activeLayers.pax && country.pax_silica && Boolean(country.pax_silica.status);
    
    const hasFrontier = activeLayers.frontier && country.frontier_call && 
      country.frontier_call.status === 'leader_endorsement';

    if (hasWaico && hasPax && hasFrontier) return 'tripartite';
    if (hasWaico && hasPax) return 'waico_pax';
    if (hasPax && hasFrontier) return 'pax_frontier';
    if (hasWaico && hasFrontier) return 'waico_frontier';
    if (hasWaico) return 'waico_only';
    if (hasPax) return 'pax_only';
    if (hasFrontier) return 'frontier_only';

    return 'none';
  },

  /**
   * Filter countries given active layers, preset category, and search query.
   */
  filterCountries({
    activeLayers = { waico: true, pax: true, frontier: true },
    categoryFilter = 'all',
    searchQuery = ''
  }) {
    let result = this.countriesList;

    // Search query
    if (searchQuery && searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(c => {
        return c.name.toLowerCase().includes(q) ||
               c.iso3.toLowerCase().includes(q) ||
               (c.frontier_call?.endorsed_by && c.frontier_call.endorsed_by.toLowerCase().includes(q)) ||
               (c.region && c.region.toLowerCase().includes(q));
      });
    }

    // Category preset filter
    if (categoryFilter !== 'all') {
      if (categoryFilter === 'aligned') {
        result = result.filter(c => {
          const alliance = this.computeCountryAlliance(c, activeLayers);
          return alliance !== 'none' && alliance !== 'covered_via_eu';
        });
      } else if (categoryFilter === 'tripartite') {
        result = result.filter(c => this.computeCountryAlliance(c, activeLayers) === 'tripartite');
      } else if (categoryFilter === 'two_way') {
        result = result.filter(c => ['waico_pax', 'pax_frontier', 'waico_frontier'].includes(this.computeCountryAlliance(c, activeLayers)));
      } else if (categoryFilter === 'waico') {
        result = result.filter(c => c.waico && ['founding_member', 'signatory'].includes(c.waico.status));
      } else if (categoryFilter === 'pax') {
        result = result.filter(c => c.pax_silica && ['founding_signatory', 'signatory'].includes(c.pax_silica.status));
      } else if (categoryFilter === 'frontier') {
        result = result.filter(c => c.frontier_call && c.frontier_call.status === 'leader_endorsement');
      } else if (categoryFilter === 'observers') {
        result = result.filter(c => 
          c.waico?.status === 'observer' || 
          c.waico?.status === 'invitee' || 
          c.pax_silica?.status === 'observer' || 
          c.pax_silica?.status === 'participant' || 
          c.pax_silica?.status === 'invited'
        );
      } else if (categoryFilter === 'eu') {
        result = result.filter(c => c.is_eu_member);
      }
    }

    return result;
  },

  /**
   * Export Helpers
   */
  exportToCSV() {
    const headers = [
      'ISO3', 'ISO2', 'Country Name', 'Region', 'Is EU Member',
      'WAICO Status', 'WAICO Date', 'WAICO Notes', 'WAICO Source',
      'Pax Silica Status', 'Pax Silica Date', 'Pax Silica Direct Signatory', 'Pax Silica Notes', 'Pax Silica Source',
      'Frontier Call Status', 'Frontier Call Date', 'Frontier Call Endorsed By', 'Frontier Call Source'
    ];

    const rows = this.countriesList.map(c => [
      `"${c.iso3}"`,
      `"${c.iso2}"`,
      `"${c.name.replace(/"/g, '""')}"`,
      `"${c.region || ''}"`,
      c.is_eu_member ? 'YES' : 'NO',
      `"${c.waico?.role_label || 'None'}"`,
      `"${c.waico?.date || ''}"`,
      `"${(c.waico?.notes || '').replace(/"/g, '""')}"`,
      `"${c.waico?.source_url || ''}"`,
      `"${c.pax_silica?.role_label || 'None'}"`,
      `"${c.pax_silica?.date || ''}"`,
      c.pax_silica ? (c.pax_silica.is_direct ? 'Direct' : 'Via EU') : 'N/A',
      `"${(c.pax_silica?.notes || '').replace(/"/g, '""')}"`,
      `"${c.pax_silica?.source_url || ''}"`,
      `"${c.frontier_call?.role_label || 'None'}"`,
      `"${c.frontier_call?.date || ''}"`,
      `"${(c.frontier_call?.endorsed_by || '').replace(/"/g, '""')}"`,
      `"${c.frontier_call?.source_url || ''}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    this.downloadFile(csvContent, 'geopolitics_ai_alignments.csv', 'text/csv;charset=utf-8;');
  },

  exportToJSON() {
    const jsonContent = JSON.stringify(this.raw, null, 2);
    this.downloadFile(jsonContent, 'geopolitics_ai_alignments.json', 'application/json;charset=utf-8;');
  },

  exportToXML() {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<geopolitics_ai>\n';
    xml += `  <metadata>\n`;
    xml += `    <title>${this.escapeXml(this.meta?.title || 'GeopoliticsAI')}</title>\n`;
    xml += `    <last_updated>${this.meta?.last_updated || '2026-09-22'}</last_updated>\n`;
    xml += `    <data_current_as_of>${this.meta?.data_current_as_of || 'September 2026'}</data_current_as_of>\n`;
    xml += `  </metadata>\n`;
    xml += '  <countries>\n';

    for (const c of this.countriesList) {
      xml += `    <country iso3="${c.iso3}" iso2="${c.iso2}" numeric="${c.numeric}">\n`;
      xml += `      <name>${this.escapeXml(c.name)}</name>\n`;
      xml += `      <region>${this.escapeXml(c.region)}</region>\n`;
      xml += `      <is_eu_member>${c.is_eu_member ? 'true' : 'false'}</is_eu_member>\n`;

      if (c.waico) {
        xml += `      <waico status="${c.waico.status}">\n`;
        xml += `        <role>${this.escapeXml(c.waico.role_label)}</role>\n`;
        xml += `        <date>${c.waico.date || ''}</date>\n`;
        xml += `        <source>${this.escapeXml(c.waico.source_url)}</source>\n`;
        xml += `      </waico>\n`;
      }

      if (c.pax_silica) {
        xml += `      <pax_silica status="${c.pax_silica.status}" is_direct="${c.pax_silica.is_direct}">\n`;
        xml += `        <role>${this.escapeXml(c.pax_silica.role_label)}</role>\n`;
        xml += `        <date>${c.pax_silica.date || ''}</date>\n`;
        xml += `        <source>${this.escapeXml(c.pax_silica.source_url)}</source>\n`;
        xml += `      </pax_silica>\n`;
      }

      if (c.frontier_call) {
        xml += `      <frontier_call status="${c.frontier_call.status}">\n`;
        xml += `        <role>${this.escapeXml(c.frontier_call.role_label)}</role>\n`;
        xml += `        <date>${c.frontier_call.date || ''}</date>\n`;
        xml += `        <endorsed_by>${this.escapeXml(c.frontier_call.endorsed_by)}</endorsed_by>\n`;
        xml += `        <source>${this.escapeXml(c.frontier_call.source_url)}</source>\n`;
        xml += `      </frontier_call>\n`;
      }

      xml += `    </country>\n`;
    }

    xml += '  </countries>\n';
    xml += '</geopolitics_ai>\n';

    this.downloadFile(xml, 'geopolitics_ai_alignments.xml', 'application/xml;charset=utf-8;');
  },

  escapeXml(unsafe) {
    if (!unsafe) return '';
    return unsafe.toString()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  },

  downloadFile(content, fileName, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    }, 100);
  }
};
