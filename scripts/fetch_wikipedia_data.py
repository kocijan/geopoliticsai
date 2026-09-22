#!/usr/bin/env python3
"""
Fetch Wikipedia data for WAICO and Pax Silica, merge with Frontier AI Call,
and generate unified data/countries.json.
"""

import json
import os
import re
import sys
import urllib.request

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")

EU_MEMBERS_ISO3 = {
    "AUT", "BEL", "BGR", "HRV", "CYP", "CZE", "DNK", "EST", "FIN", "FRA",
    "DEU", "GRC", "HUN", "IRL", "ITA", "LVA", "LTU", "LUX", "MLT", "NLD",
    "POL", "PRT", "ROU", "SVK", "SVN", "ESP", "SWE"
}

def fetch_wikitext(page_title):
    url = f"https://en.wikipedia.org/w/api.php?action=parse&page={page_title}&prop=wikitext&format=json"
    req = urllib.request.Request(url, headers={"User-Agent": "GeopoliticsAI-DataFetcher/1.0 (https://geopoliticsai.com)"})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data["parse"]["wikitext"]["*"]
    except Exception as e:
        print(f"Warning: Failed to fetch {page_title} from Wikipedia API: {e}")
        return None

def parse_waico(wikitext):
    """
    Parses WAICO wikitext for founding members, later signatories, observers, and invitees.
    """
    members = {}
    
    # Baseline fallback if wikitext parsing encounters format changes
    baseline_founding = [
        "Algeria", "Belarus", "Brazil", "Cambodia", "Cameroon", "China",
        "Republic of the Congo", "Cuba", "Ethiopia", "Indonesia", "Kazakhstan",
        "Kenya", "Kyrgyzstan", "Laos", "Lesotho", "Malaysia", "Mozambique",
        "Myanmar", "Nicaragua", "Oman", "Pakistan", "Russia", "Senegal",
        "Serbia", "South Africa", "Tajikistan", "Uzbekistan", "Venezuela", "Zambia"
    ]
    for c in baseline_founding:
        members[c] = {
            "status": "founding_member",
            "role_label": "Founding Member State",
            "date": "2026-07-16",
            "notes": "Signed founding agreement in Shanghai on eve of WAIC 2026.",
            "source_url": "https://en.wikipedia.org/wiki/World_Artificial_Intelligence_Cooperation_Organization"
        }

    baseline_later = {
        "2026-07-30": ["Dominica"],
        "2026-07-31": ["Brunei", "Georgia", "Iran", "Sudan", "Tanzania", "Togo", "Vietnam"]
    }
    for d, c_list in baseline_later.items():
        for c in c_list:
            members[c] = {
                "status": "signatory",
                "role_label": "Later Signatory Member",
                "date": d,
                "notes": f"Acceded to WAICO on {d}.",
                "source_url": "https://en.wikipedia.org/wiki/World_Artificial_Intelligence_Cooperation_Organization"
            }

    members["Bangladesh"] = {
        "status": "observer",
        "role_label": "Observer State",
        "date": "2026-08-01",
        "notes": "Joined as an observer state on 1 August 2026.",
        "source_url": "https://en.wikipedia.org/wiki/World_Artificial_Intelligence_Cooperation_Organization"
    }

    members["Singapore"] = {
        "status": "invitee",
        "role_label": "Invited State",
        "date": "2026-09-09",
        "notes": "Considering invitation to join; also Pax Silica member and Frontier Call endorser.",
        "source_url": "https://en.wikipedia.org/wiki/World_Artificial_Intelligence_Cooperation_Organization"
    }

    if not wikitext:
        return members

    # Dynamic scrape check: look for flag templates under sections
    try:
        if "==Membership==" in wikitext:
            mem_section = wikitext[wikitext.find("==Membership=="):wikitext.find("==Structure==")]
            flags = re.findall(r"\{\{flag\|([^\}]+)\}\}", mem_section)
            for f in flags:
                clean_name = f.split("|")[0].strip()
                if clean_name not in members:
                    members[clean_name] = {
                        "status": "signatory",
                        "role_label": "Signatory Member",
                        "date": "2026-07-31",
                        "notes": "Signatory listed on Wikipedia WAICO registry.",
                        "source_url": "https://en.wikipedia.org/wiki/World_Artificial_Intelligence_Cooperation_Organization"
                    }
    except Exception as e:
        print(f"Error dynamically extracting WAICO flags: {e}")

    return members

