import re
import json
from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass
from collections import defaultdict
import random
from flask import Blueprint

@dataclass
class GroceryItem:
    name: str
    quantity: str
    unit: str
    category: str
    notes: str = ""

@dataclass
class CostBreakdown:
    total_cost: float
    cost_per_day: float
    cost_per_meal: float
    category_breakdown: Dict[str, float]
    item_count: int
    excluded_items: List[str]

class GroceryListGenerator:
    def __init__(self):
        # Improved ingredient categories with more comprehensive and specific matching
        self.categories = {
            'proteins': [
                # Meat & Poultry
                'chicken', 'beef', 'pork', 'turkey', 'lamb', 'duck', 'bacon', 'ham', 'sausage',
                'ground beef', 'ground turkey', 'ground chicken', 'steak', 'pork chops',
                'chicken breast', 'chicken thighs', 'chicken wings', 'ribs', 'brisket',
                
                # Seafood
                'fish', 'salmon', 'tuna', 'shrimp', 'crab', 'lobster', 'cod', 'tilapia',
                'mahi mahi', 'halibut', 'trout', 'sardines', 'anchovies', 'scallops',
                
                # Plant-based proteins
                'tofu', 'tempeh', 'seitan', 'beans', 'lentils', 'chickpeas', 'black beans',
                'kidney beans', 'pinto beans', 'navy beans', 'lima beans', 'edamame',
                
                # Eggs & Dairy proteins
                'eggs', 'egg whites', 'cottage cheese', 'greek yogurt'
            ],
            
            'vegetables': [
                # Common vegetables
                'onion', 'garlic', 'tomato', 'carrot', 'celery', 'bell pepper', 'broccoli',
                'spinach', 'lettuce', 'cucumber', 'potato', 'sweet potato', 'mushroom',
                'zucchini', 'corn', 'peas', 'green beans', 'cauliflower', 'cabbage',
                'kale', 'asparagus', 'brussels sprouts', 'beets', 'radish', 'turnip',
                'parsnip', 'leek', 'shallot', 'scallion', 'green onion', 'chives',
                'jalapeño', 'serrano', 'poblano', 'habanero', 'thai chili',
                'red pepper', 'yellow pepper', 'orange pepper', 'eggplant',
                'artichoke', 'fennel', 'bok choy', 'swiss chard', 'collard greens',
                'arugula', 'watercress', 'endive', 'radicchio'
            ],
            
            'fruits': [
                'apple', 'banana', 'orange', 'lemon', 'lime', 'grapefruit',
                'strawberry', 'blueberry', 'raspberry', 'blackberry', 'cranberry',
                'grape', 'avocado', 'mango', 'pineapple', 'peach', 'pear', 'plum',
                'cherry', 'apricot', 'kiwi', 'papaya', 'passion fruit', 'pomegranate',
                'watermelon', 'cantaloupe', 'honeydew', 'dates', 'figs', 'raisins'
            ],
            
            'dairy': [
                'milk', 'cheese', 'butter', 'yogurt', 'cream', 'sour cream',
                'cottage cheese', 'mozzarella', 'cheddar', 'parmesan', 'feta',
                'goat cheese', 'brie', 'camembert', 'swiss cheese', 'provolone',
                'ricotta', 'mascarpone', 'cream cheese', 'heavy cream', 'half and half',
                'buttermilk', 'whole milk', 'skim milk', '2% milk', 'almond milk',
                'oat milk', 'soy milk', 'coconut milk'
            ],
            
            'grains': [
                'rice', 'pasta', 'bread', 'flour', 'oats', 'quinoa', 'barley',
                'couscous', 'noodles', 'cereal', 'tortilla', 'crackers', 'bagel',
                'english muffin', 'pita bread', 'sourdough', 'whole wheat bread',
                'brown rice', 'white rice', 'jasmine rice', 'basmati rice',
                'wild rice', 'arborio rice', 'spaghetti', 'penne', 'fettuccine',
                'linguine', 'rigatoni', 'angel hair', 'lasagna sheets',
                'all-purpose flour', 'whole wheat flour', 'bread flour',
                'rolled oats', 'steel cut oats', 'instant oats'
            ],
            
            'pantry': [
                # Oils & Vinegars
                'olive oil', 'vegetable oil', 'canola oil', 'coconut oil', 'sesame oil',
                'vinegar', 'balsamic vinegar', 'apple cider vinegar', 'white vinegar',
                'red wine vinegar', 'rice vinegar',
                
                # Basic seasonings & condiments
                'salt', 'pepper', 'black pepper', 'white pepper', 'sea salt',
                'kosher salt', 'sugar', 'brown sugar', 'honey', 'maple syrup',
                'vanilla extract', 'baking powder', 'baking soda', 'cornstarch',
                'flour', 'stock', 'broth', 'chicken stock', 'vegetable stock',
                'beef stock', 'chicken broth', 'vegetable broth',
                
                # Canned goods
                'canned tomatoes', 'tomato paste', 'tomato sauce', 'coconut milk',
                'canned beans', 'canned corn', 'canned peas'
            ],
            
            'herbs_spices': [
                'basil', 'oregano', 'thyme', 'rosemary', 'sage', 'parsley', 'cilantro',
                'dill', 'mint', 'tarragon', 'chervil', 'paprika', 'cumin', 'coriander',
                'chili powder', 'cayenne', 'garlic powder', 'onion powder',
                'cinnamon', 'nutmeg', 'ginger', 'turmeric', 'cardamom', 'cloves',
                'allspice', 'bay leaves', 'fennel seeds', 'caraway seeds',
                'mustard seeds', 'celery seeds', 'poppy seeds', 'sesame seeds',
                'curry powder', 'garam masala', 'chinese five spice', 'italian seasoning',
                'herbs de provence', 'za\'atar', 'sumac', 'smoked paprika'
            ],
            
            'condiments': [
                'mustard', 'ketchup', 'mayonnaise', 'bbq sauce', 'ranch dressing',
                'italian dressing', 'caesar dressing', 'blue cheese dressing',
                'balsamic glaze', 'worcestershire sauce', 'sriracha', 'hot sauce',
                'tabasco', 'soy sauce', 'tamari', 'fish sauce', 'oyster sauce',
                'hoisin sauce', 'teriyaki sauce', 'miso paste', 'tahini',
                'pesto', 'salsa', 'marinara sauce', 'alfredo sauce'
            ],
            
            'frozen': [
                'frozen vegetables', 'frozen fruit', 'frozen berries', 'ice cream',
                'frozen pizza', 'frozen chicken', 'frozen fish', 'frozen shrimp',
                'frozen meals', 'frozen waffles', 'frozen fries', 'frozen corn',
                'frozen peas', 'frozen broccoli', 'frozen spinach'
            ],
            
            'snacks': [
                'nuts', 'almonds', 'walnuts', 'pecans', 'cashews', 'peanuts',
                'pistachios', 'chips', 'potato chips', 'tortilla chips',
                'crackers', 'granola bars', 'pretzels', 'popcorn', 'trail mix',
                'cookies', 'chocolate', 'candy'
            ],
            
            'beverages': [
                'water', 'sparkling water', 'juice', 'orange juice', 'apple juice',
                'cranberry juice', 'soda', 'cola', 'sprite', 'coffee', 'tea',
                'green tea', 'black tea', 'herbal tea', 'wine', 'red wine',
                'white wine', 'beer', 'energy drink', 'sports drink'
            ]
        }
        
        # Categories that should be excluded from cost calculations (reusable items)
        self.cost_excluded_categories = ['herbs_spices', 'condiments']
        
        # Reduced and more realistic estimated costs per typical serving/recipe portion (USD)
        self.estimated_costs = {
            # Proteins (per serving) - reduced prices
            'chicken': 1.80, 'beef': 3.20, 'pork': 2.40, 'fish': 3.50, 'salmon': 4.25,
            'tuna': 1.60, 'eggs': 1.20, 'tofu': 1.50, 'beans': 0.60, 'lentils': 0.50,
            'turkey': 2.40, 'shrimp': 4.50, 'lamb': 3.75, 'bacon': 1.80,
            'ground beef': 2.80, 'steak': 4.50, 'ham': 2.00, 'duck': 3.90,
            'chicken breast': 2.00, 'chicken thighs': 1.60, 'ground turkey': 2.20,

            # Vegetables (per serving) - reduced prices
            'onion': 0.50, 'garlic': 0.25, 'tomato': 1.20, 'carrot': 0.60, 'celery': 0.75,
            'bell pepper': 1.20, 'broccoli': 1.00, 'spinach': 0.90, 'lettuce': 0.80,
            'cucumber': 0.90, 'potato': 0.60, 'sweet potato': 0.80, 'mushroom': 1.40,
            'zucchini': 0.85, 'corn': 0.85, 'peas': 1.00, 'green beans': 1.10,
            'cauliflower': 1.20, 'cabbage': 0.70, 'kale': 1.00, 'asparagus': 1.80,
            'brussels sprouts': 1.40, 'beets': 0.90, 'radish': 0.70, 'arugula': 1.10,

            # Fruits (per serving) - reduced prices
            'apple': 0.80, 'banana': 0.45, 'orange': 0.90, 'lemon': 0.60, 'lime': 0.50,
            'berries': 1.80, 'strawberry': 1.50, 'blueberry': 2.00, 'grape': 1.20,
            'avocado': 1.60, 'mango': 1.20, 'pineapple': 1.50, 'peach': 1.00, 'pear': 0.80,
            'cherry': 2.10, 'plum': 0.90, 'watermelon': 1.20, 'cantaloupe': 1.10,

            # Dairy (per serving) - reduced prices
            'milk': 1.00, 'cheese': 1.50, 'butter': 0.75, 'yogurt': 1.10, 'cream': 0.85,
            'sour cream': 0.75, 'cottage cheese': 1.10, 'mozzarella': 1.70,
            'cheddar': 1.80, 'parmesan': 1.50, 'cream cheese': 1.10, 'feta': 1.20,

            # Grains (per serving) - reduced prices
            'rice': 0.50, 'pasta': 0.75, 'bread': 0.90, 'flour': 0.40, 'oats': 0.60,
            'quinoa': 1.20, 'barley': 0.45, 'couscous': 0.70, 'noodles': 0.80,
            'cereal': 1.00, 'tortilla': 0.80, 'crackers': 1.00, 'bagel': 0.85,

            # Frozen foods (per serving) - reduced prices
            'frozen vegetables': 0.90, 'frozen fruit': 1.20, 'ice cream': 1.80,
            'frozen pizza': 3.75, 'frozen chicken': 2.20, 'frozen meals': 2.80,

            # Snacks (per serving) - reduced prices
            'nuts': 1.50, 'chips': 1.10, 'granola bars': 1.40, 'pretzels': 0.90,
            'popcorn': 1.00, 'trail mix': 1.60, 'cookies': 1.20, 'crackers': 1.10,

            # Beverages (per serving) - reduced prices
            'water': 0.20, 'juice': 1.00, 'soda': 1.25, 'coffee': 0.50, 'tea': 0.40,
            'wine': 4.00, 'beer': 2.00, 'smoothie': 2.40, 'energy drink': 1.60,

            # Default for unknown items
            'default': 1.20
        }

    def parse_meal_plan(self, meal_plan_text: str) -> List[Dict]:
        """Parse meal plan text and extract ingredient lists"""
        print("🔍 Starting meal plan parsing for grocery list...")
        
        # Split by recipe separators
        recipes = meal_plan_text.split('=====')
        parsed_recipes = []
        
        for recipe_text in recipes:
            if not recipe_text.strip():
                continue
                
            lines = recipe_text.strip().split('\n')
            recipe_data = {
                'title': '',
                'ingredients': []
            }
            
            # Find title (first substantial line that's not a day marker)
            for line in lines:
                line = line.strip()
                if (line and len(line) > 3 and
                    not line.lower().startswith('day ') and
                    not any(meal in line.lower() for meal in ['breakfast', 'lunch', 'dinner', 'snack']) and
                    ':' not in line and
                    not line.startswith('•') and
                    not line.lower().startswith('preparation') and
                    not line.lower().startswith('cooking') and
                    not line.lower().startswith('servings')):
                    recipe_data['title'] = line
                    break
            
            # Extract ingredients (lines starting with •)
            for line in lines:
                line = line.strip()
                if line.startswith('•'):
                    ingredient = line[1:].strip()
                    if ingredient:
                        recipe_data['ingredients'].append(ingredient)
            
            if recipe_data['title'] and recipe_data['ingredients']:
                parsed_recipes.append(recipe_data)
        
        print(f"✅ Parsed {len(parsed_recipes)} recipes with ingredients")
        return parsed_recipes

    def extract_and_consolidate_ingredients(self, recipes: List[Dict]) -> List[GroceryItem]:
        """Extract ingredients and consolidate similar items"""
        print("🔄 Consolidating ingredients...")
        
        # Dictionary to consolidate ingredients
        consolidated = defaultdict(lambda: {
            'quantities': [],
            'units': set(),
            'notes': set(),
            'category': 'pantry',
            'base_name': ''
        })
        
        for recipe in recipes:
            for ingredient_text in recipe['ingredients']:
                parsed = self._parse_ingredient(ingredient_text)
                if parsed:
                    base_name = parsed['base_name']
                    
                    # Add to consolidated list
                    consolidated[base_name]['quantities'].append(parsed['quantity'])
                    consolidated[base_name]['units'].add(parsed['unit'])
                    consolidated[base_name]['notes'].add(parsed['notes'])
                    consolidated[base_name]['category'] = self._categorize_ingredient(base_name)
                    consolidated[base_name]['base_name'] = base_name
        
        # Convert to GroceryItem objects
        grocery_items = []
        for base_name, data in consolidated.items():
            # Combine quantities intelligently
            total_quantity = self._combine_quantities(data['quantities'], list(data['units']))
            
            # Combine notes
            notes = ' • '.join(filter(None, data['notes']))
            
            grocery_item = GroceryItem(
                name=base_name.title(),
                quantity=total_quantity['display'],
                unit=total_quantity['unit'],
                category=data['category'],
                notes=notes[:100] if notes else ""  # Limit notes length
            )
            grocery_items.append(grocery_item)
        
        print(f"✅ Created {len(grocery_items)} consolidated grocery items")
        return grocery_items

    def _parse_ingredient(self, ingredient_text: str) -> Optional[Dict]:
        """Parse individual ingredient text with improved accuracy"""
        # Clean up the text
        ingredient_text = ingredient_text.strip()
        if not ingredient_text:
            return None
        
        # More comprehensive patterns to extract quantity, unit, and ingredient name
        patterns = [
            # Pattern 1: Number + unit + ingredient (e.g., "2 cups flour", "1 lb chicken")
            r'^(\d+(?:\.\d+)?(?:\s*-\s*\d+(?:\.\d+)?)?)\s*(cups?|cup|tbsp|tablespoons?|tsp|teaspoons?|lbs?|pounds?|oz|ounces?|g|grams?|kg|kilograms?|pieces?|piece|cloves?|clove|slices?|slice|cans?|can|packages?|package|containers?|container|bottles?|bottle|jars?|jar|heads?|head|bunches?|bunch|stalks?|stalk)\s+(.+)$',
            
            # Pattern 2: Fraction + unit + ingredient (e.g., "1/2 cup milk")
            r'^(\d+/\d+|\d+\s+\d+/\d+)\s*(cups?|cup|tbsp|tablespoons?|tsp|teaspoons?|lbs?|pounds?|oz|ounces?|g|grams?|kg|kilograms?)\s+(.+)$',
            
            # Pattern 3: Number + ingredient without clear unit (e.g., "2 chicken breasts", "3 eggs")
            r'^(\d+(?:\.\d+)?)\s+(.+)$',
            
            # Pattern 4: Just the ingredient name
            r'^(.+)$'
        ]
        
        quantity = "1"
        unit = "item"
        base_name = ingredient_text.lower()
        notes = ""
        
        for pattern in patterns:
            match = re.match(pattern, ingredient_text, re.IGNORECASE)
            if match:
                groups = match.groups()
                if len(groups) == 3:  # quantity + unit + ingredient
                    quantity = groups[0]
                    unit = groups[1] or "item"
                    base_name = groups[2].lower()
                elif len(groups) == 2:  # quantity + ingredient or fraction + unit + ingredient
                    if any(word in groups[1].lower() for word in ['cup', 'tbsp', 'tsp', 'lb', 'oz']):
                        # This is likely fraction + unit + ingredient combined
                        quantity = groups[0]
                        # Try to separate unit from ingredient in groups[1]
                        unit_ingredient = groups[1].split(' ', 1)
                        if len(unit_ingredient) == 2:
                            unit = unit_ingredient[0]
                            base_name = unit_ingredient[1].lower()
                        else:
                            base_name = groups[1].lower()
                    else:
                        # This is quantity + ingredient
                        quantity = groups[0]
                        base_name = groups[1].lower()
                elif len(groups) == 1:  # just ingredient
                    base_name = groups[0].lower()
                break
        
        # Clean base name - remove common descriptors and extract core ingredient
        base_name = self._clean_ingredient_name(base_name)
        
        return {
            'quantity': quantity,
            'unit': unit.lower(),
            'base_name': base_name,
            'notes': notes
        }

    def _clean_ingredient_name(self, ingredient_name: str) -> str:
        """Clean ingredient name and extract the core ingredient"""
        original_name = ingredient_name.lower().strip()
        
        # Remove common descriptors and preparation methods
        descriptors_to_remove = [
            # Preparation methods
            'fresh', 'dried', 'chopped', 'diced', 'minced', 'sliced', 'grated', 'shredded',
            'ground', 'whole', 'crushed', 'julienned', 'cubed', 'quartered', 'halved',
            
            # Quality/type descriptors
            'organic', 'raw', 'cooked', 'frozen', 'canned', 'bottled', 'jarred',
            'large', 'medium', 'small', 'extra', 'virgin', 'extra virgin',
            'unsalted', 'salted', 'low-fat', 'fat-free', 'reduced-fat', 'skim',
            'whole grain', 'refined', 'unrefined', 'processed', 'unprocessed',
            
            # Optional/serving descriptors
            'to taste', 'optional', 'for serving', 'for garnish', 'as needed',
            'or to taste', 'preferably', 'ideally', 'approximately',
            
            # Color descriptors
            'red', 'green', 'yellow', 'white', 'black', 'brown', 'orange', 'purple',
            
            # Common adjectives
            'hot', 'cold', 'warm', 'room temperature', 'chilled', 'heated'
        ]
        
        cleaned_name = original_name
        
        # Remove descriptors
        for descriptor in descriptors_to_remove:
            # Use word boundaries to avoid removing parts of words
            pattern = r'\b' + re.escape(descriptor) + r'\b'
            cleaned_name = re.sub(pattern, '', cleaned_name)
        
        # Clean up extra spaces, commas, and parenthetical information
        cleaned_name = re.sub(r'\([^)]*\)', '', cleaned_name)  # Remove parenthetical info
        cleaned_name = re.sub(r'\s+', ' ', cleaned_name)  # Multiple spaces to single
        cleaned_name = cleaned_name.strip(' ,.-')  # Remove leading/trailing punctuation
        
        # If cleaning made the name too short or empty, use original
        if len(cleaned_name) < 2:
            cleaned_name = original_name
        
        # Extract the core ingredient (first 1-2 meaningful words)
        words = cleaned_name.split()
        if len(words) >= 2:
            # For compound ingredients, keep first two words if they make sense together
            core_ingredient = ' '.join(words[:2])
        else:
            core_ingredient = cleaned_name
        
        return core_ingredient.strip()

    def _categorize_ingredient(self, ingredient_name: str) -> str:
        """Improved categorization with priority-based matching"""
        ingredient_lower = ingredient_name.lower().strip()
        
        # Priority order for categorization (more specific categories first)
        category_priority = [
            'proteins', 'vegetables', 'fruits', 'dairy', 'grains',
            'herbs_spices', 'condiments', 'frozen', 'snacks', 'beverages', 'pantry'
        ]
        
        for category in category_priority:
            items = self.categories[category]
            
            # Exact match first
            if ingredient_lower in items:
                return category
            
            # Partial match - check if ingredient contains any category item
            for item in items:
                if item in ingredient_lower:
                    return category
            
            # Reverse partial match - check if any category item contains the ingredient
            for item in items:
                if ingredient_lower in item:
                    return category
        
        # Special case handling for common misclassifications
        
        # Meat/protein keywords
        protein_keywords = ['meat', 'protein', 'breast', 'thigh', 'fillet', 'cutlet', 'chop']
        if any(keyword in ingredient_lower for keyword in protein_keywords):
            return 'proteins'
        
        # Vegetable keywords
        vegetable_keywords = ['vegetable', 'veggie', 'fresh produce']
        if any(keyword in ingredient_lower for keyword in vegetable_keywords):
            return 'vegetables'
        
        # Spice/herb keywords
        spice_keywords = ['spice', 'herb', 'seasoning', 'powder', 'dried']
        if any(keyword in ingredient_lower for keyword in spice_keywords):
            return 'herbs_spices'
        
        # Oil/pantry keywords
        pantry_keywords = ['oil', 'sauce', 'stock', 'broth', 'paste', 'extract']
        if any(keyword in ingredient_lower for keyword in pantry_keywords):
            return 'pantry'
        
        return 'pantry'  # Default category

    def _combine_quantities(self, quantities: List[str], units: List[str]) -> Dict:
        """Intelligently combine quantities with better handling"""
        if not quantities:
            return {'display': '1', 'unit': 'item'}
        
        # Handle fractions and mixed numbers
        def parse_quantity(q_str):
            q_str = q_str.strip()
            
            # Handle ranges like "1-2"
            if '-' in q_str:
                parts = q_str.split('-')
                try:
                    return (float(parts[0]) + float(parts[1])) / 2
                except ValueError:
                    return 1.0
            
            # Handle fractions like "1/2" or "1 1/2"
            if '/' in q_str:
                try:
                    if ' ' in q_str:  # Mixed number like "1 1/2"
                        whole, fraction = q_str.split(' ', 1)
                        whole_val = float(whole)
                        num, den = fraction.split('/')
                        frac_val = float(num) / float(den)
                        return whole_val + frac_val
                    else:  # Simple fraction like "1/2"
                        num, den = q_str.split('/')
                        return float(num) / float(den)
                except ValueError:
                    return 1.0
            
            # Handle regular numbers
            try:
                return float(q_str)
            except ValueError:
                return 1.0
        
        # Parse all quantities
        numeric_quantities = [parse_quantity(q) for q in quantities]
        
        if numeric_quantities:
            total = sum(numeric_quantities)
            
            # Format the display based on the total
            if total < 1:
                if total == 0.5:
                    display = "1/2"
                elif total == 0.25:
                    display = "1/4"
                elif total == 0.75:
                    display = "3/4"
                else:
                    display = f"{total:.2f}".rstrip('0').rstrip('.')
            elif total < 10:
                # Check if it's close to a common fraction
                if abs(total - round(total) - 0.5) < 0.1:
                    display = f"{int(total)} 1/2"
                else:
                    display = f"{total:.1f}".rstrip('0').rstrip('.')
            else:
                display = str(int(round(total)))
            
            # Choose most appropriate unit
            if units:
                # Remove empty units and choose the most common
                valid_units = [u for u in units if u and u != 'item']
                if valid_units:
                    unit = max(set(valid_units), key=valid_units.count)
                else:
                    unit = 'item'
            else:
                unit = 'item'
            
            return {'display': display, 'unit': unit}
        
        # If can't combine numerically, show count or first quantity
        if len(quantities) == 1:
            unit = units[0] if units and units[0] else 'item'
            return {'display': quantities[0], 'unit': unit}
        else:
            return {'display': f"{len(quantities)} portions", 'unit': 'needed'}

    def _estimate_cost(self, ingredient_name: str, quantity_info: Dict, category: str) -> float:
        """Estimate cost for an ingredient with improved accuracy"""
        # Return 0 for excluded categories
        if category in self.cost_excluded_categories:
            return 0.0
        
        # Get base cost
        ingredient_lower = ingredient_name.lower()
        base_cost = self.estimated_costs.get(ingredient_lower, self.estimated_costs['default'])
        
        # Check for more specific matches in cost database
        if base_cost == self.estimated_costs['default']:
            for cost_item, cost in self.estimated_costs.items():
                if cost_item in ingredient_lower or ingredient_lower in cost_item:
                    base_cost = cost
                    break
        
        # Adjust based on quantity with more conservative scaling
        try:
            quantity_str = quantity_info['display']
            
            if 'portions' in quantity_str:
                # Extract number from "X portions"
                match = re.search(r'(\d+(?:\.\d+)?)', quantity_str)
                multiplier = float(match.group(1)) if match else 1.0
            else:
                # Handle fractions and regular numbers
                if '/' in quantity_str:
                    if ' ' in quantity_str:  # Mixed number
                        whole, fraction = quantity_str.split(' ', 1)
                        whole_val = float(whole)
                        num, den = fraction.split('/')
                        frac_val = float(num) / float(den)
                        multiplier = whole_val + frac_val
                    else:  # Simple fraction
                        num, den = quantity_str.split('/')
                        multiplier = float(num) / float(den)
                else:
                    multiplier = float(quantity_str)
                    
        except (ValueError, AttributeError, ZeroDivisionError):
            multiplier = 1.0
        
        # More conservative quantity scaling to prevent unrealistic costs
        if multiplier > 10:  # Cap at 10x for very large quantities
            adjusted_multiplier = min(multiplier, 15)
        elif multiplier > 3:  # Reduce scaling for larger quantities
            adjusted_multiplier = 3 + (multiplier - 3) * 0.3
        elif multiplier < 0.5:  # Don't go below half the base cost
            adjusted_multiplier = 0.5
        else:
            adjusted_multiplier = multiplier
        
        # Add smaller variance for more consistent estimates
        variance = random.uniform(0.85, 1.15)
        
        estimated_cost = base_cost * adjusted_multiplier * variance
        return round(estimated_cost, 2)

    def generate_grocery_list(self, meal_plan_text: str, days: int, meals_per_day: int) -> Dict:
        """Generate complete grocery list with cost breakdown"""
        print(f"🛒 Generating grocery list for {days} days, {meals_per_day} meals/day")
        
        # Parse meal plan
        recipes = self.parse_meal_plan(meal_plan_text)
        
        if not recipes:
            print("❌ No recipes found in meal plan")
            return {
                'success': False,
                'error': 'No recipes found in meal plan'
            }
        
        # Extract and consolidate ingredients
        grocery_items = self.extract_and_consolidate_ingredients(recipes)
        
        if not grocery_items:
            print("❌ No ingredients extracted")
            return {
                'success': False,
                'error': 'No ingredients could be extracted from meal plan'
            }
        
        # Sort items by category and then alphabetically within category
        category_order = {
            'proteins': 1, 'vegetables': 2, 'fruits': 3, 'dairy': 4,
            'grains': 5, 'pantry': 6, 'frozen': 7, 'snacks': 8,
            'beverages': 9, 'condiments': 10, 'herbs_spices': 11
        }
        
        grocery_items.sort(key=lambda x: (category_order.get(x.category, 99), x.name))
        
        # Calculate cost breakdown (only for non-excluded categories)
        excluded_items = []
        total_cost = 0.0
        category_costs = defaultdict(float)
        
        for item in grocery_items:
            if item.category in self.cost_excluded_categories:
                excluded_items.append(item.name)
            else:
                # Calculate cost for this item
                quantity_info = {'display': item.quantity}
                item_cost = self._estimate_cost(item.name.lower(), quantity_info, item.category)
                total_cost += item_cost
                category_costs[item.category] += item_cost
        
        cost_per_day = total_cost / days if days > 0 else 0
        total_meals = days * meals_per_day
        cost_per_meal = total_cost / total_meals if total_meals > 0 else 0
        
        cost_breakdown = CostBreakdown(
            total_cost=round(total_cost, 2),
            cost_per_day=round(cost_per_day, 2),
            cost_per_meal=round(cost_per_meal, 2),
            category_breakdown=dict(category_costs),
            item_count=len(grocery_items),
            excluded_items=excluded_items
        )
        
        # Convert to serializable format
        grocery_list_data = []
        for item in grocery_items:
            grocery_list_data.append({
                'name': item.name,
                'quantity': item.quantity,
                'unit': item.unit,
                'category': item.category.replace('_', ' ').title(),  # Format category name
                'notes': item.notes,
                'excluded_from_cost': item.category in self.cost_excluded_categories
            })
        
        # Calculate some useful statistics
        category_counts = defaultdict(int)
        for item in grocery_items:
            category_counts[item.category] += 1
        
        print(f"✅ Generated grocery list with {len(grocery_items)} items")
        print(f"💰 Total cost: ${total_cost:.2f} (excluding {len(excluded_items)} reusable items)")
        print(f"📊 Category breakdown: {dict(category_counts)}")
        
        return {
            'success': True,
            'grocery_list': grocery_list_data,
            'cost_breakdown': {
                'total_cost': cost_breakdown.total_cost,
                'cost_per_day': cost_breakdown.cost_per_day,
                'cost_per_meal': cost_breakdown.cost_per_meal,
                'category_breakdown': {k.replace('_', ' ').title(): v for k, v in cost_breakdown.category_breakdown.items()},
                'item_count': cost_breakdown.item_count,
                'excluded_items': cost_breakdown.excluded_items
            },
            'summary': {
                'total_items': len(grocery_items),
                'total_cost': cost_breakdown.total_cost,
                'excluded_items_count': len(excluded_items),
                'days': days,
                'meals_per_day': meals_per_day,
                'recipes_parsed': len(recipes),
                'category_counts': {k.replace('_', ' ').title(): v for k, v in category_counts.items()}
            }
        }

    def get_shopping_tips(self, grocery_list_data: List[Dict]) -> List[str]:
        """Generate helpful shopping tips based on the grocery list"""
        tips = []
        
        # Count items by category
        category_counts = defaultdict(int)
        for item in grocery_list_data:
            category_counts[item['category'].lower().replace(' ', '_')] += 1
        
        # Shopping route optimization tip
        if len(grocery_list_data) > 10:
            tips.append("🛒 Shop the perimeter of the store first (produce, meat, dairy) then move to inner aisles")
        
        # Produce tips
        if category_counts.get('vegetables', 0) + category_counts.get('fruits', 0) > 5:
            tips.append("🥬 Buy produce that ripens at different rates - some ready to eat, some for later in the week")
        
        # Protein tips
        if category_counts.get('proteins', 0) > 3:
            tips.append("🥩 Consider buying proteins in bulk and freezing portions for later use")
        
        # Cost-saving tips
        total_items = len(grocery_list_data)
        if total_items > 15:
            tips.append("💰 Check store sales and consider generic brands for pantry staples")
            tips.append("📋 Stick to your list to avoid impulse purchases")
        
        # Storage tips
        if category_counts.get('herbs_spices', 0) > 0:
            tips.append("🌿 Store fresh herbs in water like flowers to keep them fresh longer")
        
        return tips
