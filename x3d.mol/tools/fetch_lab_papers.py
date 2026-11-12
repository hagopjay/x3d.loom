#!/usr/bin/env python3 -I
"""Public bibliographic record for the credit panel: the Michel lab's published papers on the proteins in this catalogue.

  python3 -I tools/fetch_lab_papers.py data/credits/lab-papers.json

Source: Europe PMC REST search (public metadata: title, authors, journal, year, DOI, PMID). Nothing else about the lab is read.
Query: author "Michel SLJ" with a zinc-finger topic word; entries that are not about the proteins below are dropped by keyword.
"""
import json, re, sys, urllib.parse, urllib.request, datetime

TOPICS = {"TTP": ["tristetraprolin", " ttp"], "ZRANB2": ["zranb2"], "YY1": ["yin-yang", "yy1"], "PARP1": ["parp1", "poly-adp-ribose polymerase 1"],
          "CPSF30": ["cpsf30"], "zinc finger proteins": ["zinc finger", "zinc-finger"]}
q = 'AUTH:"Michel SLJ" AND (zinc OR tristetraprolin OR CPSF30 OR ZRANB2 OR PARP1)'
url = "https://www.ebi.ac.uk/europepmc/webservices/rest/search?" + urllib.parse.urlencode({"query": q, "format": "json", "pageSize": 100, "resultType": "core"})
data = json.load(urllib.request.urlopen(url, timeout=40))
out = []
for r in data["resultList"]["result"]:
    t = (r.get("title") or "").rstrip(".")
    low = " " + t.lower()
    tags = [k for k, words in TOPICS.items() if any(w in low for w in words)]
    if not tags or "Michel" not in (r.get("authorString") or ""):
        continue
    out.append({"title": re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", t.replace("&lt;", "<").replace("&gt;", ">"))).strip(),
                "authors": r.get("authorString"), "journal": r.get("journalTitle"), "year": r.get("pubYear"), "doi": r.get("doi"), "pmid": r.get("pmid"), "proteins": tags})
out.sort(key=lambda x: (-int(x["year"] or 0), x["title"]))
json.dump({"source": "Europe PMC REST search, public metadata", "retrieved": datetime.date.today().isoformat(), "query": q, "papers": out}, open(sys.argv[1], "w"), indent=1, ensure_ascii=False)
print(len(out), "papers")
for p in out: print(p["year"], p["proteins"], p["title"][:90])
