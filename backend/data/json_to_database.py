import sqlite3
import os
import argparse

def check_database(db_path=None):
    """
    Check SQLite database files in the current directory
    and report on their structure and content.
    """
    # Find all database files if no specific path provided
    if db_path is None:
        db_files = [f for f in os.listdir('.') if f.endswith('.db')]
        if not db_files:
            print("No database files found in current directory.")
            return
    else:
        if not os.path.exists(db_path):
            print(f"Database file not found: {db_path}")
            return
        db_files = [db_path]
    
    # Show current directory
    print(f"Current directory: {os.getcwd()}")
    
    # List all database files
    print("\nDatabase files:")
    for db_file in db_files:
        size_kb = os.path.getsize(db_file) / 1024
        print(f"  - {db_file} ({size_kb:.1f} KB)")
    
    # Check each database
    for db_file in db_files:
        print(f"\n=== Checking {db_file} ===")
        
        try:
            conn = sqlite3.connect(db_file)
            cursor = conn.cursor()
            
            # Get list of tables
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
            tables = cursor.fetchall()
            
            if not tables:
                print("No tables found in database.")
                conn.close()
                continue
                
            print(f"Tables in database: {', '.join(table[0] for table in tables)}")
            
            # Check each table
            for table in tables:
                table_name = table[0]
                print(f"\nTable: {table_name}")
                
                # Get table structure
                cursor.execute(f"PRAGMA table_info({table_name})")
                columns = cursor.fetchall()
                print("Columns:")
                for col in columns:
                    print(f"  - {col[1]} ({col[2]})")
                
                # Get row count
                cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
                count = cursor.fetchone()[0]
                print(f"Row count: {count}")
                
                if count > 0:
                    # If it's the recipes table, show category distribution
                    if table_name == 'recipes' and 'category' in [col[1] for col in columns]:
                        cursor.execute(f"SELECT category, COUNT(*) FROM {table_name} GROUP BY category")
                        categories = cursor.fetchall()
                        print("Categories:")
                        for category, cat_count in categories:
                            print(f"  - {category}: {cat_count}")
                        
                        # Sample row from each category
                        print("\nSample rows:")
                        for category, _ in categories:
                            cursor.execute(f"SELECT * FROM {table_name} WHERE category = ? LIMIT 1", (category,))
                            sample = cursor.fetchone()
                            if sample:
                                print(f"  {category}: {sample}")
                    else:
                        # Just show a few sample rows for other tables
                        cursor.execute(f"SELECT * FROM {table_name} LIMIT 3")
                        samples = cursor.fetchall()
                        print("Sample rows:")
                        for sample in samples:
                            print(f"  {sample}")
            
            conn.close()
            
        except Exception as e:
            print(f"Error analyzing database: {str(e)}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Check SQLite database structure and content')
    parser.add_argument('--db', help='Path to specific database file (optional)')
    
    args = parser.parse_args()
    check_database(args.db)