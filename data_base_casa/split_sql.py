import os

# Read the full SQL file
with open(r'data_base_casa/import_casa_data.sql', 'r', encoding='utf-8') as f:
    content = f.read()

# Section markers
sections = [
    ('INSERT INTO exercises (name, day, type, start_time, end_time) VALUES', 'ACTIVITIES'),
    ('INSERT INTO groups (name) VALUES', 'GROUPS'),
    ('INSERT INTO trainers (name) VALUES', 'TRAINERS'),
    ('INSERT INTO exercises (name, day, type, start_time, end_time, coach_id, group_id) VALUES', 'SCHEDULES'),
    ('INSERT INTO children', 'CHILDREN'),
    ('INSERT INTO parents', 'PARENTS'),
    ('INSERT INTO parent_children', 'PARENT_CHILDREN'),
    ('INSERT INTO subscriptions', 'SUBSCRIPTIONS'),
]

# Find positions
positions = []
for marker, name in sections:
    pos = content.find(marker)
    positions.append((pos, name, marker))

# Calculate section extents
def get_section(idx):
    start = positions[idx][0]
    if idx < len(positions) - 1:
        end = positions[idx + 1][0]
    else:
        end = len(content)
    return content[start:end]

# ============================================================
# PART 1: Reference data (activities, groups, trainers, schedules)
# ============================================================
part1 = """-- ============================================================
-- TOUPTI GYM CASA - DATA IMPORT - PART 1 OF 4
-- REFERENCE DATA (Activities, Groups, Trainers, Schedules)
-- ============================================================

-- Run this FIRST in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/atvdorphwnpzhobvfmtz/sql/new

"""
for i in range(4):
    part1 += get_section(i).rstrip() + "\n\n"

part1 += """-- ============================================================
-- PART 1 COMPLETE! Now run PART 2.
-- ============================================================
"""

# ============================================================
# PART 2: Children + Parents
# ============================================================
part2 = """-- ============================================================
-- TOUPTI GYM CASA - DATA IMPORT - PART 2 OF 4
-- CLIENTS (Children + Parents)
-- ============================================================

-- Run this SECOND after PART 1.
-- https://supabase.com/dashboard/project/atvdorphwnpzhobvfmtz/sql/new

"""
for i in range(4, 6):
    part2 += get_section(i).rstrip() + "\n\n"

part2 += """-- ============================================================
-- PART 2 COMPLETE! Now run PART 3.
-- ============================================================
"""

# ============================================================
# PART 3: Parent-Child relationships
# ============================================================
part3 = """-- ============================================================
-- TOUPTI GYM CASA - DATA IMPORT - PART 3 OF 4
-- PARENT-CHILD RELATIONSHIPS
-- ============================================================

-- Run this THIRD after PART 2.
-- https://supabase.com/dashboard/project/atvdorphwnpzhobvfmtz/sql/new

"""
part3 += get_section(6).rstrip() + "\n\n"

part3 += """-- ============================================================
-- PART 3 COMPLETE! Now run PART 4.
-- ============================================================
"""

# ============================================================
# PART 4: Subscriptions
# ============================================================
part4 = """-- ============================================================
-- TOUPTI GYM CASA - DATA IMPORT - PART 4 OF 4
-- SUBSCRIPTIONS
-- ============================================================

-- Run this LAST after PART 3.
-- https://supabase.com/dashboard/project/atvdorphwnpzhobvfmtz/sql/new

"""
part4 += get_section(7).rstrip() + "\n\n"

part4 += """-- ============================================================
-- PART 4 COMPLETE! ALL DATA IMPORTED SUCCESSFULLY! 🎉
-- ============================================================
"""

# Write files
out_dir = r'data_base_casa'

files = {
    'import_casa_part1_reference_data.sql': part1,
    'import_casa_part2_children_parents.sql': part2,
    'import_casa_part3_parent_children.sql': part3,
    'import_casa_part4_subscriptions.sql': part4,
}

for fname, fcontent in files.items():
    fpath = os.path.join(out_dir, fname)
    with open(fpath, 'w', encoding='utf-8') as f:
        f.write(fcontent)
    size_kb = len(fcontent) / 1024
    print(f'✅ {fname}: {size_kb:.1f} KB ({len(fcontent)} bytes)')

print()
print('All files created! Run them in order: PART 1 → PART 2 → PART 3 → PART 4')