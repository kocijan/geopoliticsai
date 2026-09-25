#!/usr/bin/env python3
"""
Informative Diagnostic and Comparison Report Script.

Compares current Wikipedia wikitext against the verified local data/countries.json database.
This script is strictly read-only: it does NOT modify or overwrite any project files.
It is intended for manual discrepancy analysis and fact-checking, NOT as part of the
automated GitHub Actions deployment pipeline.
"""

import json
import os
import re
import sys
import urllib.request

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
COUNTRIES_PATH = os.path.join(DATA_DIR, "countries.json")

def fetch_wikitext(page_title):
    url = f"https://en.wikipedia.org/w/api.php?action=parse&page={page_title}&prop=wikitext&format=json"
    req = urllib.request.Request(url, headers={"User-Agent": "GeopoliticsAI-Auditor/1.0 (https://geopoliticsai.com)"})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data["parse"]["wikitext"]["*"]
    except Exception as e:
        print(f"  [Notice] Could not fetch '{page_title}' live from Wikipedia API: {e}")
        return None

def parse_waico_wikitext(wikitext):
    """Extracts country names mentioned in membership sections of WAICO Wikipedia page."""
    found_countries = set()
    if not wikitext:
        return found_countries
    
    # Check for flag templates: {{flag|Country}} or {{flagcountry|Country}}
    flag_matches = re.findall(r"\{\{flag(?:country)?\|([^\}]+)\}\}", wikitext, re.IGNORECASE)
    for m in flag_matches:
        name = m.split("|")[0].strip()
        if name:
            found_countries.add(name)
    return found_countries

def parse_pax_wikitext(wikitext):
    """Extracts country names mentioned in Pax Silica Wikipedia page."""
    found_countries = set()
    if not wikitext:
        return found_countries

    flag_matches = re.findall(r"\{\{flag(?:country)?\|([^\}]+)\}\}", wikitext, re.IGNORECASE)
    for m in flag_matches:
        name = m.split("|")[0].strip()
        if name:
            found_countries.add(name)
    return found_countries

def main():
    print("=" * 70)
    print(" GeopoliticsAI — Wikipedia Discrepancy & Comparison Report")
    print(" Note: This is an informative diagnostic tool; it makes NO changes to data.")
    print("=" * 70)

    if not os.path.exists(COUNTRIES_PATH):
        print(f"Error: {COUNTRIES_PATH} not found.")
        sys.exit(1)

    with open(COUNTRIES_PATH, "r", encoding="utf-8") as f:
        db = json.load(f)

    countries = db.get("countries", {})
    if isinstance(countries, dict):
        countries_list = list(countries.values())
    else:
        countries_list = countries

    print(f"\nLoaded local database: {len(countries_list)} sovereign states and territories.\n")

    # 1. Compare WAICO
    print("-" * 70)
    print("1. WAICO (World Artificial Intelligence Cooperation Organization)")
    print("-" * 70)
    
    local_waico_full = {c["name"]: c for c in countries_list if c.get("waico") and c["waico"]["status"] in ["founding_member", "signatory"]}
    local_waico_obs = {c["name"]: c for c in countries_list if c.get("waico") and c["waico"]["status"] == "observer"}
    local_waico_inv = {c["name"]: c for c in countries_list if c.get("waico") and c["waico"]["status"] in ["invitee", "invited"]}
    
    print(f"  Local Database:")
    print(f"    - Full Members/Signatories : {len(local_waico_full)}")
    print(f"    - Observers               : {len(local_waico_obs)} ({', '.join(local_waico_obs.keys())})")
    print(f"    - Invitees                : {len(local_waico_inv)} ({', '.join(local_waico_inv.keys())})")

    waico_wiki = fetch_wikitext("World_Artificial_Intelligence_Cooperation_Organization")
    if waico_wiki:
        wiki_waico_names = parse_waico_wikitext(waico_wiki)
        print(f"  Wikipedia page entities found: {len(wiki_waico_names)}")
        
        # Check if any local members missing from wiki
        missing_on_wiki = [name for name in local_waico_full if not any(w.lower() in name.lower() or name.lower() in w.lower() for w in wiki_waico_names)]
        if missing_on_wiki:
            print(f"  [Info] Local members not matched by simple flag check on Wikipedia: {', '.join(missing_on_wiki)}")
        else:
            print("  [OK] All local full WAICO members matched on Wikipedia page.")
    else:
        print("  [Info] Skipping live Wikipedia parse (network offline or page moved).")

    # 2. Compare Pax Silica
    print("\n" + "-" * 70)
    print("2. Pax Silica Declaration")
    print("-" * 70)
    
    local_pax_direct = {c["name"]: c for c in countries_list if c.get("pax_silica") and c["pax_silica"]["status"] in ["founding_signatory", "signatory"] and c["pax_silica"].get("is_direct", False)}
    local_pax_eu = {c["name"]: c for c in countries_list if c.get("pax_silica") and c["pax_silica"]["status"] == "eu_represented"}
    local_pax_obs = {c["name"]: c for c in countries_list if c.get("pax_silica") and c["pax_silica"]["status"] == "observer"}
    local_pax_part = {c["name"]: c for c in countries_list if c.get("pax_silica") and c["pax_silica"]["status"] == "participant"}
    local_pax_opp = {c["name"]: c for c in countries_list if c.get("pax_silica") and c["pax_silica"]["status"] == "opportunity_statement"}

    print(f"  Local Database:")
    print(f"    - Direct Sovereign Signatories : {len(local_pax_direct)} (+ European Union)")
    print(f"    - EU-Represented States       : {len(local_pax_eu)}")
    print(f"    - Observers                   : {len(local_pax_obs)} ({', '.join(local_pax_obs.keys())})")
    print(f"    - Non-Signatory Participants  : {len(local_pax_part)} ({', '.join(local_pax_part.keys())})")
    print(f"    - AI Opportunity Signatories  : {len(local_pax_opp)} ({', '.join(local_pax_opp.keys())})")

    pax_wiki = fetch_wikitext("Pax_Silica")
    if pax_wiki:
        wiki_pax_names = parse_pax_wikitext(pax_wiki)
        print(f"  Wikipedia page entities found: {len(wiki_pax_names)}")
    else:
        print("  [Info] Live Wikipedia parse skipped.")

    # 3. Frontier AI Call Summary
    print("\n" + "-" * 70)
    print("3. Call for Control of Frontier AI Models")
    print("-" * 70)
    local_frontier = {c["name"]: c for c in countries_list if c.get("frontier_call") and c["frontier_call"]["status"] == "leader_endorsement"}
    print(f"  Local Database:")
    print(f"    - Sovereign States with Leader Endorsements: {len(local_frontier)} (+ European Commission)")
    
    # 4. Overlap Summary
    tripartite = [c["name"] for c in countries_list if c.get("waico") and c["waico"]["status"] in ["founding_member", "signatory"] and c.get("pax_silica") and c["pax_silica"].get("is_direct") and c.get("frontier_call")]
    print("\n" + "-" * 70)
    print("4. Multi-Initiative Alignments")
    print("-" * 70)
    print(f"  Tripartite All-Three Signatories : {len(tripartite)} ({', '.join(tripartite)})")
    
    print("\n" + "=" * 70)
    print(" Comparison Report Complete.")
    print(" No changes were made to data/countries.json.")
    print("=" * 70 + "\n")

if __name__ == "__main__":
    main()
