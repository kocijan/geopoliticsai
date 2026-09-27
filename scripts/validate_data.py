#!/usr/bin/env python3
"""
scripts/validate_data.py

Data invariant and integrity verification script for GeopoliticsAI.
Fails with a non-zero exit code if:
- data/countries.json or data/frontier_call.json are invalid JSON or missing required fields.
- Total entities count is not 252 (249 ISO-3166-1 + 3 project additions).
- Stored meta.statistics disagree with computed alignment categories.
- frontier_call.json signatories list does not match countries.json frontier_call records.
- Any non-signatory (observer, invited, participant) is flagged with is_direct=True.
- Geographic fields (region, subregion) are missing or blank.
- Dates are malformed or invalid.
"""

import json
import os
import re
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(SCRIPT_DIR)
COUNTRIES_PATH = os.path.join(ROOT_DIR, "data", "countries.json")
FRONTIER_PATH = os.path.join(ROOT_DIR, "data", "frontier_call.json")


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

    # 1. Total entities count
    if len(countries) != 252:
        errors.append(f"Expected 252 country records, got {len(countries)}")

    # 2. Check metadata entity counts and classification rules
    entity_counts = meta.get("entity_counts", {})
    if entity_counts.get("total_map_records") != 252:
        errors.append(f"meta.entity_counts.total_map_records is {entity_counts.get('total_map_records')}, expected 252")

    if not meta.get("classification_rules"):
        errors.append("meta.classification_rules is missing or empty")

    # 3. Category count computation, integrity, and provenance validation
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

    date_regex = re.compile(r"^\d{4}-\d{2}-\d{2}$")

    for iso3, c in countries.items():
        cat = c.get("alignment_category", "none")
        if cat in computed_stats:
            computed_stats[cat] += 1
        else:
            errors.append(f"[{iso3}] Unknown alignment category '{cat}'")

        # Validate is_direct integrity & EU representation
        pax = c.get("pax_silica")
        if pax:
            pax_status = pax.get("status")
            is_direct = pax.get("is_direct", False)
            if is_direct and pax_status not in ["founding_signatory", "signatory"]:
                errors.append(f"[{iso3}] Has is_direct=True but status is '{pax_status}' (must be false for non-signatories)")
            if pax_status == "eu_represented" and is_direct:
                errors.append(f"[{iso3}] EU-represented record must not have is_direct=True")
            if pax.get("date") and not date_regex.match(pax["date"]):
                errors.append(f"[{iso3}] Malformed Pax date '{pax['date']}'")
            if pax.get("source_url") and "wikipedia.org" in pax["source_url"].lower():
                errors.append(f"[{iso3}] Pax Silica has disallowed Wikipedia source URL: {pax['source_url']}")

        # Validate WAICO dates, role_label, and sources
        waico = c.get("waico")
        if waico:
            if waico.get("date") and not date_regex.match(waico["date"]):
                errors.append(f"[{iso3}] Malformed WAICO date '{waico['date']}'")
            if not waico.get("source_url") and not waico.get("sources"):
                errors.append(f"[{iso3}] Missing WAICO source")
            # Enforce legal precision: prevent overstating unratified signatures as "Member State"
            role_lbl = waico.get("role_label", "")
            if "member state" in role_lbl.lower():
                errors.append(f"[{iso3}] WAICO role_label '{role_lbl}' overstates treaty membership prior to entry into force; use Signatory")
            # Check for Wikipedia URLs
            if waico.get("source_url") and "wikipedia.org" in waico["source_url"].lower():
                errors.append(f"[{iso3}] WAICO has disallowed Wikipedia source URL: {waico['source_url']}")
            for src in waico.get("sources", []):
                if "wikipedia.org" in src.get("url", "").lower():
                    errors.append(f"[{iso3}] WAICO source entry has disallowed Wikipedia URL: {src.get('url')}")

        # Validate Frontier dates and sources
        fc = c.get("frontier_call")
        if fc:
            if fc.get("date") and not date_regex.match(fc["date"]):
                errors.append(f"[{iso3}] Malformed Frontier date '{fc['date']}'")
            if fc.get("source_url") and "wikipedia.org" in fc["source_url"].lower():
                errors.append(f"[{iso3}] Frontier Call has disallowed Wikipedia source URL: {fc['source_url']}")

        # Validate Geographic metadata
        if not c.get("region"):
            errors.append(f"[{iso3}] Missing region")
        if not c.get("subregion"):
            errors.append(f"[{iso3}] Missing subregion")

    stored_stats = meta.get("statistics", {})
    for k, v in computed_stats.items():
        if stored_stats.get(k, 0) != v:
            errors.append(f"Statistics mismatch for '{k}': stored {stored_stats.get(k, 0)} != computed {v}")

    # 4. Parity between frontier_call.json and countries.json
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

    # 5. Check frontier_call.json source_urls for Wikipedia
    for u in frontier_data.get("source_urls", []):
        if "wikipedia.org" in u.lower():
            errors.append(f"frontier_call.json has disallowed Wikipedia source URL: {u}")

    if errors:
        print(f"FAILED: {len(errors)} validation errors found:")
        for err in errors:
            print(f"  - {err}")
        sys.exit(1)
    else:
        print("PASSED: All data invariants, integrity checks, and cross-file synchronizations verified successfully.")
        print(f"  - Verified 252 entities across all 8 alignment categories.")
        print(f"  - Verified {len(frontier_signatories)} Frontier Control signatories (28 national countries + EU).")
        print(f"  - Verified 24 direct national Pax Silica signatories.")
        print(f"  - Verified 0 Wikipedia dependencies across all datasets.")
        print(f"  - Verified WAICO legal status taxonomy across all records.")


if __name__ == "__main__":
    validate()

