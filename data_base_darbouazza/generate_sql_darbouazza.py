"""
============================================================
TOUPTI GYM DARBOUAZZA - SQL GENERATOR
============================================================
Reads the Excel files from data_base_darbouazza/BDD dar bouazza/
and generates SQL insert scripts mapped to the database schema.

Mapping (same as Casa, fixed):
  - Activité column → groups table (activités)
  - Designation column → exercises.name (group name)
  - exercises.group_id → activity (groups table)
  - Days → French (Lundi, Mardi, etc.)
  - parent_children deduplicated
  - All subqueries have LIMIT 1
============================================================
"""

import zipfile
import xml.etree.ElementTree as ET
import os
from datetime import datetime, timedelta

folder = r'data_base_darbouazza/BDD dar bouazza'
out_dir = r'data_base_darbouazza'

def read_xlsx(path):
    with zipfile.ZipFile(path) as z:
        shared_strings = []
        if 'xl/sharedStrings.xml' in z.namelist():
            root = ET.fromstring(z.read('xl/sharedStrings.xml'))
            ns = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
            for si in root.findall('.//m:si', ns):
                text = ''.join(t.text or '' for t in si.findall('.//m:t', ns))
                shared_strings.append(text)
        
        root = ET.fromstring(z.read('xl/worksheets/sheet1.xml'))
        ns = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
        rows = []
        for row in root.findall('.//m:sheetData/m:row', ns):
            row_data = []
            for cell in row.findall('m:c', ns):
                cell_type = cell.get('t', '')
                value_elem = cell.find('m:v', ns)
                if value_elem is not None:
                    val = value_elem.text
                    if cell_type == 's':
                        idx = int(val)
                        row_data.append(shared_strings[idx] if idx < len(shared_strings) else '')
                    else:
                        row_data.append(val)
                else:
                    row_data.append('')
            rows.append(row_data)
        return rows

def excel_date_to_str(val):
    """Convert Excel serial date to YYYY-MM-DD string"""
    try:
        f = float(val)
        d = datetime(1899, 12, 30) + timedelta(days=f)
        return d.strftime('%Y-%m-%d')
    except:
        return None

def clean_str(val):
    """Clean string value for SQL"""
    if val is None:
        return ''
    s = str(val).strip()
    s = s.replace("'", "''")
    return s

def clean_phone(val):
    s = clean_str(val)
    if s in ['-', '--', '---', '']:
        return ''
    return s

def clean_email(val):
    s = clean_str(val)
    if s in ['-', '--', '---', ''] or '@' not in s:
        return ''
    return s

def clean_name(val):
    s = clean_str(val)
    if s.replace('-', '').strip() == '':
        return ''
    return s

# ============================================================
# Read all data
# ============================================================
print("Reading Excel files...")
activities = read_xlsx(os.path.join(folder, 'BDD activités dar bouazza.xlsx'))
clients = read_xlsx(os.path.join(folder, 'BDD clients dar bouazza.xlsx'))
groups_data = read_xlsx(os.path.join(folder, 'BDD groupes dar bouazza.xlsx'))
horaires = read_xlsx(os.path.join(folder, 'BDD horaires dar bouazza.xlsx'))

# ============================================================
# 1. Build ACTIVITÉS from activités file (Activité column) → groups table
# ============================================================
print("Processing activités (→ groups table)...")
activity_map = {}  # activité_name -> id
activity_sql = []
for row in activities[1:]:
    if len(row) >= 4 and row[3]:
        act_name = clean_str(row[3])
        if act_name and act_name not in activity_map:
            activity_map[act_name] = len(activity_map) + 1
            activity_sql.append(f"  ('{act_name}')")

# Also check horaires for any additional activities
for row in horaires[1:]:
    if len(row) >= 2 and row[1]:
        act_name = clean_str(row[1])
        if act_name and act_name not in activity_map:
            activity_map[act_name] = len(activity_map) + 1
            activity_sql.append(f"  ('{act_name}')")

