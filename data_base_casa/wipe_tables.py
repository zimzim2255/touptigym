"""
============================================================
TOUPTI GYM - WIPE ALL DATABASE TABLES
============================================================
This script deletes ALL rows from all application tables in
the correct order to respect foreign key constraints.

⚠️ WARNING: This will DELETE ALL DATA in these tables!
Only run this if you want to start fresh and re-import.

Usage:
  python data_base_casa/wipe_tables.py

You must have the SUPABASE_URL and SUPABASE_SECRET_KEY
environment variables set, or edit the values below.
============================================================
"""

import json
import os
import ssl
import urllib.request
import urllib.error

# ============================================================
# CONFIGURATION
# ============================================================
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://atvdorphwnpzhobvfmtz.supabase.co")
SUPABASE_SECRET_KEY = os.environ.get(
    "SUPABASE_SECRET_KEY",
    "sb_secret_4WJ8kj5t742ycGXD4iUUCw_sTc4zMmT",
)

# ============================================================
# TABLES TO WIPE (in deletion order - children first for FK)
# ============================================================
# Order matters: delete dependent tables before their parents
TABLES = [
    # Junction tables (no FK dependencies on each other)
    "subscription_courses",
    "subscription_groups",
    "subscription_activities",
    # Payment-dependent tables
    "payments",
    # Subscription-dependent tables
    "subscriptions",
    # Child-dependent tables
    "attendance",
    "requests",
    "access_logs",
    "zkteco_logs",
    # Parent-child junction
    "parent_children",
    # Independent/log tables
    "checks",
    "zkteco_commands",
    "zkteco_devices",
    # Core tables
    "children",
    "parents",
    "exercises",
    "trainers",
    "groups",
    "prices",
    "discounts",
    # Birthday email log (keep for audit, but wipe it too for clean slate)
    "birthday_email_sent",
]

# ============================================================
# HELPER FUNCTIONS
# ============================================================
def delete_all_rows(table: str) -> dict:
    """
    Delete all rows from a table via the Supabase REST API.
    Uses a condition that matches all rows (id is not null).
    Returns the response info.
    """
    # Tables without an 'id' column need a different filter
    if table == "parent_children":
        url = f"{SUPABASE_URL}/rest/v1/{table}?parent_id=not.is.null"
    else:
        url = f"{SUPABASE_URL}/rest/v1/{table}?id=not.is.null"
    req = urllib.request.Request(
        url,
        method="DELETE",
        headers={
            "apikey": SUPABASE_SECRET_KEY,
            "Authorization": f"Bearer {SUPABASE_SECRET_KEY}",
            "Prefer": "return=representation",
        },
    )
    try:
        ctx = ssl.create_default_context()
        with urllib.request.urlopen(req, context=ctx) as resp:
            status = resp.status
            body = resp.read().decode("utf-8")
            return {"status": status, "body": body}
    except urllib.error.HTTPError as e:
        try:
            body = e.read().decode("utf-8")
        except Exception:
            body = ""
        return {"status": e.code, "body": body}
    except Exception as e:
        return {"status": -1, "body": str(e)}


def table_exists(table: str) -> bool:
    """Check if a table exists in the database."""
    # Tables without 'id' column need a different select
    col = "parent_id" if table == "parent_children" else "id"
    url = f"{SUPABASE_URL}/rest/v1/{table}?select={col}&limit=1"
    req = urllib.request.Request(
        url,
        headers={
            "apikey": SUPABASE_SECRET_KEY,
            "Authorization": f"Bearer {SUPABASE_SECRET_KEY}",
        },
    )
    try:
        ctx = ssl.create_default_context()
        with urllib.request.urlopen(req, context=ctx) as resp:
            return resp.status == 200
    except urllib.error.HTTPError as e:
        # 404 means table doesn't exist, 401/403 means no access
        if e.code in (404,):
            return False
        # Any other error (401/403) means we can't check - assume it exists
        return True
    except Exception:
        return False


# ============================================================
# MAIN
# ============================================================
def main():
    print("=" * 60)
    print("TOUPTI GYM - WIPE DATABASE TABLES")
    print("=" * 60)
    print(f"URL: {SUPABASE_URL}")
    print()
    print("⚠️  WARNING: This will DELETE ALL rows from all tables!")
    print()
    print("Tables to wipe:")
    for t in TABLES:
        print(f"  - {t}")
    print()

    confirm = input("Type 'YES' to confirm and wipe all tables: ").strip()
    if confirm != "YES":
        print("Aborted. No changes made.")
        return

    print()
    print("Starting wipe...")
    print("-" * 60)

    results = []
    for table in TABLES:
        print(f"  Deleting from {table}... ", end="", flush=True)

        if not table_exists(table):
            print("SKIPPED (table does not exist)")
            results.append({"table": table, "status": "skipped", "deleted": 0})
            continue

        result = delete_all_rows(table)
        deleted = 0
        try:
            body = result.get("body", "")
            if body and body != "null" and not body.startswith("{"):
                data = json.loads(body)
                if isinstance(data, list):
                    deleted = len(data)
        except Exception:
            pass

        if result.get("status") == 200 or result.get("status") == 204:
            print(f"✅ OK ({deleted} rows)")
            results.append({"table": table, "status": "ok", "deleted": deleted})
        else:
            print(f"❌ ERROR: {result.get('status')} - {result.get('body', '')[:200]}")
            results.append({"table": table, "status": f"error:{result.get('status')}", "deleted": 0})

    print("-" * 60)
    print()
    print("SUMMARY:")
    ok = 0
    skipped = 0
    errors = 0
    for r in results:
        if r["status"] == "ok":
            ok += 1
        elif r["status"] == "skipped":
            skipped += 1
        else:
            errors += 1
        print(f"  {r['table']}: {r['status']} ({r['deleted']} rows)")
    print()
    print(f"✅ {ok} tables wiped, {skipped} skipped, {errors} errors")
    print()
    if errors == 0:
        print("Database is clean! You can now re-import the data.")
        print("Run the import files in order: 01, 02, 03, ... 20")
    else:
        print("Some tables had errors. Check the output above.")


if __name__ == "__main__":
    main()