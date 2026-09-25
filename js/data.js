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
   * Determine dynamic alliance styling given active layer checkboxes and options.
   */
  computeCountryAlliance(country, activeLayers = { waico: true, pax: true, frontier: true }, options = {}) {
    if (!country) return 'none';

    // WAICO membership (distinguish full member/signatory vs observer)
    const isWaicoFull = activeLayers.waico && country.waico && (
      country.waico.status === 'founding_member' ||
      country.waico.status === 'signatory'
    );
    const isWaicoObserver = activeLayers.waico && country.waico && country.waico.status === 'observer';
    
    // Pax formal signatories (founding or later national accession)
    const isFormalPax = Boolean(
      country.pax_silica && (
        country.pax_silica.status === 'founding_signatory' ||
        country.pax_silica.status === 'signatory'
      )
    );

    // Pax sub-statuses
    const isEuRepresented = country.pax_silica && country.pax_silica.status === 'eu_represented';
    const isPaxObserver = activeLayers.pax && country.pax_silica && country.pax_silica.status === 'observer';
    const isPaxParticipant = activeLayers.pax && country.pax_silica && country.pax_silica.status === 'participant';
    const isPaxOpportunity = country.pax_silica && country.pax_silica.status === 'opportunity_statement';
    const isOpportunityOnly = Boolean(country.ai_opportunity_statement?.signed) || isPaxOpportunity;

    const hasFrontier = activeLayers.frontier && country.frontier_call && 
      country.frontier_call.status === 'leader_endorsement';

    // Whether EU-represented states participate in overlap combinations
    const includeEuInOverlap = Boolean(options.includeEuInOverlap);
    const hasPaxForOverlap = activeLayers.pax && (isFormalPax || (includeEuInOverlap && isEuRepresented));

    // Multi-initiative Overlaps for full signatories
    if (isWaicoFull && hasPaxForOverlap && hasFrontier) return 'tripartite';
    if (isWaicoFull && hasPaxForOverlap) return 'waico_pax';
    if (hasPaxForOverlap && hasFrontier) return 'pax_frontier';
    if (isWaicoFull && hasFrontier) return 'waico_frontier';

    // Frontier + Pax via EU (e.g. France, Luxembourg, Austria, Romania, Spain)
    if (hasFrontier && activeLayers.pax && isEuRepresented) {
      return 'frontier_pax_eu';
    }

    // Pax Observer + Frontier overlap (Canada, Estonia)
    if (isPaxObserver && hasFrontier) return 'pax_observer_frontier';

    // Frontier + AI Opportunity overlap (Türkiye, Bahrain)
    if (hasFrontier && isOpportunityOnly && activeLayers.pax && !hasPaxForOverlap && !isPaxObserver) {
      return 'frontier_opportunity';
    }

    // Single primary initiative memberships
    if (isWaicoFull) return 'waico_only';
    if (hasPaxForOverlap) return 'pax_only';
    if (hasFrontier) return 'frontier_only';

    // Distinct observer and sub-status representation
    if (isWaicoObserver) return 'waico_observer';
    if (isPaxObserver) return 'pax_observer';
    if (activeLayers.pax) {
      if (isEuRepresented) return 'pax_eu';
      if (isPaxParticipant) return 'pax_participant';
      if (isPaxOpportunity) return 'opportunity_statement';
    }
    if (isOpportunityOnly && activeLayers.pax) return 'opportunity_statement';

    return 'none';
  },

  /**
   * Helper: format multiple sources if present or single source_url
   */
  formatSources(item) {
    if (!item) return '';
    if (item.sources && Array.isArray(item.sources) && item.sources.length > 0) {
      return item.sources.map(s => (typeof s === 'string' ? s : `${s.title ? s.title + ': ' : ''}${s.url}`)).join(' | ');
    }
    return item.source_url || '';
  },

  /**
   * Fast, typo-tolerant fuzzy matching score between query and target string.
   * Returns a score between 0 and 100.
   */
  fuzzyScore(pattern, text) {
    if (!pattern || !text) return 0;
    const p = pattern.toLowerCase().trim();
    const t = text.toLowerCase().trim();

    if (t === p) return 100;
    if (t.startsWith(p)) return 85;
    if (t.includes(p)) return 70;

    // Word boundary start match (e.g. 'mac' matching 'Macron')
    const words = t.split(/[\s,()\-]+/);
    for (const w of words) {
      if (w === p) return 90;
      if (w.startsWith(p)) return 80;
    }

    // Subsequence match
    let pIdx = 0;
    let tIdx = 0;
    let score = 0;
    let consecutive = 0;

    while (pIdx < p.length && tIdx < t.length) {
      if (p[pIdx] === t[tIdx]) {
        pIdx++;
        consecutive++;
        score += 5 + (consecutive * 3);
      } else {
        consecutive = 0;
      }
      tIdx++;
    }

    if (pIdx === p.length) {
      const coverage = p.length / t.length;
      return Math.min(65, Math.floor(score * coverage + 20));
    }

    // Levenshtein edit distance for typo tolerance on words of length >= 4
    if (p.length >= 4) {
      for (const w of words) {
        if (Math.abs(w.length - p.length) <= 2) {
          const dist = this.levenshtein(p, w);
          if (dist === 1) return 55;
          if (dist === 2 && p.length >= 6) return 40;
        }
      }
    }

    return 0;
  },

  levenshtein(a, b) {
    const m = a.length;
    const n = b.length;
    const dp = Array.from({ length: m + 1 }, () => new Uint8Array(n + 1));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + cost
        );
      }
    }
    return dp[m][n];
  },

  /**
   * Filter countries given active layers, preset category, and search query.
   */
  filterCountries({
    activeLayers = { waico: true, pax: true, frontier: true },
    categoryFilter = 'all',
    searchQuery = '',
    options = {}
  }) {
    let result = this.countriesList;

    // Search query with fuzzy scoring & typo tolerance
    if (searchQuery && searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const scored = [];
      for (const c of result) {
        const scoreName = this.fuzzyScore(q, c.name);
        const scoreIso = (c.iso3 && c.iso3.toLowerCase() === q) ? 100 : (c.iso3?.toLowerCase().startsWith(q) ? 80 : 0);
        const scoreLeader = c.frontier_call?.endorsed_by ? this.fuzzyScore(q, c.frontier_call.endorsed_by) : 0;
        const scoreRegion = c.region ? this.fuzzyScore(q, c.region) : 0;
        const maxScore = Math.max(scoreName, scoreIso, scoreLeader, scoreRegion);
        if (maxScore > 25) {
          scored.push({ country: c, score: maxScore });
        }
      }
      scored.sort((a, b) => b.score - a.score);
      result = scored.map(s => s.country);
    }

    // Category preset filter
    if (categoryFilter !== 'all') {
      if (categoryFilter === 'aligned') {
        result = result.filter(c => {
          const alliance = this.computeCountryAlliance(c, activeLayers, options);
          return alliance !== 'none';
        });
      } else if (categoryFilter === 'tripartite') {
        result = result.filter(c => this.computeCountryAlliance(c, activeLayers, options) === 'tripartite');
      } else if (categoryFilter === 'two_way') {
        result = result.filter(c => ['waico_pax', 'pax_frontier', 'waico_frontier', 'frontier_pax_eu'].includes(this.computeCountryAlliance(c, activeLayers, options)));
      } else if (categoryFilter === 'waico') {
        result = result.filter(c => c.waico && ['founding_member', 'signatory'].includes(c.waico.status));
      } else if (categoryFilter === 'pax') {
        result = result.filter(c => c.pax_silica && ['founding_signatory', 'signatory'].includes(c.pax_silica.status));
      } else if (categoryFilter === 'frontier') {
        result = result.filter(c => c.frontier_call && c.frontier_call.status === 'leader_endorsement');
      } else if (categoryFilter === 'opportunity') {
        result = result.filter(c => Boolean(c.ai_opportunity_statement?.signed) || c.pax_silica?.status === 'opportunity_statement');
      } else if (categoryFilter === 'observers') {
        result = result.filter(c => 
          c.waico?.status === 'observer' || 
          c.waico?.status === 'invitee' || 
          c.pax_silica?.status === 'observer' || 
          c.pax_silica?.status === 'participant' || 
          c.pax_silica?.status === 'invited' ||
          c.pax_silica?.status === 'opportunity_statement'
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
      'Frontier Control Status', 'Frontier Control Date', 'Frontier Control Endorsed By', 'Frontier Control Source',
      'AI Opportunity Statement Signed', 'AI Opportunity Statement Date', 'AI Opportunity Statement Source'
    ];

    const rows = this.countriesList.map(c => [
      `"${c.iso3}"`,
      `"${c.iso2 || ''}"`,
      `"${c.name.replace(/"/g, '""')}"`,
      `"${c.region || ''}"`,
      c.is_eu_member ? 'YES' : 'NO',
      `"${c.waico?.role_label || 'None'}"`,
      `"${c.waico?.date || ''}"`,
      `"${(c.waico?.notes || '').replace(/"/g, '""')}"`,
      `"${(this.formatSources(c.waico)).replace(/"/g, '""')}"`,
      `"${c.pax_silica?.role_label || 'None'}"`,
      `"${c.pax_silica?.date || ''}"`,
      c.pax_silica?.is_direct ? 'YES' : (c.pax_silica ? 'NO' : ''),
      `"${(c.pax_silica?.notes || '').replace(/"/g, '""')}"`,
      `"${(this.formatSources(c.pax_silica)).replace(/"/g, '""')}"`,
      `"${c.frontier_call?.role_label || 'None'}"`,
      `"${c.frontier_call?.date || ''}"`,
      `"${(c.frontier_call?.endorsed_by || '').replace(/"/g, '""')}"`,
      `"${(this.formatSources(c.frontier_call)).replace(/"/g, '""')}"`,
      c.ai_opportunity_statement?.signed ? 'YES' : (c.pax_silica?.status === 'opportunity_statement' ? 'YES' : 'NO'),
      `"${c.ai_opportunity_statement?.date || (c.pax_silica?.status === 'opportunity_statement' ? c.pax_silica.date : '')}"`,
      `"${(this.formatSources(c.ai_opportunity_statement) || (c.pax_silica?.status === 'opportunity_statement' ? this.formatSources(c.pax_silica) : '')).replace(/"/g, '""')}"`
    ]);

    // Append Supranational European Union / European Commission record
    rows.push([
      '"EU"',
      '""',
      '"European Union (Supranational Organization)"',
      '"Europe"',
      'YES',
      '"None"',
      '""',
      '""',
      '""',
      '"Supranational Signatory"',
      '"2026-06-23"',
      'YES',
      '"Signed Pax Silica Declaration on 23 June 2026."',
      '"https://www.state.gov/pax-silica"',
      '"Endorsed by President of the European Commission"',
      '"2026-09-21"',
      '"Ursula von der Leyen (President of the European Commission)"',
      '"https://www.presidentti.fi/en/a-call-for-control-of-frontier-ai-models/"',
      'NO',
      '""',
      '""'
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    this.downloadFile(csvContent, 'geopolitics_ai_alignments.csv', 'text/csv;charset=utf-8;');
  },

  exportToJSON() {
    const exportObj = {
      meta: {
        title: this.meta?.title || 'GeopoliticsAI International Alignment Database',
        last_updated: this.meta?.last_updated || '2026-09-24',
        data_current_as_of: this.meta?.data_current_as_of || 'September 2026',
        version: this.meta?.version || '1.0.0',
        entity_counts: this.meta?.entity_counts || {
          iso_3166_1_entities: 249,
          additional_entities: 3,
          total_map_records: 252,
          additional_entity_details: [
            { code: 'XKX', name: 'Kosovo', description: 'User-assigned alpha-3 code (temporary ISO 3166-1 exception)' },
            { code: 'SOL', name: 'Somaliland', description: 'De facto sovereign state (project-defined code)' },
            { code: 'XNC', name: 'Northern Cyprus', description: 'De facto state / TopoJSON CYN entity (project-defined code)' }
          ]
        },
        statistics: this.meta?.statistics,
        sources: this.meta?.sources || {
          waico: 'https://en.wikipedia.org/wiki/World_Artificial_Intelligence_Cooperation_Organization',
          pax_silica: 'https://www.state.gov/pax-silica',
          frontier_call: 'https://www.presidentti.fi/en/a-call-for-control-of-frontier-ai-models/'
        }
      },
      organizations: {
        EU: {
          id: 'EU',
          name: 'European Union',
          type: 'supranational_organization',
          pax_silica: {
            status: 'signatory',
            role_label: 'Supranational Signatory',
            date: '2026-06-23',
            is_direct: true,
            notes: 'Signed Pax Silica Declaration on 23 June 2026.',
            source_url: 'https://www.state.gov/pax-silica'
          },
          frontier_call: {
            status: 'leader_endorsement',
            role_label: 'Endorsed by President of the European Commission',
            leader_title: 'President of the European Commission',
            leader_name: 'Ursula von der Leyen',
            date: '2026-09-21',
            endorsed_by: 'Ursula von der Leyen (President of the European Commission)',
            is_co_initiator: false,
            notes: 'Supranational body; European Commission endorsed the declaration.',
            source_url: 'https://www.presidentti.fi/en/a-call-for-control-of-frontier-ai-models/'
          }
        }
      },
      countries: this.raw?.countries || {}
    };
    const jsonContent = JSON.stringify(exportObj, null, 2);
    this.downloadFile(jsonContent, 'geopolitics_ai_alignments.json', 'application/json;charset=utf-8;');
  },

  exportToXML() {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<geopolitics_ai>\n';
    xml += `  <metadata>\n`;
    xml += `    <title>${this.escapeXml(this.meta?.title || 'GeopoliticsAI')}</title>\n`;
    xml += `    <last_updated>${this.meta?.last_updated || '2026-09-24'}</last_updated>\n`;
    xml += `    <data_current_as_of>${this.meta?.data_current_as_of || 'September 2026'}</data_current_as_of>\n`;
    xml += `    <entity_counts>\n`;
    xml += `      <iso_3166_1_entities>249</iso_3166_1_entities>\n`;
    xml += `      <additional_entities>3</additional_entities>\n`;
    xml += `      <total_map_records>252</total_map_records>\n`;
    xml += `    </entity_counts>\n`;
    xml += `  </metadata>\n`;

    xml += `  <organizations>\n`;
    xml += `    <organization id="EU" type="supranational_organization">\n`;
    xml += `      <name>European Union</name>\n`;
    xml += `      <pax_silica status="signatory" is_direct="true">\n`;
    xml += `        <role>Supranational Signatory</role>\n`;
    xml += `        <date>2026-06-23</date>\n`;
    xml += `        <notes>Signed Pax Silica Declaration on 23 June 2026.</notes>\n`;
    xml += `        <source>https://www.state.gov/pax-silica</source>\n`;
    xml += `      </pax_silica>\n`;
    xml += `      <frontier_call status="leader_endorsement">\n`;
    xml += `        <role>Endorsed by President of the European Commission</role>\n`;
    xml += `        <leader_title>President of the European Commission</leader_title>\n`;
    xml += `        <leader_name>Ursula von der Leyen</leader_name>\n`;
    xml += `        <date>2026-09-21</date>\n`;
    xml += `        <endorsed_by>Ursula von der Leyen (President of the European Commission)</endorsed_by>\n`;
    xml += `        <source>https://www.presidentti.fi/en/a-call-for-control-of-frontier-ai-models/</source>\n`;
    xml += `      </frontier_call>\n`;
    xml += `    </organization>\n`;
    xml += `  </organizations>\n`;

    xml += '  <countries>\n';

    for (const c of this.countriesList) {
      xml += `    <country iso3="${c.iso3}" iso2="${c.iso2 || ''}" numeric="${c.numeric || ''}">\n`;
      xml += `      <name>${this.escapeXml(c.name)}</name>\n`;
      xml += `      <region>${this.escapeXml(c.region || '')}</region>\n`;
      xml += `      <is_eu_member>${c.is_eu_member ? 'true' : 'false'}</is_eu_member>\n`;

      if (c.waico) {
        xml += `      <waico status="${c.waico.status}">\n`;
        xml += `        <role>${this.escapeXml(c.waico.role_label)}</role>\n`;
        xml += `        <date>${c.waico.date || ''}</date>\n`;
        xml += `        <notes>${this.escapeXml(c.waico.notes || '')}</notes>\n`;
        xml += `        <source>${this.escapeXml(c.waico.source_url || '')}</source>\n`;
        if (c.waico.sources && c.waico.sources.length > 0) {
          xml += `        <sources>\n`;
          for (const s of c.waico.sources) {
            xml += `          <source title="${this.escapeXml(s.title || '')}">${this.escapeXml(s.url || s)}</source>\n`;
          }
          xml += `        </sources>\n`;
        }
        xml += `      </waico>\n`;
      }

      if (c.pax_silica) {
        xml += `      <pax_silica status="${c.pax_silica.status}" is_direct="${c.pax_silica.is_direct ? 'true' : 'false'}">\n`;
        xml += `        <role>${this.escapeXml(c.pax_silica.role_label)}</role>\n`;
        xml += `        <date>${c.pax_silica.date || ''}</date>\n`;
        xml += `        <notes>${this.escapeXml(c.pax_silica.notes || '')}</notes>\n`;
        xml += `        <source>${this.escapeXml(c.pax_silica.source_url || '')}</source>\n`;
        if (c.pax_silica.sources && c.pax_silica.sources.length > 0) {
          xml += `        <sources>\n`;
          for (const s of c.pax_silica.sources) {
            xml += `          <source title="${this.escapeXml(s.title || '')}">${this.escapeXml(s.url || s)}</source>\n`;
          }
          xml += `        </sources>\n`;
        }
        xml += `      </pax_silica>\n`;
      }

      if (c.frontier_call) {
        xml += `      <frontier_call status="${c.frontier_call.status}">\n`;
        xml += `        <role>${this.escapeXml(c.frontier_call.role_label)}</role>\n`;
        xml += `        <date>${c.frontier_call.date || ''}</date>\n`;
        xml += `        <endorsed_by>${this.escapeXml(c.frontier_call.endorsed_by || '')}</endorsed_by>\n`;
        xml += `        <notes>${this.escapeXml(c.frontier_call.notes || '')}</notes>\n`;
        xml += `        <source>${this.escapeXml(c.frontier_call.source_url || '')}</source>\n`;
        if (c.frontier_call.sources && c.frontier_call.sources.length > 0) {
          xml += `        <sources>\n`;
          for (const s of c.frontier_call.sources) {
            xml += `          <source title="${this.escapeXml(s.title || '')}">${this.escapeXml(s.url || s)}</source>\n`;
          }
          xml += `        </sources>\n`;
        }
        xml += `      </frontier_call>\n`;
      }

      const oppSigned = Boolean(c.ai_opportunity_statement?.signed) || c.pax_silica?.status === 'opportunity_statement';
      if (oppSigned) {
        const oppDate = c.ai_opportunity_statement?.date || (c.pax_silica?.status === 'opportunity_statement' ? c.pax_silica.date : '');
        const oppSource = c.ai_opportunity_statement?.source_url || (c.pax_silica?.status === 'opportunity_statement' ? c.pax_silica.source_url : '');
        xml += `      <ai_opportunity_statement signed="true">\n`;
        xml += `        <date>${oppDate}</date>\n`;
        xml += `        <source>${this.escapeXml(oppSource)}</source>\n`;
        xml += `      </ai_opportunity_statement>\n`;
      } else {
        xml += `      <ai_opportunity_statement signed="false" />\n`;
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
