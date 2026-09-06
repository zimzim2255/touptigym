# -*- coding: utf-8 -*-
"""Verify groups.description fix against live DB (mirrors ModalAddSubscription logic)."""
import json
import os
import urllib.request

BASE = "https://atvdorphwnpzhobvfmtz.supabase.co"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def load_key():
    with open(os.path.join(ROOT, "supabase", ".env"), encoding="utf-8") as f:
        for line in f:
            if line.startswith("SUPABASE_SERVICE_ROLE_KEY="):
                return line.split("=", 1)[1].strip()
    raise SystemExit("no key")


def get(path):
    key = load_key()
    req = urllib.request.Request(
        BASE + "/rest/v1/" + path,
        headers={"apikey": key, "Authorization": "Bearer " + key},
    )
    return json.loads(urllib.request.urlopen(req).read().decode())


groups = get("groups?select=id,name,description&order=name.asc")
exs = get("exercises?select=id,name,group_id&group_id=not.is.null&limit=5000")

all_json_ok = True
for g in groups:
    try:
        items = json.loads(g["description"])
        items_ok = isinstance(items, list)
    except Exception:
        items_ok = False
        items = []
    if not items_ok:
        all_json_ok = False
    courses = [e for e in exs if e.get("group_id") == g["id"]]
    status = "OK" if items_ok else "BAD"
    print(f"{g['name']:24s} desc={status}  items={len(items):2d}  courses={len(courses):3d}")
    if items:
        print(f"{'':24s} group items -> {items}")

print("\nALL descriptions parse as JSON arrays:", all_json_ok)
print("Exercises with group_id (will show as Cours):", len(exs))