# ============================================================
# 2. Build TRAINERS (monitors from horaires)
# ============================================================
print("Processing trainers...")
trainer_map = {}
trainer_sql = []
for row in horaires[1:]:
    if len(row) >= 7 and row[6]:
        tname = clean_name(row[6])
        if tname and tname not in trainer_map:
            trainer_map[tname] = len(trainer_map) + 1
            trainer_sql.append(f"  ('{tname}')")

# ============================================================
# 3. Build EXERCISES (horaires from BDD horaires)
#    exercises.name = groupe (Designation)
#    exercises.group_id = activité (→ groups table)
# ============================================================
print("Processing horaires (→ exercises)...")
exercise_sql = []
for row in horaires[1:]:
    if len(row) >= 7:
        activity = clean_str(row[1]) if len(row) > 1 else ''
        group_name = clean_str(row[2]) if len(row) > 2 else ''
        day = clean_str(row[3]) if len(row) > 3 else ''
        start_time = clean_str(row[4]) if len(row) > 4 else ''
        end_time = clean_str(row[5]) if len(row) > 5 else ''
        monitor = clean_name(row[6]) if len(row) > 6 else ''
        
        if group_name and day:
            # Map activity type
            act_type = 'Other'
            act_upper = activity.upper()
            if 'FOOTBALL' in act_upper:
                act_type = 'Football'
            elif 'BASKET' in act_upper:
                act_type = 'Basketball'
            elif 'NATATION' in act_upper:
                act_type = 'Swimming'
            elif 'GYMNASTIQUE' in act_upper:
                act_type = 'Gymnastics'
            
            # Map day to French
            day_fr_map = {
                'LUNDI': 'Lundi', 'MARDI': 'Mardi', 'MERCREDI': 'Mercredi',
                'JEUDI': 'Jeudi', 'VENDREDI': 'Vendredi', 'SAMEDI': 'Samedi',
                'DIMANCHE': 'Dimanche'
            }
            day_fr = day_fr_map.get(day.upper(), day)
            
            # Default times if empty
            st = start_time if start_time else '09:00:00'
            et = end_time if end_time else '10:00:00'
            
            # Trainer reference
            trainer_ref = 'NULL'
            if monitor and monitor in trainer_map:
                trainer_ref = f"(SELECT id FROM trainers WHERE name = '{monitor}' LIMIT 1)"
            
            # Group reference = the activité (from groups table)
            group_ref = 'NULL'
            if activity and activity in activity_map:
                group_ref = f"(SELECT id FROM groups WHERE name = '{activity}' LIMIT 1)"
            
            exercise_sql.append(
                f"  ('{group_name}', '{day_fr}', '{act_type}', '{st}', '{et}', {trainer_ref}, {group_ref})"
            )

# ============================================================
# 4. Build CHILDREN, PARENTS, SUBSCRIPTIONS from clients
# ============================================================
print("Processing clients...")
child_map = {}
child_sql = []
parent_map = {}
parent_sql = []
parent_child_sql = []
parent_child_seen = set()
subscription_sql = []

child_count = 0
parent_count = 0
sub_count = 0

