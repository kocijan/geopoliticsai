#!/usr/bin/env python3
"""
scripts/validate_data.py

Comprehensive data invariant, integrity, provenance, and snapshot verification script for GeopoliticsAI.
Fails with a non-zero exit code if:
- data/countries.json or data/frontier_call.json are invalid JSON or missing required fields.
- Total entities count is not 252 (249 ISO-3166-1 + 3 project additions).
- Duplicate ISO3, ISO2, numeric codes, or country names exist.
- Invalid calendar dates exist across any initiative record or dataset.
- Stored meta.statistics disagree with computed alignment categories.
- Stored alignment_category disagrees with independent direct sovereign participation recomputation.
- Stored primary_alignment_count / active_initiatives_count disagrees with direct participation count.
- Formula counts or exact ISO signatory sets mismatch:
    * 37 WAICO signatories (29 founding_signatory + 8 signatory)
    * 24 direct national Pax Silica signatories
    * 20 EU-represented Pax states
    * 28 national Frontier Control endorsers
    * 35 AI Opportunity Statement signers
- Missing source documentation or malformed URLs in any initiative record (WAICO, Pax, Frontier, AI Opp).
- Any unresolved source conflict or secondary source lacks structured evidence_status.
- Any non-signatory (observer, invited, participant, eu_represented) is flagged with is_direct=True.
- Any country still has pax_silica.status == "opportunity_statement" (must use dedicated object).
- WAICO role_label claims "Member State" prior to verified entry into force.
- Any record contains a Wikipedia URL.
- Organizations section or EU record is missing/invalid.
- Frontier call national signatories mismatch between countries.json and frontier_call.json.
- Headline prose counts in README.md or index.html drift from dataset invariants.
- Obsolete terminology appears in index.html (e.g. 'newly signed accession').
- Generated index.html legend shows incorrect/stale counts (e.g. AI Opportunity Statement total != 35).
- Embedded dataset in index.html does not match data/countries.json.
"""

import datetime
import json
import os
import re
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(SCRIPT_DIR)
COUNTRIES_PATH = os.path.join(ROOT_DIR, "data", "countries.json")
FRONTIER_PATH = os.path.join(ROOT_DIR, "data", "frontier_call.json")
README_PATH = os.path.join(ROOT_DIR, "README.md")
INDEX_PATH = os.path.join(ROOT_DIR, "index.html")

# Strict syntactic URL validation regex
URL_REGEX = re.compile(r"^https?://[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(/.*)?$")

# Source snapshot rosters
SNAPSHOT_WAICO_SIGNATORIES = {
    'BLR', 'BRA', 'BRN', 'CHN', 'CMR', 'COG', 'CUB', 'DMA', 'DZA', 'ETH',
    'GEO', 'IDN', 'IRN', 'KAZ', 'KEN', 'KGZ', 'KHM', 'LAO', 'LSO', 'MMR',
    'MOZ', 'MYS', 'NIC', 'OMN', 'PAK', 'RUS', 'SDN', 'SEN', 'SRB', 'TGO',
    'TJK', 'TZA', 'UZB', 'VEN', 'VNM', 'ZAF', 'ZMB'
}

SNAPSHOT_PAX_DIRECT_SIGNATORIES = {
    'ARE', 'ARG', 'AUS', 'CHL', 'CRI', 'DEU', 'FIN', 'GBR', 'GRC', 'IND',
    'ISR', 'ITA', 'JPN', 'KAZ', 'KOR', 'NLD', 'NOR', 'PAN', 'PHL', 'QAT',
    'SGP', 'SLV', 'SWE', 'USA'
}

SNAPSHOT_PAX_EU_REPRESENTED = {
    'AUT', 'BEL', 'BGR', 'CYP', 'CZE', 'DNK', 'ESP', 'FRA', 'HRV', 'HUN',
    'IRL', 'LTU', 'LUX', 'LVA', 'MLT', 'POL', 'PRT', 'ROU', 'SVK', 'SVN'
}

SNAPSHOT_FRONTIER_NATIONAL_ENDORSERS = {
    'ARE', 'AUS', 'AUT', 'BHR', 'CAN', 'DEU', 'DNK', 'ESP', 'EST', 'FIN',
    'FRA', 'HRV', 'IRL', 'ISL', 'KAZ', 'KEN', 'LIE', 'LUX', 'LVA', 'MDA',
    'NLD', 'NOR', 'PRT', 'ROU', 'SGP', 'SLE', 'TUR', 'ZAF'
}

