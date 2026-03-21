#!/usr/bin/env python3
import openpyxl
import psycopg2
import psycopg2.extras
import os
import uuid
import json
from datetime import datetime

DATABASE_URL = os.environ.get('DATABASE_URL')

LOCATION_MAP = {
    'cologna veneta': 'a362c8c4-9346-49c6-8162-206d939444fa',
    'san giovanni lupatoto': 'df053241-6c3c-4225-b002-b28af7ae8677',
    'legnago': '5c40c432-9312-4aa4-85ed-eed595731205',
    'montecchio maggiore': 'dde6b010-92ab-4281-9636-9d45aa989e99',
    'nogara': '3a897440-10a9-4540-a9a7-bbf5b3450cd4',
    'verona': 'b73829f0-8cb9-453b-8f91-f5a1efc59061',
}

def parse_role(mansioni_str):
    if not mansioni_str:
        return 'soccorritore', []
    
    mansioni = str(mansioni_str).upper().strip()
    
    primary_role = 'soccorritore'
    secondary_roles = []
    
    if 'IP' in mansioni or 'INF' in mansioni:
        primary_role = 'infermiere'
    elif 'ATS' in mansioni or 'AUTISTA' in mansioni or 'AUE' in mansioni:
        primary_role = 'autista'
    elif 'SOCC' in mansioni:
        primary_role = 'soccorritore'
    elif 'UFF' in mansioni:
        primary_role = 'coordinatore'
    elif 'COORD' in mansioni:
        primary_role = 'coordinatore'
    
    if 'ATS' in mansioni and primary_role != 'autista':
        secondary_roles.append('autista')
    if 'SOCC' in mansioni and primary_role != 'soccorritore':
        secondary_roles.append('soccorritore')
    if 'AUE' in mansioni:
        if 'autista_emergenza' not in secondary_roles:
            secondary_roles.append('autista_emergenza')
    if 'COORD' in mansioni and primary_role != 'coordinatore':
        secondary_roles.append('coordinatore')
    if 'FORM' in mansioni:
        secondary_roles.append('formatore')
    
    return primary_role, secondary_roles

def import_staff():
    wb = openpyxl.load_workbook('attached_assets/LISTA_Anagrafica_generale_(2)_1766232883735.XLSX')
    sheet = wb.active
    
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    cur.execute("SELECT COUNT(*) FROM staff_members")
    existing_count = cur.fetchone()[0]
    print(f"Existing staff members: {existing_count}")
    
    if existing_count > 0:
        cur.execute("DELETE FROM staff_members")
        print("Cleared existing staff members")
    
    imported = 0
    skipped = 0
    
    for i, row in enumerate(sheet.iter_rows(min_row=3, values_only=True)):
        cognome = row[3]  
        nome = row[4]     
        
        if not cognome or not nome:
            skipped += 1
            continue
        
        first_name = str(nome).strip() if nome else ''
        last_name = str(cognome).strip() if cognome else ''
        
        if not first_name or not last_name:
            skipped += 1
            continue
        
        codice_fiscale = str(row[11]).strip() if row[11] else None
        telefono = str(row[13]).strip() if row[13] else None
        email = str(row[16]).strip() if row[16] else None
        
        if telefono and telefono.replace('.0', '').isdigit():
            telefono = telefono.replace('.0', '')
        
        sede = str(row[44]).strip().lower() if row[44] else 'san giovanni lupatoto'
        location_id = LOCATION_MAP.get(sede, LOCATION_MAP['san giovanni lupatoto'])
        
        mansioni = row[30]
        primary_role, secondary_roles = parse_role(mansioni)
        
        categoria = str(row[20]).strip() if row[20] else 'VOLONTARIO'
        stato = str(row[21]).strip() if row[21] else 'Attivo'
        
        staff_id = str(uuid.uuid4())
        
        try:
            secondary_roles_json = json.dumps(secondary_roles) if secondary_roles else None
            
            cur.execute("""
                INSERT INTO staff_members (
                    id, first_name, last_name, fiscal_code, email, phone,
                    location_id, primary_role, secondary_roles, is_active
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                staff_id,
                first_name,
                last_name,
                codice_fiscale,
                email,
                telefono,
                location_id,
                primary_role,
                secondary_roles_json,
                True
            ))
            imported += 1
        except Exception as e:
            print(f"Error importing {first_name} {last_name}: {e}")
            conn.rollback()
            skipped += 1
    
    conn.commit()
    cur.close()
    conn.close()
    
    print(f"Import complete: {imported} imported, {skipped} skipped")

if __name__ == '__main__':
    import_staff()
