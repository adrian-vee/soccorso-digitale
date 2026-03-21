#!/usr/bin/env python3
"""
Import December 2025 shifts from Excel file into the database.
Creates missing vehicles and shift assignments.
"""

import openpyxl
import psycopg2
import os
import json
import uuid
from datetime import datetime, date, time

# Database connection
conn = psycopg2.connect(os.environ['DATABASE_URL'])
cur = conn.cursor()

# Load Excel file
wb = openpyxl.load_workbook('attached_assets/TURNO_DICEMBRE_2025__1766779274215.xlsx')
sheet = wb.active

# Get location ID (ULSS 21 - Legnago area)
cur.execute("SELECT id FROM locations LIMIT 1")
location_id = cur.fetchone()[0]

# Vehicle configuration from Excel
# Format: (column_start, vehicle_code, nato_name, shift_start, shift_end, roles)
vehicle_configs = [
    # ROMEO J31
    (2, 'J 31', 'ROMEO', '06:30', '14:30', ['autista', 'soccorritore']),
    (4, 'J 31', 'ROMEO', '14:30', '19:30', ['autista', 'soccorritore']),
    # INDIA J54
    (6, 'J 54', 'INDIA', '06:30', '14:30', ['autista', 'soccorritore']),
    (8, 'J 54', 'INDIA', '14:30', '19:30', ['autista', 'soccorritore']),
    # LIMA J55
    (10, 'J 55', 'LIMA', '06:30', '14:30', ['autista', 'soccorritore']),
    (12, 'J 55', 'LIMA', '14:30', '19:30', ['autista', 'soccorritore']),
    # CHARLIE ECHO J48
    (17, 'J 48', 'CHARLIE ECHO', '07:00', '19:00', ['autista', 'infermiere']),
    # CHARLIE ECHO J58
    (19, 'J 58', 'CHARLIE ECHO 58', '07:00', '19:00', ['autista', 'infermiere']),
    # CHARLIE ECHO 6 LONIGO
    (21, 'J 60', 'CHARLIE ECHO LONIGO', '07:00', '19:00', ['soccorritore', 'infermiere']),
    # TANGO ROMEO 1 MONT
    (23, 'J 61', 'TANGO ROMEO', '07:00', '19:00', ['soccorritore', 'infermiere']),
    # BRAVO 2.2
    (28, 'J 62', 'BRAVO 2.2', '07:00', '14:00', ['autista', 'soccorritore']),
    # BRAVO 2.1
    (30, 'J 63', 'BRAVO 2.1', '14:00', '21:00', ['autista', 'soccorritore']),
    # BRAVO PS LEGNAGO
    (32, 'J 64', 'BRAVO PS LEGNAGO', '08:00', '19:00', ['autista', 'soccorritore']),
    # ROMEO 21 NOTTE
    (34, 'ROMEO 21', 'ROMEO 21', '20:00', '06:00', ['autista', 'soccorritore']),
    # BRAVO 22 NOTTE
    (36, 'J 71', 'BRAVO 22', '20:00', '06:00', ['autista', 'soccorritore']),
    # SIERRA 1
    (41, 'SIERRA 1', 'SIERRA 1', '07:00', '19:00', ['soccorritore', 'soccorritore']),
    # SIERRA 2
    (43, 'SIERRA 2', 'SIERRA 2', '07:00', '19:00', ['soccorritore', 'soccorritore']),
]

def get_or_create_vehicle(code, nato_name, shift_start, shift_end, roles):
    """Get existing vehicle or create a new one."""
    cur.execute("SELECT id FROM vehicles WHERE code = %s", (code,))
    result = cur.fetchone()
    
    if result:
        vehicle_id = result[0]
        # Update NATO name and shifts
        shifts = json.dumps([{"start": shift_start, "end": shift_end}])
        cur.execute("""
            UPDATE vehicles 
            SET nato_name = %s, schedule_shifts = %s, schedule_roles = %s
            WHERE id = %s
        """, (nato_name, shifts, ','.join(roles), vehicle_id))
        print(f"  Updated vehicle {code} ({nato_name})")
        return vehicle_id
    else:
        # Create new vehicle
        vehicle_id = str(uuid.uuid4())
        shifts = json.dumps([{"start": shift_start, "end": shift_end}])
        cur.execute("""
            INSERT INTO vehicles (id, code, nato_name, vehicle_type, location_id, schedule_shifts, schedule_roles, is_active, current_km, created_at)
            VALUES (%s, %s, %s, 'ambulance', %s, %s, %s, true, 0, NOW())
        """, (vehicle_id, code, nato_name, location_id, shifts, ','.join(roles)))
        print(f"  Created vehicle {code} ({nato_name})")
        return vehicle_id

def normalize_name(name):
    """Normalize staff name for matching."""
    if not name:
        return None
    name = str(name).strip().upper()
    # Remove extra spaces
    name = ' '.join(name.split())
    return name

def find_staff_member(name):
    """Find staff member by last name (case insensitive)."""
    if not name:
        return None
    
    name = normalize_name(name)
    if not name or name == 'NO DISCO':
        return None
    
    # Try to match by last name
    cur.execute("""
        SELECT id, first_name, last_name 
        FROM staff_members 
        WHERE UPPER(last_name) LIKE %s
        OR UPPER(first_name) LIKE %s
        LIMIT 1
    """, (f'%{name}%', f'%{name}%'))
    
    result = cur.fetchone()
    if result:
        return result[0]
    
    return None