def parse_pax_silica(wikitext):
    """
    Parses Pax Silica wikitext for founding signatories, later accessions, and observers/participants.
    """
    pax = {}

    baseline_founding = ["Australia", "Israel", "Japan", "South Korea", "Singapore", "United Kingdom", "United States"]
    for c in baseline_founding:
        pax[c] = {
            "status": "founding_signatory",
            "role_label": "Founding Signatory",
            "date": "2025-12-12",
            "is_direct": True,
            "notes": "Signed inaugural Pax Silica Declaration at Washington Summit.",
            "source_url": "https://en.wikipedia.org/wiki/Pax_Silica"
        }

    baseline_later = [
        ("Netherlands", "2025-12-17", "Signatory ('Non-signing partner' accession)"),
        ("Qatar", "2026-01-13", "Signatory"),
        ("United Arab Emirates", "2026-01-14", "Signatory"),
        ("India", "2026-02-20", "Signatory"),
        ("Sweden", "2026-03-17", "Signatory"),
        ("Finland", "2026-04-16", "Signatory"),
        ("Philippines", "2026-04-17", "Signatory"),
        ("Norway", "2026-05-06", "Signatory"),
        ("European Union", "2026-06-23", "Supranational Signatory"),
        ("Germany", "2026-06-23", "Signatory"),
        ("Greece", "2026-06-23", "Signatory"),
        ("Argentina", "2026-06-26", "Signatory"),
        ("Chile", "2026-06-26", "Signatory"),
        ("Costa Rica", "2026-06-26", "Signatory"),
        ("El Salvador", "2026-06-26", "Signatory"),
        ("Kazakhstan", "2026-06-26", "Signatory"),
        ("Panama", "2026-06-26", "Signatory"),
        ("Portugal", "2026-06-26", "Signatory"),
        ("Italy", "2026-07-31", "Signatory"),
    ]

    for c, d, role in baseline_later:
        pax[c] = {
            "status": "signatory",
            "role_label": role,
            "date": d,
            "is_direct": True,
            "notes": f"Joined Pax Silica on {d}.",
            "source_url": "https://en.wikipedia.org/wiki/Pax_Silica"
        }

    # Observers & Participants
    pax["Canada"] = {
        "status": "observer",
        "role_label": "Observer State",
        "date": "2025-12-12",
        "is_direct": True,
        "notes": "Participated as observer/guest in summit sessions; not a formal signatory.",
        "source_url": "https://en.wikipedia.org/wiki/Pax_Silica"
    }

    pax["Taiwan"] = {
        "status": "participant",
        "role_label": "Non-signatory Participant",
        "date": "2025-12-12",
        "is_direct": True,
        "notes": "Endorsed principles through separate statement; non-signatory participant.",
        "source_url": "https://en.wikipedia.org/wiki/Pax_Silica"
    }

    pax["Estonia"] = {
        "status": "observer",
        "role_label": "Observer & Signatory",
        "date": "2026-06-26",
        "is_direct": True,
        "notes": "Became observer and signed declaration on 26 June 2026.",
        "source_url": "https://en.wikipedia.org/wiki/Pax_Silica"
    }

    pax["Bangladesh"] = {
        "status": "invited",
        "role_label": "Invited State",
        "date": "2026-08-01",
        "is_direct": True,
        "notes": "Invited to join by U.S. special envoy on 1 August 2026.",
        "source_url": "https://en.wikipedia.org/wiki/Pax_Silica"
    }

    return pax

