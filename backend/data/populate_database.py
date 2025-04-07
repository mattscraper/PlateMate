import json
import sqlite3
import os
import sys
import time

# Path to your large JSON file
json_file_path = 'categorized_recipes.json'
db_path = 'recipes.db'

print(f"Starting conversion of {json_file_path} to SQLite database (titles only)...")
start_time = time.time()

# Check if database already exists and delete it
if os.path.exists(db_path):
    print(f"Removing existing database: {db_path}")
    os.remove(db_path)

# Connect to the database
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Create a simple table for recipes - just title and category
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
batch_size = 5000
current_batch = 0

try:
    # Check file size
    file_size = os.path.getsize(json_file_path) / (1024 * 1024)  # Size in MB
    print(f"JSON file size: {file_size:.2f} MB")
    
    # Process the JSON file
    print("Reading JSON file...")
    
    with open(json_file_path, 'r') as file:
        # Load the full JSON
        try:
            data = json.load(file)
            print(f"JSON loaded successfully with {len(data)} categories")
            
            # Check the structure of the first recipe in each category
            for category, recipes in data.items():
                if recipes and len(recipes) > 0:
                    sample_recipe = recipes[0]
                    print(f"Sample from '{category}': {type(sample_recipe)}")
            
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
                    
                    # Commit each batch
                    current_batch += 1
                    total_recipes += len(batch_recipes)
                    
                    # Print progress
                    print(f"Processed {total_recipes} recipes so far...")
                    conn.commit()  # Commit each batch for safety
                    cursor.execute("BEGIN TRANSACTION")
            
            # Final commit
            conn.commit()
            
        except json.JSONDecodeError as e:
            print(f"Error decoding JSON: {str(e)}")
            sys.exit(1)

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
    
except Exception as e:
    # If anything goes wrong, roll back
    conn.rollback()
    print(f"Error during conversion: {str(e)}")
    raise
finally:
    # Always close the connection
    conn.close()