for row in clients[1:]:
    if len(row) < 7:
        continue
    
    child_name = clean_name(row[0]) if row[0] else ''
    if not child_name:
        continue
    
    client_type = clean_str(row[1]) if len(row) > 1 else ''
    sub_type = clean_str(row[2]) if len(row) > 2 else ''
    inscription_date = excel_date_to_str(row[3]) if len(row) > 3 else None
    start_date = excel_date_to_str(row[4]) if len(row) > 4 else None
    end_date = excel_date_to_str(row[5]) if len(row) > 5 else None
    status = clean_str(row[6]) if len(row) > 6 else ''
    address = clean_str(row[7]) if len(row) > 7 else ''
    
    papa_name = clean_name(row[8]) if len(row) > 8 else ''
    papa_email = clean_email(row[9]) if len(row) > 9 else ''
    papa_phone = clean_phone(row[10]) if len(row) > 10 else ''
    
    maman_name = clean_name(row[11]) if len(row) > 11 else ''
    maman_email = clean_email(row[12]) if len(row) > 12 else ''
    maman_phone = clean_phone(row[13]) if len(row) > 13 else ''
    
    # --- CHILDREN ---
    if child_name not in child_map:
        child_count += 1
        child_map[child_name] = child_count
        addr = address if address else ''
        child_sql.append(f"  ('{child_name}', 'Garçon', '2000-01-01', 0, NULL, NULL, '{addr}', NULL, 'Normal', NULL)")
    
    child_id = child_map[child_name]
    
    # --- PARENTS ---
    if papa_name:
        papa_key = (papa_name, papa_phone)
        if papa_key not in parent_map:
            parent_count += 1
            parent_map[papa_key] = parent_count
            parent_sql.append(f"  ('{papa_name}', '{papa_phone if papa_phone else '0000000000'}', '{papa_email}', NULL, 'Père')")
        parent_id = parent_map[papa_key]
        pc_key = (parent_id, child_id)
        if pc_key not in parent_child_seen:
            parent_child_seen.add(pc_key)
            parent_child_sql.append(
                f"  ((SELECT id FROM parents WHERE name = '{papa_name}' AND phone = '{papa_phone if papa_phone else '0000000000'}' LIMIT 1), "
                f"(SELECT id FROM children WHERE name = '{child_name}' LIMIT 1))"
            )
    
    if maman_name:
        maman_key = (maman_name, maman_phone)
        if maman_key not in parent_map:
            parent_count += 1
            parent_map[maman_key] = parent_count
            parent_sql.append(f"  ('{maman_name}', '{maman_phone if maman_phone else '0000000000'}', '{maman_email}', NULL, 'Mère')")
        parent_id = parent_map[maman_key]
        pc_key = (parent_id, child_id)
        if pc_key not in parent_child_seen:
            parent_child_seen.add(pc_key)
            parent_child_sql.append(
                f"  ((SELECT id FROM parents WHERE name = '{maman_name}' AND phone = '{maman_phone if maman_phone else '0000000000'}' LIMIT 1), "
                f"(SELECT id FROM children WHERE name = '{child_name}' LIMIT 1))"
            )
    
    # --- SUBSCRIPTIONS ---
    if sub_type and start_date:
        sub_count += 1
        status_map = {
            'En cours': 'actif',
            'Terminé': 'expiré',
            'Transféré': 'résilié'
        }
        db_status = status_map.get(status, 'en_attente')
        
        sub_upper = sub_type.upper()
        if 'ANNUEL' in sub_upper:
            sub_db_type = 'Annuel'
        elif 'SEMESTRIEL' in sub_upper:
            sub_db_type = 'Annuel'
        elif 'TRIMESTRIEL' in sub_upper:
            sub_db_type = 'Annuel'
        elif 'CYCLE' in sub_upper:
            sub_db_type = 'Session'
        else:
            sub_db_type = 'Annuel'
        
        # Determine amount
        amount = 0
        if 'ANNUEL' in sub_upper:
            if '1 ACTIVITÉ' in sub_upper:
                amount = 3500
            elif '2 ACTIVITÉS' in sub_upper:
                amount = 4500
            elif '3 ACTIVITÉS' in sub_upper:
                amount = 5500
            elif '4 ACTIVITÉS' in sub_upper:
                amount = 6500
            else:
                amount = 4000
        elif 'SEMESTRIEL' in sub_upper:
            if '1 ACTIVITÉ' in sub_upper:
                amount = 2000
            elif '2 ACTIVITÉS' in sub_upper:
                amount = 2500
            elif '3 ACTIVITÉS' in sub_upper:
                amount = 3000
            elif '4 ACTIVITÉS' in sub_upper:
                amount = 3500
            else:
                amount = 2500
        elif 'TRIMESTRIEL' in sub_upper:
            if '2 ACTIVITÉS' in sub_upper:
                amount = 1500
            elif '3 ACTIVITÉS' in sub_upper:
                amount = 1800
            else:
                amount = 1200
        elif 'CYCLE' in sub_upper:
            amount = 800
        else:
            amount = 1000
        
        sub_option = 'Nouvel abonnement'
        if 'Réabonnement' in client_type:
            sub_option = 'Réabonnement'
        
        sub_date = inscription_date if inscription_date else start_date
        
        parent_ref = 'NULL'
        if papa_name and (papa_name, papa_phone) in parent_map:
            parent_ref = f"(SELECT id FROM parents WHERE name = '{papa_name}' AND phone = '{papa_phone if papa_phone else '0000000000'}' LIMIT 1)"
        elif maman_name and (maman_name, maman_phone) in parent_map:
            parent_ref = f"(SELECT id FROM parents WHERE name = '{maman_name}' AND phone = '{maman_phone if maman_phone else '0000000000'}' LIMIT 1)"
        
        subscription_sql.append(
            f"  ((SELECT id FROM children WHERE name = '{child_name}' LIMIT 1), "
            f"'{sub_db_type}', '{sub_type}', {amount}, 0, 0, 0, "
            f"'{db_status}', '{{}}', 0, "
            f"'{start_date}', '{end_date if end_date else start_date}', "
            f"NULL, NULL, '{sub_date}', '{sub_option}', {parent_ref})"
        )