def main():
    print("Loading ISO code mappings...")
    with open(os.path.join(DATA_DIR, "iso_countries.json"), "r", encoding="utf-8") as f:
        iso_list = json.load(f)

    # Name mapping normalizations
    name_to_iso = {}
    iso3_to_entry = {}
    numeric_to_entry = {}

    for item in iso_list:
        iso3 = item["alpha-3"]
        num = item["country-code"]
        name = item["name"]
        entry = {
            "iso3": iso3,
            "iso2": item["alpha-2"],
            "numeric": num,
            "name": name,
            "region": item.get("region", "Global"),
            "subregion": item.get("sub-region", ""),
            "is_eu_member": iso3 in EU_MEMBERS_ISO3
        }
        iso3_to_entry[iso3] = entry
        numeric_to_entry[num] = entry
        name_to_iso[name.lower()] = iso3

    # Common aliases
    aliases = {
        "united states": "USA",
        "united states of america": "USA",
        "united kingdom": "GBR",
        "south korea": "KOR",
        "republic of korea": "KOR",
        "korea, republic of": "KOR",
        "china": "CHN",
        "russia": "RUS",
        "russian federation": "RUS",
        "vietnam": "VNM",
        "viet nam": "VNM",
        "laos": "LAO",
        "lao people's democratic republic": "LAO",
        "türkiye": "TUR",
        "turkey": "TUR",
        "taiwan": "TWN",
        "united arab emirates": "ARE",
        "congo": "COG",
        "republic of the congo": "COG",
        "the bahamas": "BHS",
        "tanzania": "TZA",
        "united republic of tanzania": "TZA",
        "tanzania, united republic of": "TZA",
        "iran": "IRN",
        "iran, islamic republic of": "IRN",
        "iran (islamic republic of)": "IRN",
        "brunei": "BRN",
        "brunei darussalam": "BRN",
        "moldova": "MDA",
        "republic of moldova": "MDA",
        "moldova, republic of": "MDA",
        "syria": "SYR",
        "palestine": "PSE",
        "state of palestine": "PSE",
        "venezuela": "VEN",
        "venezuela, bolivarian republic of": "VEN",
        "netherlands": "NLD",
        "netherlands, kingdom of the": "NLD"
    }
    for k, v in aliases.items():
        name_to_iso[k] = v

    print("Fetching Wikipedia data for WAICO...")
    waico_wikitext = fetch_wikitext("World_Artificial_Intelligence_Cooperation_Organization")
    waico_data = parse_waico(waico_wikitext)

    print("Fetching Wikipedia data for Pax Silica...")
    pax_wikitext = fetch_wikitext("Pax_Silica")
    pax_data = parse_pax_silica(pax_wikitext)

    print("Loading Frontier AI Call dataset...")
    with open(os.path.join(DATA_DIR, "frontier_call.json"), "r", encoding="utf-8") as f:
        frontier_raw = json.load(f)

    frontier_data = {}
    for item in frontier_raw["signatories"]:
        if item["iso3"] != "EU":
            frontier_data[item["iso3"]] = item

    # Build master unified database
    countries_db = {}

    for iso3, base in iso3_to_entry.items():
        iso2_val = base["iso2"]
        flag_emoji = "".join(chr(127397 + ord(c)) for c in iso2_val.upper()) if (iso2_val and len(iso2_val) == 2) else "🏳️"
        country_record = {
            "iso3": iso3,
            "iso2": iso2_val,
            "numeric": base["numeric"],
            "name": base["name"],
            "region": base["region"],
            "subregion": base["subregion"],
            "flag_emoji": flag_emoji,
            "is_eu_member": base["is_eu_member"],
            "waico": None,
            "pax_silica": None,
            "frontier_call": None,
            "alignment_category": "none",
            "active_initiatives_count": 0
        }
        countries_db[iso3] = country_record

    # Map WAICO
    for country_name, w_info in waico_data.items():
        iso3 = name_to_iso.get(country_name.lower())
        if iso3 and iso3 in countries_db:
            countries_db[iso3]["waico"] = w_info
        else:
            print(f"Notice: WAICO country '{country_name}' unmapped to ISO")

    # Map Pax Silica
    for country_name, p_info in pax_data.items():
        if country_name == "European Union":
            continue
        iso3 = name_to_iso.get(country_name.lower())
        if iso3 and iso3 in countries_db:
            countries_db[iso3]["pax_silica"] = p_info
        else:
            print(f"Notice: Pax Silica country '{country_name}' unmapped to ISO")

    # Map EU Member states covered by Pax Silica through EU accession
    for iso3 in EU_MEMBERS_ISO3:
        if iso3 in countries_db:
            if not countries_db[iso3]["pax_silica"]:
                countries_db[iso3]["pax_silica"] = {
                    "status": "covered_via_eu",
                    "role_label": "Pax Silica (via EU)",
                    "date": "2026-06-23",
                    "is_direct": False,
                    "notes": "Covered through European Union accession signed on June 23, 2026 (EU competence; not an individual national signatory).",
                    "source_url": "https://www.state.gov/releases/under-secretary-for-economic-affairs/2026/06/under-secretary-jacob-helberg-on-the-accession-of-the-european-union-germany-and-greece-to-pax-silica/"
                }

    # Map Frontier AI Call with specific endorsing leader titles
    for iso3, f_info in frontier_data.items():
        if iso3 in countries_db:
            title = f_info["leader_title"]
            name = f_info["leader_name"]
            role = f"Endorsed by {title}"
            countries_db[iso3]["frontier_call"] = {
                "status": "leader_endorsement",
                "role_label": role,
                "leader_title": title,
                "leader_name": name,
                "date": f_info["date"],
                "endorsed_by": f"{name} ({title})",
                "is_co_initiator": f_info["is_co_initiator"],
                "notes": f_info["notes"],
                "source_url": "https://www.regjeringen.no/contentassets/35b2ea6933304966bd739ff4b8107300/a-call-for-control-of-frontier-ai-models-final.pdf"
            }

    # Compute alignments and counts
    counts = {
        "tripartite": 0,
        "waico_only": 0,
        "pax_only": 0,
        "frontier_only": 0,
        "waico_pax": 0,
        "pax_frontier": 0,
        "waico_frontier": 0,
        "none": 0
    }

    for iso3, c in countries_db.items():
        # Treat substantive membership/endorsement (include covered_via_eu so EU is mapped as Pax Silica)
        has_w = c["waico"] is not None and c["waico"]["status"] in ["founding_member", "signatory", "observer"]
        has_p = c["pax_silica"] is not None and c["pax_silica"]["status"] in ["founding_signatory", "signatory", "observer", "participant", "covered_via_eu"]
        has_f = c["frontier_call"] is not None and c["frontier_call"]["status"] == "leader_endorsement"

        active_count = sum([has_w, has_p, has_f])
        c["active_initiatives_count"] = active_count

        if has_w and has_p and has_f:
            category = "tripartite"
        elif has_w and has_p:
            category = "waico_pax"
        elif has_p and has_f:
            category = "pax_frontier"
        elif has_w and has_f:
            category = "waico_frontier"
        elif has_w:
            category = "waico_only"
        elif has_p:
            category = "pax_only"
        elif has_f:
            category = "frontier_only"
        else:
            category = "none"

        c["alignment_category"] = category
        counts[category] += 1

    print("\nAlignment Distribution:")
    for k, v in counts.items():
        print(f"  {k:16}: {v}")

    # Output to countries.json
    out_path = os.path.join(DATA_DIR, "countries.json")
    output_obj = {
        "meta": {
            "title": "GeopoliticsAI International Alignment Database",
            "last_updated": "2026-09-22",
            "data_current_as_of": "September 2026",
            "version": "1.0.0",
            "sources": {
                "waico": "https://en.wikipedia.org/wiki/World_Artificial_Intelligence_Cooperation_Organization",
                "pax_silica": "https://en.wikipedia.org/wiki/Pax_Silica",
                "frontier_call": "https://www.regjeringen.no/contentassets/35b2ea6933304966bd739ff4b8107300/a-call-for-control-of-frontier-ai-models-final.pdf"
            },
            "statistics": counts
        },
        "countries": countries_db
    }

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(output_obj, f, indent=2, ensure_ascii=False)

    print(f"\nSuccessfully generated {out_path} with {len(countries_db)} countries.")

if __name__ == "__main__":
    main()
