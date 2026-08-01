import os

# Read the full SQL file
with open(r'data_base_casa/import_casa_data.sql', 'r', encoding='utf-8') as f:
    content = f.read()

out_dir = r'data_base_casa'

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
    # Find VALUES keyword
    values_idx = insert_section.find('VALUES')
    if values_idx == -1:
        return [insert_section]

    header = insert_section[:values_idx].rstrip()
    # Keep "VALUES" on the header
    header = header + ' VALUES'

    values_part = insert_section[values_idx + len('VALUES'):].strip()
    if values_part.endswith(';'):
        values_part = values_part[:-1]

    # Split rows: each row starts with "  (" (2 spaces + open paren)
    # and ends with ")," or ");"
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
        
        # Track string state and paren depth
        i = 0
        while i < len(line):
            ch = line[i]
            if ch == "'":
                # Check for escaped quote ''
                if i + 1 < len(line) and line[i+1] == "'":
                    i += 2
                    continue
                in_string = not in_string
            elif ch == '(' and not in_string:
                paren_depth += 1
            elif ch == ')' and not in_string:
                paren_depth -= 1
            i += 1
        
        # Row is complete when paren_depth returns to 0 and we have content
        if paren_depth == 0 and current_row.strip():
            # Remove trailing comma if present
            row_content = current_row.strip()
            if row_content.endswith(','):
                row_content = row_content[:-1]
            rows.append(row_content)
            current_row = ''
            paren_depth = 0
    
    # Handle any remaining content
    if current_row.strip():
        row_content = current_row.strip()
        if row_content.endswith(','):
            row_content = row_content[:-1]
        rows.append(row_content)

    # Now build batch statements
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
    ('INSERT INTO exercises (name, day, type, start_time, end_time) VALUES', 'activities'),
    ('INSERT INTO groups (name) VALUES', 'groups'),
    ('INSERT INTO trainers (name) VALUES', 'trainers'),
    ('INSERT INTO exercises (name, day, type, start_time, end_time, coach_id, group_id) VALUES', 'schedules'),
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

# ============================================================
# Create files
# ============================================================

# --- File 1: Setup & Reference Data (small tables together) ---
file_num = 1
setup_sql = f"""-- ============================================================
-- TOUPTI GYM CASA - DATA IMPORT - FILE {file_num} OF 8
-- SETUP + REFERENCE DATA (Activities, Groups, Trainers, Schedules)
-- ============================================================

-- Run this FIRST in the Supabase SQL Editor
-- https://supabase.com/dashboard/project/atvdorphwnpzhobvfmtz/sql/new
-- ============================================================

"""
for name in ['activities', 'groups', 'trainers', 'schedules']:
    if name in sections:
        setup_sql += sections[name] + "\n\n"

setup_sql += """-- ============================================================
-- FILE 1 DONE! ✅ Run FILE 2 next.
-- ============================================================
"""
write_file('import_casa_01_reference_data.sql', setup_sql)

BATCH_SIZE = 2900  # ~2900 rows ≈ ~3000 lines per file

# --- Children (batches of ~2900 rows each) ---
if 'children' in sections:
    batches = split_values(sections['children'], BATCH_SIZE)
    for i, stmt in enumerate(batches):
        file_num += 1
        rows_start = i * BATCH_SIZE + 1
        rows_end = min((i + 1) * BATCH_SIZE, 5998)
        sql = f"""-- ============================================================
-- TOUPTI GYM CASA - DATA IMPORT - FILE {file_num} OF 8
-- CHILDREN - batch {i+1}/{len(batches)} (rows {rows_start}-{rows_end})
-- ============================================================

-- Run this AFTER the previous file
-- ============================================================

{stmt}

-- ============================================================
-- FILE {file_num} DONE! ✅
-- ============================================================
"""
        write_file(f'import_casa_{file_num:02d}_children.sql', sql)

# --- Parents (batches of ~2900 rows each) ---
if 'parents' in sections:
    batches = split_values(sections['parents'], BATCH_SIZE)
    for i, stmt in enumerate(batches):
        file_num += 1
        sql = f"""-- ============================================================
-- TOUPTI GYM CASA - DATA IMPORT - FILE {file_num} OF 8
-- PARENTS - batch {i+1}/{len(batches)}
-- ============================================================

-- Run this AFTER the previous file
-- ============================================================

{stmt}

-- ============================================================
-- FILE {file_num} DONE! ✅
-- ============================================================
"""
        write_file(f'import_casa_{file_num:02d}_parents.sql', sql)

# --- Parent-Child relationships (batches of ~2900 rows each) ---
if 'parent_children' in sections:
    batches = split_values(sections['parent_children'], BATCH_SIZE)
    for i, stmt in enumerate(batches):
        file_num += 1
        sql = f"""-- ============================================================
-- TOUPTI GYM CASA - DATA IMPORT - FILE {file_num} OF 8
-- PARENT-CHILD RELATIONSHIPS - batch {i+1}/{len(batches)}
-- ============================================================

-- Run this AFTER the previous file
-- ============================================================

{stmt}

-- ============================================================
-- FILE {file_num} DONE! ✅
-- ============================================================
"""
        write_file(f'import_casa_{file_num:02d}_parent_children.sql', sql)

# --- Subscriptions (batches of ~2900 rows each) ---
if 'subscriptions' in sections:
    batches = split_values(sections['subscriptions'], BATCH_SIZE)
    for i, stmt in enumerate(batches):
        file_num += 1
        sql = f"""-- ============================================================
-- TOUPTI GYM CASA - DATA IMPORT - FILE {file_num} OF 8
-- SUBSCRIPTIONS - batch {i+1}/{len(batches)}
-- ============================================================

-- Run this AFTER the previous file
-- ============================================================

{stmt}

-- ============================================================
-- FILE {file_num} DONE! ✅
-- ============================================================
"""
        write_file(f'import_casa_{file_num:02d}_subscriptions.sql', sql)

print(f"\nDone! Created {file_num} files total.")
print("Run them in numerical order: 01, 02, 03, ...")
