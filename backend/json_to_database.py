import sqlite3

db_path = 'recipes.db'

try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Test basic queries
    cursor.execute("SELECT COUNT(*) FROM recipes")
    count = cursor.fetchone()[0]
    print(f"Total recipes: {count}")
    
    cursor.execute("SELECT category, COUNT(*) FROM recipes GROUP BY category")
    for category, cat_count in cursor.fetchall():
        print(f"  - {category}: {cat_count}")
    
    # Get a sample recipe
    cursor.execute("SELECT * FROM recipes LIMIT 1")
    sample = cursor.fetchone()
    print("\nSample recipe:")
    print(sample)
    
    conn.close()
    print("\nDatabase test successful!")
    
except Exception as e:
    print(f"Database error: {str(e)}")