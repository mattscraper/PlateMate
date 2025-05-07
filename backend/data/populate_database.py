import json
import sqlite3
import os
import sys
import time
import argparse

def populate_database(json_file_path, db_path, batch_size=5000):
    """
    Populate SQLite database from a large JSON file containing recipes.
    
    Args:
        json_file_path: Path to the JSON file with recipe data
        db_path: Path to create/use for the SQLite database
        batch_size: Number of recipes to process in each batch
    """
    print(f"Starting conversion of {json_file_path} to SQLite database at {db_path}...")
    start_time = time.time()
    
    # Check if JSON file exists
    if not os.path.exists(json_file_path):
        print(f"ERROR: JSON file not found: {json_file_path}")
        print(f"Current directory: {os.getcwd()}")
        print(f"Files in directory: {os.listdir('.')}")
        return False
    
    # Check if database already exists and delete it
    if os.path.exists(db_path):
        print(f"Removing existing database: {db_path}")
        os.remove(db_path)
    
    # Connect to the database
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Create table for recipes
    cursor.execute('''
    CREATE TABLE recipes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        category TEXT NOT NULL
    )
    ''')
    
    # Enable faster inserts
    cursor.execute("PRAGMA synchronous = OFF")
    cursor.execute("PRAGMA journal_mode = MEMORY")
    cursor.execute("BEGIN TRANSACTION")
    
    total_recipes = 0
    current_batch = 0
    
    try:
        # Check file size
        file_size = os.path.getsize(json_file_path) / (1024 * 1024)  # Size in MB
        print(f"JSON file size: {file_size:.2f} MB")
        
        # Process the JSON file
        print("Reading JSON file...")
        
        with open(json_file_path, 'r') as file:
            try:
                data = json.load(file)
                print(f"JSON loaded successfully with {len(data)} categories")
                
                # Process each category
                for category, recipes in data.items():
                    print(f"Processing category: {category} with {len(recipes)} recipes")
                    
                    # Process recipes in batches
                    for i in range(0, len(recipes), batch_size):
                        batch_recipes = recipes[i:i+batch_size]
                        
                        # Prepare batch of recipe titles
                        batch_data = []
                        for recipe in batch_recipes:
                            if isinstance(recipe, dict):
                                # Extract title from the dictionary
                                title = recipe.get('title', '')
                                if not title and 'name' in recipe:
                                    title = recipe['name']
                                if not title:
                                    # If no title field, use the first value as a fallback
                                    for key, value in recipe.items():
                                        if isinstance(value, str):
                                            title = value
                                            break
                                
                                # If we still don't have a title, generate one
                                if not title:
                                    title = f"Recipe #{total_recipes + 1}"
                                    
                                batch_data.append((title, category))
                            else:
                                # If it's a string or other simple type, just use it as the title
                                batch_data.append((str(recipe), category))
                        
                        # Execute batch insert
                        cursor.executemany(
                            "INSERT INTO recipes (title, category) VALUES (?, ?)",
                            batch_data
                        )
                        
                        # Update counters and commit
                        current_batch += 1
                        total_recipes += len(batch_recipes)
                        
                        # Print progress and commit regularly
                        print(f"Processed {total_recipes} recipes so far...")
                        conn.commit()
                        cursor.execute("BEGIN TRANSACTION")
                
                # Final commit
                conn.commit()
                
            except json.JSONDecodeError as e:
                print(f"Error decoding JSON: {str(e)}")
                return False
    
        # Create indexes for faster querying
        print("Creating indexes...")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_category ON recipes (category)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_title ON recipes (title)")
        
        # Verify the data
        cursor.execute("SELECT COUNT(*) FROM recipes")
        total_count = cursor.fetchone()[0]
        
        # Show statistics per category
        cursor.execute("SELECT category, COUNT(*) FROM recipes GROUP BY category")
        category_stats = cursor.fetchall()
        
        end_time = time.time()
        elapsed_time = end_time - start_time
        
        print("\n--- Conversion Summary ---")
        print(f"Total recipes added: {total_count}")
        print("Recipes by category:")
        for category, count in category_stats:
            print(f"  {category}: {count}")
        print(f"Conversion completed in {elapsed_time:.2f} seconds")
        print(f"Database created at: {os.path.abspath(db_path)}")
        print(f"Database file size: {os.path.getsize(db_path) / (1024 * 1024):.2f} MB")
        
        return True
        
    except Exception as e:
        # If anything goes wrong, roll back
        conn.rollback()
        print(f"Error during conversion: {str(e)}")
        return False
    finally:
        # Always close the connection
        conn.close()

def verify_database(db_path):
    """Verify database was created properly and contains data"""
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Test basic queries
        cursor.execute("SELECT COUNT(*) FROM recipes")
        count = cursor.fetchone()[0]
        print(f"\nDatabase verification:")
        print(f"Total recipes: {count}")
        
        if count > 0:
            cursor.execute("SELECT category, COUNT(*) FROM recipes GROUP BY category")
            for category, cat_count in cursor.fetchall():
                print(f"  - {category}: {cat_count}")
            
            # Get sample recipes from each category
            cursor.execute("SELECT DISTINCT category FROM recipes")
            categories = [row[0] for row in cursor.fetchall()]
            
            for category in categories:
                cursor.execute("SELECT id, title FROM recipes WHERE category = ? LIMIT 1", (category,))
                sample = cursor.fetchone()
                print(f"\nSample {category} recipe (ID {sample[0]}): {sample[1]}")
        
        conn.close()
        return count > 0
    except Exception as e:
        print(f"Database verification error: {str(e)}")
        return False

if __name__ == "__main__":
    # Parse command line arguments
    parser = argparse.ArgumentParser(description='Convert JSON recipe file to SQLite database')
    parser.add_argument('--json', default='new_recipes.json', help='Path to JSON file')
    parser.add_argument('--db', default='recipes.db', help='Path for output database')
    parser.add_argument('--batch', type=int, default=5000, help='Batch size for processing')
    
    args = parser.parse_args()
    
    # Run the conversion
    success = populate_database(args.json, args.db, args.batch)
    
    if success:
        # Verify the database
        verify_database(args.db)
    else:
        print("Conversion failed!")