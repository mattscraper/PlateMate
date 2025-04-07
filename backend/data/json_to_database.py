import sqlite3
import os

# List all .db files in the current directory
print("Database files in current directory:")
for file in os.listdir():
    if file.endswith('.db'):
        print(f"  - {file} ({os.path.getsize(file) / 1024:.1f} KB)")

# Try to open both database files
for db_file in ['recipes.db', 'recipes.db']:
    if os.path.exists(db_file):
        print(f"\nChecking {db_file}:")
        try:
            conn = sqlite3.connect(db_file)
            cursor = conn.cursor()
            
            # Check table structure
            cursor.execute("PRAGMA table_info(recipes)")
            columns = cursor.fetchall()
            print(f"Table columns: {', '.join(col[1] for col in columns)}")
            
            # Check record count
            cursor.execute("SELECT COUNT(*) FROM recipes")
            count = cursor.fetchone()[0]
            print(f"Total recipes: {count}")
            
            # Check categories
            if count > 0:
                cursor.execute("SELECT category, COUNT(*) FROM recipes GROUP BY category")
                for category, cat_count in cursor.fetchall():
                    print(f"  - {category}: {cat_count}")
                    
                # Get a sample recipe
                cursor.execute("SELECT * FROM recipes LIMIT 1")
                sample = cursor.fetchone()
                print("\nSample recipe:")
                print(sample)
            
            conn.close()
        except Exception as e:
            print(f"Error: {str(e)}")