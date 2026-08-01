import os

# Read the full SQL file
with open(r'data_base_darbouazza/import_darbouazza_data.sql', 'r', encoding='utf-8') as f:
    content = f.read()

out_dir = r'data_base_darbouazza'

# ============================================================
# Helper to extract an INSERT statement section
# ============================================================
def extract_insert_section(full_content, marker):
    """Extract the INSERT statement (from marker to the terminator ;)"""
    idx = full_content.find(marker)
    if idx == -1:
        return None
    end_idx = full_content.find(';\n', idx)
    if end_idx == -1:
        end_idx = len(full_content)
    return full_content[idx:end_idx + 1]

# ============================================================
# Helper to split VALUES rows into batches
# ============================================================
def split_values(insert_section, rows_per_batch=2900):
    """
    Take an 'INSERT INTO table (...) VALUES\n  (...),\n  (...);' string
    and split it into multiple complete INSERT statements,
    each with at most rows_per_batch rows.
    """
    values_idx = insert_section.find('VALUES')
    if values_idx == -1:
        return [insert_section]

    header = insert_section[:values_idx].rstrip()
    header = header + ' VALUES'

    values_part = insert_section[values_idx + len('VALUES'):].strip()
    if values_part.endswith(';'):
        values_part = values_part[:-1]

    lines = values_part.split('\n')
    
    rows = []
    current_row = ''
    in_string = False
    paren_depth = 0
    
    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
        
        if current_row:
            current_row += '\n' + line
        else:
            current_row = line
        
        i = 0
        while i < len(line):
            ch = line[i]
            if ch == "'":
                if i + 1 < len(line) and line[i+1] == "'":
                    i += 2
                    continue
                in_string = not in_string
            elif ch == '(' and not in_string:
                paren_depth += 1
            elif ch == ')' and not in_string:
                paren_depth -= 1
            i += 1
        
        if paren_depth == 0 and current_row.strip():
            row_content = current_row.strip()
            if row_content.endswith(','):
                row_content = row_content[:-1]
            rows.append(row_content)
            current_row = ''
            paren_depth = 0
    
    if current_row.strip():
        row_content = current_row.strip()
        if row_content.endswith(','):
            row_content = row_content[:-1]
        rows.append(row_content)

    statements = []
    for i in range(0, len(rows), rows_per_batch):
        batch = rows[i:i + rows_per_batch]
        stmt = header + '\n' + ',\n'.join(batch) + ';'
        statements.append(stmt)
    
    return statements

def write_file(fname, fcontent):
    fpath = os.path.join(out_dir, fname)
    with open(fpath, 'w', encoding='utf-8') as f:
        f.write(fcontent)
    lines = fcontent.count('\n')
    size_kb = len(fcontent) / 1024
    print(f'  {fname}: {size_kb:.1f} KB, {lines} lines')

# ============================================================
# Extract all sections
# ============================================================
print("Extracting sections from full SQL...")

markers = [
    ('INSERT INTO groups (name) VALUES', 'activites'),
    ('INSERT INTO trainers (name) VALUES', 'trainers'),
    ('INSERT INTO exercises (name, day, type, start_time, end_time, coach_id, group_id) VALUES', 'horaires'),
    ('INSERT INTO children', 'children'),
    ('INSERT INTO parents', 'parents'),
    ('INSERT INTO parent_children', 'parent_children'),
    ('INSERT INTO subscriptions', 'subscriptions'),
]

sections = {}
for marker, name in markers:
    sec = extract_insert_section(content, marker)
    if sec:
        sections[name] = sec
        print(f'  {name}: {len(sec)} bytes')

BATCH_SIZE = 2900  # ~2900 rows ≈ ~3000 lines per file

# ============================================================
# Create files
# ============================================================
file_num = 1

# --- File 1: Activités + Trainers + Horaires (all small) ---
setup_parts = []
for name in ['activites', 'trainers', 'horaires']:
    if name in sections:
        setup_parts.append(sections[name])

if setup_parts:
    setup_sql = f"""-- ============================================================
-- TOUPTI GYM DARBOUAZZA - DATA IMPORT - FILE {file_num} OF 8
-- ACTIVITÉS (groups) + TRAINERS + HORAIRES (exercises)
-- ============================================================

-- Run this FIRST in the Supabase SQL Editor
-- ============================================================

"""
    for part in setup_parts:
        setup_sql += part + "\n\n"

    setup_sql += """-- ============================================================
-- FILE 1 DONE! ✅ Run FILE 2 next.
-- ============================================================
"""
    write_file('import_darbouazza_01_activites_trainers_horaires.sql', setup_sql)
    file_num += 1

# --- Children (small, keep as one file) ---
if 'children' in sections:
    children_sql = f"""-- ============================================================
-- TOUPTI GYM DARBOUAZZA - DATA IMPORT - FILE {file_num} OF 8
-- CHILDREN
-- ============================================================

-- Run this AFTER FILE 1
-- ============================================================

{sections['children']}

-- ============================================================
-- FILE {file_num} DONE! ✅
-- ============================================================
"""
    write_file(f'import_darbouazza_{file_num:02d}_children.sql', children_sql)
    file_num += 1

# --- Parents (small, keep as one file) ---
if 'parents' in sections:
    parents_sql = f"""-- ============================================================
-- TOUPTI GYM DARBOUAZZA - DATA IMPORT - FILE {file_num} OF 8
-- PARENTS
-- ============================================================

-- Run this AFTER the previous file
-- ============================================================

{sections['parents']}

-- ============================================================
-- FILE {file_num} DONE! ✅
-- ============================================================
"""
    write_file(f'import_darbouazza_{file_num:02d}_parents.sql', parents_sql)
    file_num += 1

# --- Parent-Child relationships (small, keep as one file) ---
if 'parent_children' in sections:
    pc_sql = f"""-- ============================================================
-- TOUPTI GYM DARBOUAZZA - DATA IMPORT - FILE {file_num} OF 8
-- PARENT-CHILD RELATIONSHIPS
-- ============================================================

-- Run this AFTER the previous file
-- ============================================================

{sections['parent_children']}

-- ============================================================
-- FILE {file_num} DONE! ✅
-- ============================================================
"""
    write_file(f'import_darbouazza_{file_num:02d}_parent_children.sql', pc_sql)
    file_num += 1

# --- Subscriptions (small, keep as one file) ---
if 'subscriptions' in sections:
    subs_sql = f"""-- ============================================================
-- TOUPTI GYM DARBOUAZZA - DATA IMPORT - FILE {file_num} OF 8
-- SUBSCRIPTIONS
-- ============================================================

-- Run this AFTER the previous file
-- ============================================================

{sections['subscriptions']}

-- ============================================================
-- FILE {file_num} DONE! ✅ ALL DATA IMPORTED!
-- ============================================================
"""
    write_file(f'import_darbouazza_{file_num:02d}_subscriptions.sql', subs_sql)
    file_num += 1

print(f"\nDone! Created {file_num - 1} files total.")
print("Run them in numerical order: 01, 02, 03, ...")