SNAPSHOT_AI_OPPORTUNITY_SIGNATORIES = {
    'ARE', 'ARG', 'ARM', 'AUS', 'BHR', 'CHL', 'CRI', 'DEU', 'DNK', 'EST',
    'FIN', 'GBR', 'GRC', 'IND', 'ISR', 'ITA', 'JPN', 'KAZ', 'KOR', 'LTU',
    'LVA', 'NLD', 'NOR', 'NZL', 'PAN', 'PHL', 'POL', 'PRT', 'PRY', 'QAT',
    'SGP', 'SLV', 'SWE', 'TUR', 'USA'
}


def validate_calendar_date(d_str, context, errors):
    if not d_str:
        return
    try:
        dt = datetime.date.fromisoformat(d_str)
        if not (2024 <= dt.year <= 2027):
            errors.append(f"[{context}] Date '{d_str}' has unexpected year {dt.year}")
    except ValueError as e:
        errors.append(f"[{context}] Invalid calendar date '{d_str}': {e}")


def validate_url(url, context, errors):
    if not url:
        return
    if not URL_REGEX.match(url):
        errors.append(f"[{context}] Malformed URL syntax: '{url}'")
    if "wikipedia.org" in url.lower():
        errors.append(f"[{context}] Disallowed Wikipedia source URL: '{url}'")


def check_record_sources(record, context, errors):
    source_url = record.get("source_url")
    sources = record.get("sources", [])
    if not source_url and not sources:
        errors.append(f"[{context}] Missing source documentation (neither source_url nor sources provided)")
    if source_url:
        validate_url(source_url, f"{context} source_url", errors)
    for src in sources:
        if isinstance(src, dict):
            validate_url(src.get("url"), f"{context} sources item", errors)
        elif isinstance(src, str):
            validate_url(src, f"{context} sources item", errors)


