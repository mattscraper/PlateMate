import json
import os

print("File size:", os.path.getsize("cleaned_categorized_recipes.json"), "bytes")


with open("cleaned_categorized_recipes.json", "r") as f:
    data = json.load(f)

keywords = {
    "breakfast": [
        "pancake", "toast", "omelet", "waffle", "bagel", "muffin", "breakfast", "granola", "cereal",
        "smoothie", "bacon", "egg", "hash", "frittata", "quiche", "scramble", "sausage", "avocado", "oatmeal",
        "french toast", "breakfast burrito", "crepe"
    ],
    "lunch": [
        "sandwich", "wrap", "salad", "burger", "soup", "grilled", "lunch", "panini", "bowl",
        "quesadilla", "gyro", "club", "sub", "pita", "sliders", "chili", "noodle", "taco", "bento",
        "chicken salad", "rice bowl"
    ],
    "dinner": [
        "chicken", "beef", "pasta", "steak", "rice", "curry", "lasagna", "dinner", "meatloaf", "pot roast",
        "fish", "shrimp", "noodles", "enchiladas", "casserole", "stuffed", "stew", "ravioli", "gnocchi", "kebab",
        "ziti", "macaroni", "spaghetti", "roast", "meatballs", "chops"
    ],
    "dessert": [
        "cake", "cookie", "brownie", "ice cream", "pudding", "pie", "dessert", "cheesecake", "tart",
        "mousse", "cobbler", "cupcake", "sundae", "banana bread", "macaron", "eclair", "donut", "truffle",
        "brittle", "fudge", "sorbet", "parfait"
    ],
      "snack": [
        "snack", "nuts", "granola", "bars", "popcorn", "trail mix", "crackers", "cheese", "chips", 
        "dip", "fruit", "yogurt", "smoothie", "energy ball", "hummus", "pretzel"
    ],
}



def matches_category(title, category_keywords):
    title = title.lower()
    return any(keyword in title for keyword in category_keywords)

cleaned_data = {cat: [] for cat in keywords}

for category, recipes in data.items():
    for title in recipes:
        if matches_category(title, keywords[category]):
            cleaned_data[category].append(title)

with open("cleaned_recipes2.json", "w") as f:
    json.dump(cleaned_data,f, indent = 2)


print("Recipes have been saved to file!")