# ============================================================
# Generate full SQL file
# ============================================================
print("Generating SQL file...")

sql = """-- ============================================================
-- TOUPTI GYM DARBOUAZZA - DATA IMPORT SCRIPT
-- Generated from Excel files in data_base_darbouazza/BDD dar bouazza/
-- ============================================================

-- Run this in Supabase SQL Editor
-- ============================================================
-- 1. INSERT ACTIVITÉS (→ groups table)
-- ============================================================
INSERT INTO groups (name) VALUES
"""

sql += ",\n".join(activity_sql) + ";\n\n"

sql += """-- ============================================================
-- 2. INSERT TRAINERS (monitors)
-- ============================================================
INSERT INTO trainers (name) VALUES
"""

sql += ",\n".join(trainer_sql) + ";\n\n"

sql += """-- ============================================================
-- 3. INSERT EXERCISES (horaires: name = groupe, group_id = activité)
-- ============================================================
INSERT INTO exercises (name, day, type, start_time, end_time, coach_id, group_id) VALUES
"""

sql += ",\n".join(exercise_sql) + ";\n\n"

sql += """-- ============================================================
-- 4. INSERT CHILDREN
-- ============================================================
INSERT INTO children (name, gender, birth_date, age, school, school_type, address, postal_code, client_type, zkteco_id) VALUES
"""

sql += ",\n".join(child_sql) + ";\n\n"

sql += """-- ============================================================
-- 5. INSERT PARENTS
-- ============================================================
INSERT INTO parents (name, phone, email, id_card, gender) VALUES
"""

sql += ",\n".join(parent_sql) + ";\n\n"

sql += """-- ============================================================
-- 6. INSERT PARENT-CHILD RELATIONSHIPS
-- ============================================================
INSERT INTO parent_children (parent_id, child_id) VALUES
"""

sql += ",\n".join(parent_child_sql) + ";\n\n"

sql += """-- ============================================================
-- 7. INSERT SUBSCRIPTIONS
-- ============================================================
INSERT INTO subscriptions (child_id, type, sub_type, amount, discount, insurance, entry_fee, status, exercises, paid_amount, start_date, end_date, created_by, confirmed_by, subscription_date, subscription_type_option, parent_id) VALUES
"""

sql += ",\n".join(subscription_sql) + ";\n\n"

sql += """-- ============================================================
-- DONE! All data imported successfully.
-- ============================================================
"""

# Write to file
output_path = os.path.join(out_dir, 'import_darbouazza_data.sql')
with open(output_path, 'w', encoding='utf-8') as f:
    f.write(sql)

import sys
sys.stdout.reconfigure(encoding='utf-8')
print(f"SQL file generated: {output_path}")
print(f"  Activités (groups): {len(activity_sql)}")
print(f"  Trainers: {len(trainer_sql)}")
print(f"  Exercises (horaires): {len(exercise_sql)}")
print(f"  Children: {len(child_sql)}")
print(f"  Parents: {len(parent_sql)}")
print(f"  Parent-Child links: {len(parent_child_sql)}")
print(f"  Subscriptions: {len(subscription_sql)}")