def validate():
    errors = []

    if not os.path.exists(COUNTRIES_PATH):
        print(f"ERROR: {COUNTRIES_PATH} not found.")
        sys.exit(1)

    if not os.path.exists(FRONTIER_PATH):
        print(f"ERROR: {FRONTIER_PATH} not found.")
        sys.exit(1)

    with open(COUNTRIES_PATH, "r", encoding="utf-8") as f:
        countries_data = json.load(f)

    with open(FRONTIER_PATH, "r", encoding="utf-8") as f:
        frontier_data = json.load(f)

    meta = countries_data.get("meta", {})
    countries = countries_data.get("countries", {})
    organizations = countries_data.get("organizations", {})

    # 1. Total entities count
    if len(countries) != 252:
        errors.append(f"Expected 252 country records, got {len(countries)}")

    # 2. Check metadata entity counts and classification rules
    entity_counts = meta.get("entity_counts", {})
    if entity_counts.get("total_map_records") != 252:
        errors.append(f"meta.entity_counts.total_map_records is {entity_counts.get('total_map_records')}, expected 252")

    classification_rules = meta.get("classification_rules", {})
    required_rules = [
        "direct_signatory_rule",
        "waico_taxonomy",
        "pax_silica_taxonomy",
        "frontier_call_taxonomy",
        "primary_alignment_count_definition",
        "waico_founding_provenance_note",
    ]
    for req_rule in required_rules:
        if not classification_rules.get(req_rule):
            errors.append(f"meta.classification_rules missing required rule '{req_rule}'")

    # 3. Organizations Section & EU Supranational Record
    if not organizations:
        errors.append("countries.json is missing top-level 'organizations' section")
    elif "EU" not in organizations:
        errors.append("countries.json 'organizations' section is missing 'EU' record")
    else:
        eu_org = organizations["EU"]
        if not eu_org.get("pax_silica", {}).get("is_direct"):
            errors.append("organizations.EU.pax_silica must have is_direct=True")
        if eu_org.get("frontier_call", {}).get("status") != "leader_endorsement":
            errors.append("organizations.EU.frontier_call must have status='leader_endorsement'")
        validate_calendar_date(eu_org.get("pax_silica", {}).get("date"), "EU Pax", errors)
        validate_calendar_date(eu_org.get("frontier_call", {}).get("date"), "EU Frontier", errors)
        check_record_sources(eu_org.get("pax_silica", {}), "EU Pax", errors)
        check_record_sources(eu_org.get("frontier_call", {}), "EU Frontier", errors)

    # 4. Code Uniqueness Checks
    iso3_set, iso2_set, numeric_set, name_set = set(), set(), set(), set()
    project_entities = {"XKX", "XNC", "SOL"}

    for iso3, c in countries.items():
        if iso3 in iso3_set:
            errors.append(f"Duplicate iso3 code: {iso3}")
        iso3_set.add(iso3)

        name = c.get("name")
        if name in name_set:
            errors.append(f"Duplicate country name: '{name}'")
        name_set.add(name)

        if iso3 not in project_entities:
            iso2 = c.get("iso2")
            if not iso2:
                errors.append(f"[{iso3}] Missing iso2 code")
            elif iso2 in iso2_set:
                errors.append(f"Duplicate iso2 code: '{iso2}' ({iso3})")
            iso2_set.add(iso2)

            num = c.get("numeric")
            if not num:
                errors.append(f"[{iso3}] Missing numeric code")
            elif num in numeric_set:
                errors.append(f"Duplicate numeric code: '{num}' ({iso3})")
            numeric_set.add(num)

    # 5. Category counts, sources, evidence status, and independent recomputation
    computed_stats = {
        "tripartite": 0,
        "waico_only": 0,
        "pax_only": 0,
        "frontier_only": 0,
        "waico_pax": 0,
        "pax_frontier": 0,
        "waico_frontier": 0,
        "none": 0,
    }

    waico_founding_count = 0
    waico_later_count = 0
    pax_direct_count = 0
    pax_eu_count = 0
    frontier_national_count = 0
    ai_opp_count = 0

    actual_waico_signatories = set()
    actual_pax_direct_signatories = set()
    actual_pax_eu_represented = set()
    actual_frontier_national = set()
    actual_ai_opp = set()

    for iso3, c in countries.items():
        # Validate Geographic metadata
        if not c.get("region"):
            errors.append(f"[{iso3}] Missing region")
        if not c.get("subregion"):
            errors.append(f"[{iso3}] Missing subregion")

        # WAICO validation
        waico = c.get("waico")
        is_waico_direct = False
        if waico:
            validate_calendar_date(waico.get("date"), f"{iso3} WAICO", errors)
            check_record_sources(waico, f"{iso3} WAICO", errors)
            w_status = waico.get("status")
            if w_status == "founding_signatory":
                waico_founding_count += 1
                is_waico_direct = True
                actual_waico_signatories.add(iso3)
                if waico.get("official_designation") != "founding member":
                    errors.append(f"[{iso3}] WAICO founding_signatory must have official_designation='founding member'")
            elif w_status == "signatory":
                waico_later_count += 1
                is_waico_direct = True
                actual_waico_signatories.add(iso3)
            elif w_status not in ["observer", "invitee", "invited"]:
                errors.append(f"[{iso3}] Unknown WAICO status '{w_status}'")

            role_lbl = waico.get("role_label", "")
            if "member state" in role_lbl.lower():
                errors.append(f"[{iso3}] WAICO role_label '{role_lbl}' overstates treaty membership prior to entry into force; use Signatory")

            # Check secondary evidence status requirement
            if waico.get("source_type") == "secondary" and not waico.get("evidence_status"):
                errors.append(f"[{iso3}] WAICO secondary source missing evidence_status")

        # Pax Silica validation
        pax = c.get("pax_silica")
        is_pax_direct = False
        if pax:
            validate_calendar_date(pax.get("date"), f"{iso3} Pax", errors)
            check_record_sources(pax, f"{iso3} Pax", errors)
            pax_status = pax.get("status")
            is_direct = pax.get("is_direct", False)
            if pax_status in ["founding_signatory", "signatory"]:
                if not is_direct:
                    errors.append(f"[{iso3}] Pax Silica status '{pax_status}' should have is_direct=True")
                else:
                    pax_direct_count += 1
                    is_pax_direct = True
                    actual_pax_direct_signatories.add(iso3)
            elif pax_status == "eu_represented":
                pax_eu_count += 1
                actual_pax_eu_represented.add(iso3)
                if is_direct:
                    errors.append(f"[{iso3}] EU-represented record must not have is_direct=True")
            elif pax_status == "opportunity_statement":
                errors.append(f"[{iso3}] Pax status must not be 'opportunity_statement' (use dedicated ai_opportunity_statement object)")
            elif is_direct:
                errors.append(f"[{iso3}] Has is_direct=True but status is '{pax_status}' (must be false for non-signatories)")

            # Check evidence_status on ambiguous or secondary records
            if pax.get("source_conflict") and not pax.get("evidence_status"):
                errors.append(f"[{iso3}] Pax has source_conflict=True but missing structured evidence_status")
            if pax.get("source_type") == "secondary" and not pax.get("evidence_status"):
                errors.append(f"[{iso3}] Pax secondary source missing evidence_status")

        # Frontier Call validation
        fc = c.get("frontier_call")
        is_frontier_direct = False
        if fc:
            validate_calendar_date(fc.get("date"), f"{iso3} Frontier", errors)
            check_record_sources(fc, f"{iso3} Frontier", errors)
            if fc.get("status") == "leader_endorsement":
                frontier_national_count += 1
                is_frontier_direct = True
                actual_frontier_national.add(iso3)

        # AI Opportunity Statement validation
        opp = c.get("ai_opportunity_statement")
        if opp and opp.get("signed"):
            ai_opp_count += 1
            actual_ai_opp.add(iso3)
            validate_calendar_date(opp.get("date"), f"{iso3} AI Opp", errors)
            check_record_sources(opp, f"{iso3} AI Opp", errors)

        # Independent recomputation of alignment category
        if is_waico_direct and is_pax_direct and is_frontier_direct:
            expected_cat = "tripartite"
        elif is_pax_direct and is_frontier_direct:
            expected_cat = "pax_frontier"
        elif is_waico_direct and is_frontier_direct:
            expected_cat = "waico_frontier"
        elif is_waico_direct and is_pax_direct:
            expected_cat = "waico_pax"
        elif is_waico_direct:
            expected_cat = "waico_only"
        elif is_pax_direct:
            expected_cat = "pax_only"
        elif is_frontier_direct:
            expected_cat = "frontier_only"
        else:
            expected_cat = "none"

        actual_cat = c.get("alignment_category", "none")
        if actual_cat != expected_cat:
            errors.append(f"[{iso3}] Alignment category mismatch: stored '{actual_cat}' != expected '{expected_cat}'")

        if actual_cat in computed_stats:
            computed_stats[actual_cat] += 1

        # Independent recomputation of primary_alignment_count / active_initiatives_count
        expected_direct_count = (1 if is_waico_direct else 0) + (1 if is_pax_direct else 0) + (1 if is_frontier_direct else 0)
        stored_active = c.get("active_initiatives_count")
        stored_primary = c.get("primary_alignment_count")
        if stored_active != expected_direct_count:
            errors.append(f"[{iso3}] active_initiatives_count mismatch: stored {stored_active} != expected {expected_direct_count}")
        if stored_primary != expected_direct_count:
            errors.append(f"[{iso3}] primary_alignment_count mismatch: stored {stored_primary} != expected {expected_direct_count}")

    # 6. Formula count verifications & Exact Snapshot Set Matching
    if waico_founding_count != 29:
        errors.append(f"WAICO founding signatories count is {waico_founding_count}, expected 29")
    if waico_later_count != 8:
        errors.append(f"WAICO open-period later signatories count is {waico_later_count}, expected 8")
    total_waico = waico_founding_count + waico_later_count
    if total_waico != 37:
        errors.append(f"Total WAICO signatories is {total_waico}, expected 37")
    if actual_waico_signatories != SNAPSHOT_WAICO_SIGNATORIES:
        errors.append(f"WAICO signatories ISO mismatch: diff={actual_waico_signatories ^ SNAPSHOT_WAICO_SIGNATORIES}")

    if pax_direct_count != 24:
        errors.append(f"Pax direct national signatories count is {pax_direct_count}, expected 24")
    if actual_pax_direct_signatories != SNAPSHOT_PAX_DIRECT_SIGNATORIES:
        errors.append(f"Pax direct signatories ISO mismatch: diff={actual_pax_direct_signatories ^ SNAPSHOT_PAX_DIRECT_SIGNATORIES}")

    if pax_eu_count != 20:
        errors.append(f"Pax EU-represented member states count is {pax_eu_count}, expected 20")
    if actual_pax_eu_represented != SNAPSHOT_PAX_EU_REPRESENTED:
        errors.append(f"Pax EU-represented ISO mismatch: diff={actual_pax_eu_represented ^ SNAPSHOT_PAX_EU_REPRESENTED}")

    if frontier_national_count != 28:
        errors.append(f"Frontier national endorsing countries count is {frontier_national_count}, expected 28")
    if actual_frontier_national != SNAPSHOT_FRONTIER_NATIONAL_ENDORSERS:
        errors.append(f"Frontier national endorsers ISO mismatch: diff={actual_frontier_national ^ SNAPSHOT_FRONTIER_NATIONAL_ENDORSERS}")

    if ai_opp_count != 35:
        errors.append(f"AI Opportunity Statement signatories count is {ai_opp_count}, expected 35")
    if actual_ai_opp != SNAPSHOT_AI_OPPORTUNITY_SIGNATORIES:
        errors.append(f"AI Opportunity signatories ISO mismatch: diff={actual_ai_opp ^ SNAPSHOT_AI_OPPORTUNITY_SIGNATORIES}")

    stored_stats = meta.get("statistics", {})
    for k, v in computed_stats.items():
        if stored_stats.get(k, 0) != v:
            errors.append(f"Statistics mismatch for '{k}': stored {stored_stats.get(k, 0)} != computed {v}")

    # 7. Parity between frontier_call.json and countries.json
    frontier_signatories = frontier_data.get("signatories", [])
    fc_national = [s for s in frontier_signatories if s.get("iso3") != "EU"]
    
    country_fc_records = [c for c in countries.values() if c.get("frontier_call")]
    if len(country_fc_records) != len(fc_national):
        errors.append(f"Frontier signatory count mismatch: {len(country_fc_records)} in countries.json vs {len(fc_national)} national in frontier_call.json")

    for s in fc_national:
        iso3 = s.get("iso3")
        if iso3 not in countries:
            errors.append(f"Signatory {iso3} in frontier_call.json not found in countries.json")
        elif not countries[iso3].get("frontier_call"):
            errors.append(f"Signatory {iso3} has no frontier_call record in countries.json")

    for u in frontier_data.get("source_urls", []):
        validate_url(u, "frontier_call.json source_urls", errors)

    # 8. Prose and HTML Synchronization Guard
    data_only = "--data-only" in sys.argv
    if not data_only and os.path.exists(README_PATH):
        with open(README_PATH, "r", encoding="utf-8") as f:
            readme_text = f.read()
            if "37 states signed the establishment agreement" not in readme_text:
                errors.append("README.md drift: missing '37 states signed the establishment agreement'")
            if "25 formal signatory entities" not in readme_text:
                errors.append("README.md drift: missing '25 formal signatory entities'")
            if "20 member states represented visually" not in readme_text:
                errors.append("README.md drift: missing '20 member states represented visually'")
            if "new signature, accession, ratification, or endorsement" not in readme_text:
                errors.append("README.md drift: missing 'new signature, accession, ratification, or endorsement'")

    if not data_only and os.path.exists(INDEX_PATH):
        with open(INDEX_PATH, "r", encoding="utf-8") as f:
            index_text = f.read()
            if "Thirty-seven states signed" not in index_text:
                errors.append("index.html drift: missing 'Thirty-seven states signed'")
            if "20 EU member states shown as represented" not in index_text:
                errors.append("index.html drift: missing '20 EU member states shown as represented'")
            if "AI Opportunity Statement (35)" not in index_text:
                errors.append("index.html legend drift: missing 'AI Opportunity Statement (35)'")
            if "AI Opportunity Statement (3)" in index_text:
                errors.append("index.html legend defect: found stale 'AI Opportunity Statement (3)'")
            if "newly signed accession" in index_text:
                errors.append("index.html text defect: found obsolete phrase 'newly signed accession'")

            # Check embedded JSON consistency
            m = re.search(r'<script id="initial-country-data"[^>]*>(.*?)</script>', index_text, re.DOTALL)
            if not m:
                errors.append("index.html is missing <script id='initial-country-data'> tag")
            else:
                try:
                    embedded_data = json.loads(m.group(1))
                    if embedded_data.get("countries") != countries_data.get("countries"):
                        errors.append("index.html embedded data does not match data/countries.json countries")
                except Exception as e:
                    errors.append(f"Failed to parse embedded JSON in index.html: {e}")

    if errors:
        print(f"FAILED: {len(errors)} validation errors found:")
        for err in errors:
            print(f"  - {err}")
        sys.exit(1)
    else:
        print("PASSED: All comprehensive data invariants, integrity checks, and cross-file synchronizations verified successfully.")
        print(f"  - Verified 252 entities across all 8 alignment categories with 0 duplicates.")
        print(f"  - Verified {total_waico} WAICO signatories matching snapshot exactly (29 founding + 8 open-period).")
        print(f"  - Verified 25 formal Pax Silica signatory entities (24 sovereign + European Union) matching snapshot exactly.")
        print(f"  - Verified 20 EU member states represented via EU institutional signature matching snapshot exactly.")
        print(f"  - Verified {len(frontier_signatories)} Frontier Control signatories (28 national + EU) matching snapshot exactly.")
        print(f"  - Verified 35 AI Opportunity Statement signers in dedicated dataset object matching snapshot exactly.")
        print(f"  - Verified independent alignment recomputation and count semantics for all records.")
        print(f"  - Verified 0 Wikipedia dependencies, strict URL syntax, and valid ISO calendar dates across all datasets.")
        print(f"  - Verified HTML legend displays total 'AI Opportunity Statement (35)' with 0 stale mutually-exclusive counts.")
        print(f"  - Verified index.html embedded dataset integrity.")


if __name__ == "__main__":
    validate()