def create_shift_instance(vehicle_id, shift_date, start_time, end_time, roles):
    """Create a shift instance for a specific date."""
    instance_id = str(uuid.uuid4())
    
    # Check if shift already exists
    cur.execute("""
        SELECT id FROM shift_instances 
        WHERE vehicle_id = %s AND shift_date = %s AND start_time = %s
    """, (vehicle_id, shift_date, start_time))
    
    existing = cur.fetchone()
    if existing:
        return existing[0]
    
    required_roles = json.dumps([{"role": r, "count": 1} for r in roles])
    
    cur.execute("""
        INSERT INTO shift_instances 
        (id, location_id, vehicle_id, shift_date, start_time, end_time, required_roles, min_staff, max_staff, current_staff_count, status, is_covered, coverage_percent, created_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 0, 'published', false, 0, NOW())
    """, (instance_id, location_id, vehicle_id, shift_date, start_time, end_time, required_roles, len(roles), len(roles) * 2))
    
    return instance_id

def create_shift_assignment(instance_id, staff_id, role, role_index):
    """Create a shift assignment for a staff member."""
    if not staff_id:
        return
    
    assignment_id = str(uuid.uuid4())
    
    # Check if assignment already exists
    cur.execute("""
        SELECT id FROM shift_assignments 
        WHERE shift_instance_id = %s AND staff_member_id = %s
    """, (instance_id, staff_id))
    
    if cur.fetchone():
        return
    
    cur.execute("""
        INSERT INTO shift_assignments 
        (id, shift_instance_id, staff_member_id, assigned_role, role_slot_index, status, assigned_at, created_at)
        VALUES (%s, %s, %s, %s, %s, 'confirmed', NOW(), NOW())
    """, (assignment_id, instance_id, staff_id, role, role_index))

# Main import process
print("Starting December 2025 shifts import...")
print()

# Step 1: Create/update vehicles
print("Step 1: Creating/updating vehicles...")
vehicle_map = {}
for config in vehicle_configs:
    col, code, nato, start, end, roles = config
    vehicle_id = get_or_create_vehicle(code, nato, start, end, roles)
    vehicle_map[(code, start)] = (vehicle_id, roles)

conn.commit()
print()

# Step 2: Read and import shifts
print("Step 2: Importing shifts from Excel...")

# Track statistics
stats = {
    'shifts_created': 0,
    'assignments_created': 0,
    'staff_not_found': set()
}

# Read data rows (starting from row 4)
for row_idx in range(4, 35):  # Days 1-31 of December
    row = list(sheet.iter_rows(min_row=row_idx, max_row=row_idx, values_only=True))[0]
    
    # Get day number from first column
    day = row[0]
    if not day or not isinstance(day, (int, float)):
        continue
    
    day = int(day)
    if day < 1 or day > 31:
        continue
    
    shift_date = date(2025, 12, day)
    print(f"  Processing day {day} ({shift_date})...")
    
    # Process each vehicle configuration
    for config in vehicle_configs:
        col, code, nato, start_time, end_time, roles = config
        
        vehicle_key = (code, start_time)
        if vehicle_key not in vehicle_map:
            continue
        
        vehicle_id, role_list = vehicle_map[vehicle_key]
        
        # Get staff names from columns
        staff_names = []
        for i, role in enumerate(roles):
            name_col = col + i
            if name_col < len(row):
                staff_names.append(row[name_col])
            else:
                staff_names.append(None)
        
        # Skip if no staff assigned
        if all(not n for n in staff_names):
            continue
        
        # Create shift instance
        instance_id = create_shift_instance(
            vehicle_id, 
            shift_date, 
            start_time, 
            end_time, 
            role_list
        )
        stats['shifts_created'] += 1
        
        # Create assignments
        for i, (name, role) in enumerate(zip(staff_names, role_list)):
            staff_id = find_staff_member(name)
            if staff_id:
                create_shift_assignment(instance_id, staff_id, role, i)
                stats['assignments_created'] += 1
            elif name and normalize_name(name) not in ('NO DISCO', None, ''):
                stats['staff_not_found'].add(normalize_name(name))

conn.commit()
print()

# Step 3: Update coverage stats
print("Step 3: Updating coverage statistics...")
cur.execute("""
    UPDATE shift_instances si SET
        current_staff_count = (SELECT COUNT(*) FROM shift_assignments WHERE shift_instance_id = si.id AND status = 'confirmed'),
        is_covered = (SELECT COUNT(*) >= si.min_staff FROM shift_assignments WHERE shift_instance_id = si.id AND status = 'confirmed'),
        coverage_percent = LEAST(100, (SELECT COUNT(*) * 100 / GREATEST(1, si.min_staff) FROM shift_assignments WHERE shift_instance_id = si.id AND status = 'confirmed'))
    WHERE shift_date >= '2025-12-01' AND shift_date <= '2025-12-31'
""")
conn.commit()

# Summary
print()
print("=" * 50)
print("IMPORT COMPLETED")
print("=" * 50)
print(f"Shifts created/updated: {stats['shifts_created']}")
print(f"Assignments created: {stats['assignments_created']}")
print(f"Staff not found ({len(stats['staff_not_found'])}):")
for name in sorted(stats['staff_not_found']):
    print(f"  - {name}")

conn.close()
print()
print("Done!")
