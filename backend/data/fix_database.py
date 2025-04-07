import sqlite3
import os

# Path for the database
db_path = 'recipes.db'

# Remove the existing database if it exists
if os.path.exists(db_path):
    print(f"Removing existing database: {db_path}")
    os.remove(db_path)

# Create a new database
print(f"Creating new database at {db_path}")
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Create the recipes table
cursor.execute('''
CREATE TABLE recipes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    category TEXT NOT NULL
)
''')

# Add some sample data for testing
sample_data = [
    ('Pancakes', 'breakfast'),
    ('Scrambled Eggs', 'breakfast'),
    ('Oatmeal', 'breakfast'),
    ('Sandwich', 'lunch'),
    ('Salad', 'lunch'),
    ('Soup', 'lunch'),
    ('Steak', 'dinner'),
    ('Pasta', 'dinner'),
    ('Chicken', 'dinner'),
    ('Yogurt', 'snack'),
    ('Fruit', 'snack'),
    ('Nuts', 'snack'),
    ('Cake', 'dessert'),
    ('Ice Cream', 'dessert'),
    ('Cookies', 'dessert')
]

# Insert sample data
cursor.executemany(
    "INSERT INTO recipes (title, category) VALUES (?, ?)",
    sample_data
)

# Create indexes
cursor.execute("CREATE INDEX idx_category ON recipes (category)")
cursor.execute("CREATE INDEX idx_title ON recipes (title)")

# Commit and close
conn.commit()
conn.close()

print("Database created successfully with sample data")
print(f"Database location: {os.path.abspath(db_path)}")