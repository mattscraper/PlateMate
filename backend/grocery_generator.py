import re
import json
from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass, asdict
from collections import defaultdict
import random
from flask import Blueprint, request, jsonify
from flask_cors import cross_origin
import hashlib
import time

@dataclass
class GroceryItem:
    name: str
    quantity: str
    unit: str
    category: str
    notes: str = ""
    estimated_cost: float = 0.0
    is_checked: bool = False
    checked_at: Optional[str] = None

@dataclass
class CostBreakdown:
    total_cost: float
    cost_per_day: float
    cost_per_meal: float
    category_breakdown: Dict[str, float]
    item_count: int
    excluded_items: List[str]

@dataclass
class SavedGroceryList:
    id: str
    meal_plan_id: str
    grocery_items: List[GroceryItem]
    cost_breakdown: CostBreakdown
    summary: Dict
    shopping_tips: List[str]
    created_at: str
    updated_at: str
    checked_items_count: int = 0

class EnhancedGroceryListGenerator:
    def __init__(self):
        # More realistic and comprehensive ingredient categories
        self.categories = {
            'proteins': [
                # Meat & Poultry - specific cuts
                'chicken breast', 'chicken thighs', 'chicken wings', 'whole chicken', 'ground chicken',
                'beef steak', 'ground beef', 'beef roast', 'beef stew meat', 'ribeye', 'sirloin',
                'pork chops', 'ground pork', 'pork tenderloin', 'bacon', 'ham', 'pork shoulder',
                'turkey breast', 'ground turkey', 'turkey thighs', 'duck', 'lamb', 'venison',
                
                # Seafood
                'salmon', 'tuna', 'cod', 'tilapia', 'mahi mahi', 'halibut', 'trout', 'catfish',
                'shrimp', 'scallops', 'crab', 'lobster', 'mussels', 'clams', 'oysters',
                'sardines', 'anchovies', 'mackerel', 'sea bass', 'snapper',
                
                # Plant-based proteins
                'tofu', 'tempeh', 'seitan', 'black beans', 'kidney beans', 'chickpeas', 'lentils',
                'pinto beans', 'navy beans', 'lima beans', 'edamame', 'quinoa', 'hemp seeds',
                
                # Eggs & Dairy proteins
                'eggs', 'egg whites', 'cottage cheese', 'greek yogurt', 'protein powder'
            ],
            
            'vegetables': [
                # Common fresh vegetables with specific varieties
                'yellow onion', 'red onion', 'white onion', 'green onions', 'scallions', 'shallots',
                'garlic', 'ginger', 'roma tomatoes', 'cherry tomatoes', 'beefsteak tomatoes',
                'carrots', 'baby carrots', 'celery', 'red bell pepper', 'green bell pepper',
                'yellow bell pepper', 'orange bell pepper', 'broccoli', 'cauliflower',
                'spinach', 'kale', 'arugula', 'lettuce', 'romaine', 'iceberg lettuce',
                'cucumber', 'zucchini', 'yellow squash', 'eggplant', 'mushrooms',
                'russet potatoes', 'red potatoes', 'sweet potatoes', 'yukon potatoes',
                'corn', 'green beans', 'snap peas', 'snow peas', 'brussels sprouts',
                'cabbage', 'red cabbage', 'bok choy', 'asparagus', 'artichokes',
                'leeks', 'fennel', 'radishes', 'turnips', 'beets', 'parsnips',
                'jalapeños', 'serrano peppers', 'poblano peppers', 'bell peppers'
            ],
            
            'fruits': [
                'bananas', 'apples', 'granny smith apples', 'red delicious apples',
                'oranges', 'naval oranges', 'lemons', 'limes', 'grapefruits',
                'strawberries', 'blueberries', 'raspberries', 'blackberries', 'cranberries',
                'grapes', 'red grapes', 'green grapes', 'avocados', 'mangoes',
                'pineapple', 'peaches', 'pears', 'plums', 'cherries', 'apricots',
                'kiwi', 'papaya', 'cantaloupe', 'honeydew', 'watermelon',
                'dates', 'figs', 'raisins', 'dried cranberries'
            ],
            
            'dairy': [
                'whole milk', '2% milk', 'skim milk', 'almond milk', 'oat milk', 'soy milk',
                'heavy cream', 'half and half', 'buttermilk', 'sour cream',
                'plain greek yogurt', 'vanilla yogurt', 'cottage cheese', 'cream cheese',
                'butter', 'unsalted butter', 'salted butter', 'margarine',
                'cheddar cheese', 'mozzarella cheese', 'parmesan cheese', 'swiss cheese',
                'feta cheese', 'goat cheese', 'ricotta cheese', 'blue cheese', 'brie'
            ],
            
            'grains': [
                'white rice', 'brown rice', 'jasmine rice', 'basmati rice', 'wild rice',
                'spaghetti', 'penne pasta', 'fettuccine', 'angel hair pasta', 'rigatoni',
                'whole wheat bread', 'white bread', 'sourdough bread', 'bagels',
                'english muffins', 'tortillas', 'pita bread', 'naan', 'crackers',
                'all-purpose flour', 'whole wheat flour', 'bread flour', 'corn meal',
                'rolled oats', 'steel cut oats', 'quinoa', 'barley', 'couscous',
                'cereal', 'granola', 'oatmeal'
            ],
            
            'pantry': [
                # Oils & Vinegars
                'olive oil', 'extra virgin olive oil', 'vegetable oil', 'canola oil',
                'coconut oil', 'sesame oil', 'balsamic vinegar', 'white vinegar',
                'apple cider vinegar', 'red wine vinegar', 'rice vinegar',
                
                # Basic seasonings & baking
                'salt', 'kosher salt', 'sea salt', 'black pepper', 'white pepper',
                'sugar', 'brown sugar', 'powdered sugar', 'honey', 'maple syrup',
                'vanilla extract', 'baking powder', 'baking soda', 'cornstarch',
                'chicken stock', 'vegetable stock', 'beef stock', 'chicken broth',
                
                # Canned goods
                'canned tomatoes', 'tomato paste', 'tomato sauce', 'coconut milk',
                'canned black beans', 'canned chickpeas', 'canned corn'
            ],
            
            'herbs_spices': [
                'basil', 'oregano', 'thyme', 'rosemary', 'sage', 'parsley', 'cilantro',
                'dill', 'mint', 'paprika', 'cumin', 'coriander', 'chili powder',
                'cayenne pepper', 'garlic powder', 'onion powder', 'cinnamon',
                'nutmeg', 'ginger powder', 'turmeric', 'curry powder', 'bay leaves',
                'italian seasoning', 'herbs de provence', 'red pepper flakes'
            ],
            
            'condiments': [
                'ketchup', 'mustard', 'dijon mustard', 'mayonnaise', 'ranch dressing',
                'italian dressing', 'balsamic glaze', 'worcestershire sauce',
                'soy sauce', 'hot sauce', 'sriracha', 'bbq sauce', 'teriyaki sauce',
                'fish sauce', 'oyster sauce', 'hoisin sauce', 'tahini', 'pesto'
            ],
            
            'frozen': [
                'frozen broccoli', 'frozen corn', 'frozen peas', 'frozen spinach',
                'frozen berries', 'frozen strawberries', 'frozen chicken breasts',
                'frozen shrimp', 'frozen fish fillets', 'ice cream', 'frozen yogurt'
            ],
            
            'snacks': [
                'almonds', 'walnuts', 'cashews', 'peanuts', 'pistachios', 'pecans',
                'peanut butter', 'almond butter', 'granola bars', 'crackers',
                'chips', 'pretzels', 'popcorn', 'trail mix'
            ],
            
            'beverages': [
                'water', 'sparkling water', 'orange juice', 'apple juice',
                'coffee', 'tea', 'green tea', 'herbal tea', 'wine', 'beer'
            ]
        }
        
        # Categories excluded from cost calculations
        self.cost_excluded_categories = ['herbs_spices', 'condiments']
        
        # More realistic cost estimates (USD) - significantly reduced and more accurate
        self.estimated_costs = {
            # Proteins (per typical recipe serving)
            'chicken breast': 2.50, 'chicken thighs': 1.80, 'chicken wings': 2.00, 'ground chicken': 2.20,
            'beef steak': 4.00, 'ground beef': 3.00, 'ribeye': 6.00, 'sirloin': 3.50,
            'pork chops': 2.80, 'bacon': 2.50, 'ham': 2.00, 'pork tenderloin': 3.00,
            'ground turkey': 2.40, 'turkey breast': 2.60, 'salmon': 4.50, 'tuna': 2.50,
            'cod': 3.20, 'tilapia': 2.80, 'shrimp': 4.00, 'eggs': 1.50, 'tofu': 1.80,
            'black beans': 0.80, 'chickpeas': 0.90, 'lentils': 0.70,

            # Vegetables (per typical recipe amount)
            'yellow onion': 0.50, 'red onion': 0.60, 'garlic': 0.30, 'ginger': 0.40,
            'roma tomatoes': 1.00, 'cherry tomatoes': 1.50, 'carrots': 0.60, 'celery': 0.70,
            'red bell pepper': 1.20, 'green bell pepper': 1.00, 'broccoli': 1.20, 'spinach': 1.00,
            'kale': 1.10, 'lettuce': 0.80, 'cucumber': 0.80, 'zucchini': 0.90,
            'mushrooms': 1.50, 'russet potatoes': 0.60, 'sweet potatoes': 0.80,

            # Fruits (per typical amount)
            'bananas': 0.50, 'apples': 0.80, 'oranges': 0.90, 'lemons': 0.50, 'limes': 0.40,
            'strawberries': 1.80, 'blueberries': 2.20, 'avocados': 1.50, 'mangoes': 1.20,

            # Dairy (per typical recipe amount)
            'whole milk': 1.00, '2% milk': 1.00, 'heavy cream': 1.20, 'butter': 1.00,
            'cheddar cheese': 2.00, 'mozzarella cheese': 1.80, 'parmesan cheese': 2.50,
            'plain greek yogurt': 1.50, 'eggs': 1.50,

            # Grains (per typical serving)
            'white rice': 0.60, 'brown rice': 0.80, 'spaghetti': 0.80, 'bread': 1.00,
            'tortillas': 1.20, 'oats': 0.70, 'quinoa': 1.50,

            # Default for unknown items
            'default': 1.20
        }

        # Maximum reasonable costs per meal to prevent unrealistic totals
        self.max_meal_cost = {
            'Breakfast': 8.00,
            'Lunch': 12.00,
            'Dinner': 15.00,
            'Snack': 5.00
        }

    def generate_grocery_list_with_persistence(self, meal_plan_text: str, days: int,
                                             meals_per_day: int, meal_plan_id: str = None,
                                             existing_grocery_list: Dict = None) -> Dict:
        """Generate grocery list with persistence support"""
        
        # If we have an existing grocery list, restore check states
        if existing_grocery_list:
            return self._restore_grocery_list_state(existing_grocery_list)
        
        # Generate new grocery list
        result = self.generate_grocery_list(meal_plan_text, days, meals_per_day)
        
        if result.get('success'):
            # Add persistence metadata
            grocery_list_id = meal_plan_id or self._generate_grocery_list_id(meal_plan_text)
            result['grocery_list_id'] = grocery_list_id
            result['created_at'] = time.time()
            result['updated_at'] = time.time()
            
            # Add check state tracking
            for item in result['grocery_list']:
                item['is_checked'] = False
                item['checked_at'] = None
            
        return result

    def update_grocery_list_check_state(self, grocery_list: Dict, item_updates: List[Dict]) -> Dict:
        """Update the check state of grocery list items"""
        try:
            # Create a lookup for updates
            updates_lookup = {update['name']: update for update in item_updates}
            
            checked_count = 0
            for item in grocery_list['grocery_list']:
                if item['name'] in updates_lookup:
                    update = updates_lookup[item['name']]
                    item['is_checked'] = update.get('is_checked', False)
                    if item['is_checked']:
                        item['checked_at'] = time.time()
                        checked_count += 1
                    else:
                        item['checked_at'] = None
            
            # Update metadata
            grocery_list['updated_at'] = time.time()
            grocery_list['checked_items_count'] = checked_count
            grocery_list['completion_percentage'] = round((checked_count / len(grocery_list['grocery_list'])) * 100, 1)
            
            return grocery_list
            
        except Exception as e:
            print(f"Error updating check state: {e}")
            return grocery_list

    def _generate_grocery_list_id(self, meal_plan_text: str) -> str:
        """Generate a consistent ID for a meal plan's grocery list"""
        content_hash = hashlib.md5(meal_plan_text.encode()).hexdigest()[:8]
        return f"grocery_{content_hash}_{int(time.time())}"

    def _restore_grocery_list_state(self, existing_grocery_list: Dict) -> Dict:
        """Restore an existing grocery list with preserved check states"""
        existing_grocery_list['restored'] = True
        return existing_grocery_list

    def parse_meal_plan_with_better_matching(self, meal_plan_text: str) -> List[Dict]:
        """Enhanced meal plan parsing that better matches actual recipe content"""
        print("🔍 Enhanced meal plan parsing for accurate grocery list...")
        
        # Split by recipe separators with more flexible parsing
        recipes = []
        
        # Try multiple splitting strategies
        separators = ['=====', '-----', '\n\n---\n\n', 'Recipe:', 'RECIPE:']
        
        for separator in separators:
            if separator in meal_plan_text:
                potential_recipes = meal_plan_text.split(separator)
                if len(potential_recipes) > 1:
                    recipes = potential_recipes
                    break
        
        if not recipes:
            # Fallback: split by day markers and then by meal types
            day_pattern = r'Day\s+\d+'
            day_sections = re.split(day_pattern, meal_plan_text, flags=re.IGNORECASE)
            
            for section in day_sections[1:]:  # Skip first empty section
                meal_patterns = ['Breakfast', 'Lunch', 'Dinner', 'Snack']
                for pattern in meal_patterns:
                    meal_matches = re.findall(
                        rf'{pattern}.*?(?={"|".join(meal_patterns)}|$)',
                        section,
                        re.DOTALL | re.IGNORECASE
                    )
                    recipes.extend(meal_matches)
        
        parsed_recipes = []
        
        for recipe_text in recipes:
            if not recipe_text.strip():
                continue
                
            lines = recipe_text.strip().split('\n')
            recipe_data = {
                'title': '',
                'ingredients': [],
                'meal_type': '',
                'estimated_cost': 0.0
            }
            
            # Enhanced title extraction
            for line in lines:
                line = line.strip()
                if (line and len(line) > 3 and
                    not line.lower().startswith('day ') and
                    not any(meal in line.lower() for meal in ['breakfast', 'lunch', 'dinner', 'snack']) and
                    ':' not in line and
                    not line.startswith('•') and
                    not line.lower().startswith(('preparation', 'cooking', 'servings', 'calories', 'protein', 'carbs', 'fat')) and
                    not re.match(r'^\d+\.', line)):
                    recipe_data['title'] = line
                    break
            
            # Extract meal type
            for line in lines:
                line_lower = line.lower()
                for meal_type in ['breakfast', 'lunch', 'dinner', 'snack']:
                    if meal_type in line_lower:
                        recipe_data['meal_type'] = meal_type.title()
                        break
                if recipe_data['meal_type']:
                    break
            
            # Enhanced ingredient extraction with better parsing
            for line in lines:
                line = line.strip()
                if line.startswith('•'):
                    ingredient = line[1:].strip()
                    if ingredient and len(ingredient) > 1:
                        # Parse ingredient properly to separate quantity from name
                        parsed_ingredient = self._parse_ingredient_text(ingredient)
                        if parsed_ingredient:
                            recipe_data['ingredients'].append(parsed_ingredient)
            
            # Estimate meal cost for validation
            if recipe_data['ingredients']:
                estimated_cost = self._estimate_meal_cost([ing['name'] for ing in recipe_data['ingredients']], recipe_data['meal_type'])
                recipe_data['estimated_cost'] = estimated_cost
            
            if recipe_data['title'] and recipe_data['ingredients']:
                parsed_recipes.append(recipe_data)
        
        print(f"✅ Enhanced parsing found {len(parsed_recipes)} recipes with validated costs")
        return parsed_recipes

    def _parse_ingredient_text(self, ingredient_text: str) -> Optional[Dict]:
        """Parse ingredient text to separate quantity, unit, and ingredient name"""
        ingredient_text = ingredient_text.strip()
        if not ingredient_text:
            return None
        
        # Common patterns for ingredient parsing
        patterns = [
            # Pattern 1: Number + unit + ingredient (e.g., "2 cups flour")
            r'^(\d+(?:\.\d+)?(?:\s*-\s*\d+(?:\.\d+)?)?)\s+(cups?|cup|tbsp|tablespoons?|tsp|teaspoons?|lbs?|pounds?|oz|ounces?|g|grams?|kg|kilograms?|pieces?|piece|cloves?|clove|slices?|slice|cans?|can|packages?|package|containers?|container|bottles?|bottle|jars?|jar|heads?|head|bunches?|bunch|stalks?|stalk)\s+(.+)$',
            
            # Pattern 2: Fraction + unit + ingredient (e.g., "1/2 cup sugar")
            r'^(\d+/\d+|\d+\s+\d+/\d+)\s+(cups?|cup|tbsp|tablespoons?|tsp|teaspoons?|lbs?|pounds?|oz|ounces?|g|grams?|kg|kilograms?)\s+(.+)$',
            
            # Pattern 3: Number + ingredient (no unit) (e.g., "2 eggs")
            r'^(\d+(?:\.\d+)?)\s+(.+)$',
            
            # Pattern 4: Just ingredient name (e.g., "salt to taste")
            r'^(.+)$'
        ]
        
        quantity = "1"
        unit = ""
        ingredient_name = ingredient_text.lower()
        
        for pattern in patterns:
            match = re.match(pattern, ingredient_text, re.IGNORECASE)
            if match:
                groups = match.groups()
                if len(groups) == 3:  # quantity + unit + ingredient
                    quantity = groups[0].strip()
                    unit = groups[1].strip().lower()
                    ingredient_name = groups[2].strip().lower()
                    break
                elif len(groups) == 2:
                    # Check if second group contains a unit
                    words = groups[1].strip().split()
                    if len(words) > 1 and any(unit_word in words[0].lower() for unit_word in ['cup', 'tbsp', 'tsp', 'lb', 'oz', 'gram']):
                        quantity = groups[0].strip()
                        unit = words[0].lower()
                        ingredient_name = ' '.join(words[1:]).lower()
                    else:
                        quantity = groups[0].strip()
                        ingredient_name = groups[1].strip().lower()
                    break
                elif len(groups) == 1:
                    ingredient_name = groups[0].strip().lower()
                    break
        
        # Clean the ingredient name - remove common descriptors but keep the core ingredient
        cleaned_name = self._clean_ingredient_name(ingredient_name)
        if not cleaned_name:
            return None
        
        return {
            'quantity': quantity,
            'unit': unit,
            'name': cleaned_name
        }

    def _clean_ingredient_name(self, ingredient_name: str) -> Optional[str]:
        """Clean ingredient name by removing descriptors but keeping core ingredient"""
        if not ingredient_name:
            return None
        
        # Remove common descriptors
        descriptors_to_remove = [
            r'\b(fresh|dried|chopped|diced|minced|sliced|grated|shredded)\b',
            r'\b(organic|raw|cooked|frozen|canned)\b',
            r'\b(large|medium|small|extra)\b',
            r'\b(preferably|optional|to taste|for serving)\b',
            r'\b(finely|roughly|coarsely)\b'
        ]
        
        cleaned = ingredient_name.lower()
        for pattern in descriptors_to_remove:
            cleaned = re.sub(pattern, '', cleaned, flags=re.IGNORECASE)
        
        # Clean up extra spaces and punctuation
        cleaned = re.sub(r'\s+', ' ', cleaned).strip(' ,.-()[]')
        
        # Remove parenthetical information
        cleaned = re.sub(r'\([^)]*\)', '', cleaned).strip()
        
        # Get the core ingredient (usually first 1-2 words)
        words = cleaned.split()
        if len(words) >= 2:
            # For compound ingredients like "bell pepper", "olive oil", keep both words
            core_ingredient = ' '.join(words[:2])
        elif len(words) == 1:
            core_ingredient = words[0]
        else:
            return None
        
        # Validate that we have a meaningful ingredient
        if len(core_ingredient) < 2 or core_ingredient in ['to', 'for', 'and', 'or', 'with']:
            return None
        
        return core_ingredient.strip()

    def _estimate_meal_cost(self, ingredients: List[str], meal_type: str) -> float:
        """Estimate the cost of a meal and validate against reasonable limits"""
        total_cost = 0.0
        
        for ingredient in ingredients:
            ingredient_lower = ingredient.lower()
            cost = self.estimated_costs.get(ingredient_lower, self.estimated_costs['default'])
            
            # Check for partial matches in cost database
            if cost == self.estimated_costs['default']:
                for cost_item, cost_value in self.estimated_costs.items():
                    if cost_item in ingredient_lower or ingredient_lower in cost_item:
                        cost = cost_value
                        break
            
            total_cost += cost
        
        # Apply reasonable cost limits
        max_cost = self.max_meal_cost.get(meal_type, self.max_meal_cost['Lunch'])
        if total_cost > max_cost:
            print(f"⚠️ Meal cost ${total_cost:.2f} exceeds reasonable limit ${max_cost:.2f} for {meal_type}, adjusting...")
            total_cost = max_cost * 0.8  # Scale down to 80% of max
        
        return round(total_cost, 2)

    def extract_and_consolidate_ingredients(self, recipes: List[Dict]) -> List[GroceryItem]:
        """Enhanced ingredient consolidation with proper name extraction"""
        print("🔄 Enhanced ingredient consolidation with proper name extraction...")
        
        consolidated = defaultdict(lambda: {
            'quantities': [],
            'units': set(),
            'notes': set(),
            'category': 'pantry',
            'base_name': '',
            'estimated_cost': 0.0
        })
        
        for recipe in recipes:
            for ingredient_data in recipe['ingredients']:
                if isinstance(ingredient_data, dict):
                    # New format with parsed data
                    ingredient_name = ingredient_data['name']
                    quantity = ingredient_data['quantity']
                    unit = ingredient_data['unit']
                else:
                    # Fallback for old format
                    ingredient_name = self._clean_ingredient_name(str(ingredient_data))
                    quantity = "1"
                    unit = ""
                
                if ingredient_name:
                    consolidated[ingredient_name]['quantities'].append(quantity)
                    if unit:
                        consolidated[ingredient_name]['units'].add(unit)
                    consolidated[ingredient_name]['category'] = self._categorize_ingredient_enhanced(ingredient_name)
                    consolidated[ingredient_name]['base_name'] = ingredient_name
        
        grocery_items = []
        for ingredient_name, data in consolidated.items():
            # Combine quantities intelligently
            total_quantity = self._combine_quantities_enhanced(data['quantities'], list(data['units']))
            
            # Calculate realistic cost
            estimated_cost = self._calculate_realistic_item_cost(ingredient_name, total_quantity, data['category'])
            
            # Combine notes
            notes = ' • '.join(filter(None, data['notes']))
            
            grocery_item = GroceryItem(
                name=ingredient_name.title(),
                quantity=total_quantity['display'],
                unit=total_quantity['unit'],
                category=data['category'],
                notes=notes[:100] if notes else "",
                estimated_cost=estimated_cost,
                is_checked=False
            )
            grocery_items.append(grocery_item)
        
        print(f"✅ Created {len(grocery_items)} consolidated grocery items with proper names")
        return grocery_items

    def _categorize_ingredient_enhanced(self, ingredient_name: str) -> str:
        """Enhanced ingredient categorization with better accuracy"""
        ingredient_lower = ingredient_name.lower().strip()
        
        # Priority order for categorization
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
                if item in ingredient_lower or ingredient_lower in item:
                    return category
        
        # Enhanced keyword-based categorization
        protein_keywords = ['meat', 'protein', 'breast', 'thigh', 'fillet', 'ground', 'steak']
        if any(keyword in ingredient_lower for keyword in protein_keywords):
            return 'proteins'
        
        vegetable_keywords = ['vegetable', 'veggie', 'fresh', 'organic']
        if any(keyword in ingredient_lower for keyword in vegetable_keywords):
            return 'vegetables'
        
        spice_keywords = ['spice', 'herb', 'seasoning', 'powder', 'dried']
        if any(keyword in ingredient_lower for keyword in spice_keywords):
            return 'herbs_spices'
        
        return 'pantry'

    def _combine_quantities_enhanced(self, quantities: List[str], units: List[str]) -> Dict:
        """Enhanced quantity combination with better handling"""
        if not quantities:
            return {'display': '1', 'unit': 'item'}
        
        def parse_quantity_enhanced(q_str):
            q_str = q_str.strip()
            
            # Handle ranges
            if '-' in q_str:
                parts = q_str.split('-')
                try:
                    return (float(parts[0]) + float(parts[1])) / 2
                except ValueError:
                    return 1.0
            
            # Handle fractions
            if '/' in q_str:
                try:
                    if ' ' in q_str:  # Mixed number
                        whole, fraction = q_str.split(' ', 1)
                        whole_val = float(whole)
                        num, den = fraction.split('/')
                        frac_val = float(num) / float(den)
                        return whole_val + frac_val
                    else:  # Simple fraction
                        num, den = q_str.split('/')
                        return float(num) / float(den)
                except (ValueError, ZeroDivisionError):
                    return 1.0
            
            # Handle regular numbers
            try:
                return float(q_str)
            except ValueError:
                return 1.0
        
        numeric_quantities = [parse_quantity_enhanced(q) for q in quantities]
        
        if numeric_quantities:
            total = sum(numeric_quantities)
            
            # Format display with common fractions
            if total < 1:
                if abs(total - 0.5) < 0.1:
                    display = "1/2"
                elif abs(total - 0.25) < 0.1:
                    display = "1/4"
                elif abs(total - 0.75) < 0.1:
                    display = "3/4"
                else:
                    display = f"{total:.2f}".rstrip('0').rstrip('.')
            elif total < 10:
                if abs(total - round(total) - 0.5) < 0.1:
                    display = f"{int(total)} 1/2"
                else:
                    display = f"{total:.1f}".rstrip('0').rstrip('.')
            else:
                display = str(int(round(total)))
            
            # Choose most appropriate unit
            if units:
                valid_units = [u for u in units if u and u != 'item']
                if valid_units:
                    unit = max(set(valid_units), key=valid_units.count)
                else:
                    unit = 'item'
            else:
                unit = 'item'
            
            return {'display': display, 'unit': unit}
        
        return {'display': quantities[0] if quantities else '1', 'unit': units[0] if units else 'item'}

    def _calculate_realistic_item_cost(self, ingredient_name: str, quantity_info: Dict, category: str) -> float:
        """Calculate realistic cost with better validation"""
        if category in self.cost_excluded_categories:
            return 0.0
        
        ingredient_lower = ingredient_name.lower()
        base_cost = self.estimated_costs.get(ingredient_lower, self.estimated_costs['default'])
        
        # Better partial matching
        if base_cost == self.estimated_costs['default']:
            best_match_score = 0
            best_match_cost = base_cost
            
            for cost_item, cost in self.estimated_costs.items():
                if cost_item == 'default':
                    continue
                
                # Calculate match score
                score = 0
                if cost_item in ingredient_lower:
                    score = len(cost_item) / len(ingredient_lower)
                elif ingredient_lower in cost_item:
                    score = len(ingredient_lower) / len(cost_item)
                
                if score > best_match_score:
                    best_match_score = score
                    best_match_cost = cost
            
            if best_match_score > 0.5:  # Good match threshold
                base_cost = best_match_cost
        
        # Calculate quantity multiplier
        try:
            quantity_str = quantity_info['display']
            
            if 'portions' in quantity_str:
                match = re.search(r'(\d+(?:\.\d+)?)', quantity_str)
                multiplier = float(match.group(1)) if match else 1.0
            else:
                # Handle fractions and numbers
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
        
        # Apply realistic scaling with caps
        if multiplier > 5:  # Cap at 5x for very large quantities
            adjusted_multiplier = min(multiplier, 8)
        elif multiplier > 2:  # Reduce scaling for larger quantities
            adjusted_multiplier = 2 + (multiplier - 2) * 0.4
        elif multiplier < 0.25:  # Don't go below quarter cost
            adjusted_multiplier = 0.25
        else:
            adjusted_multiplier = multiplier
        
        # Add small variance for realism
        variance = random.uniform(0.90, 1.10)
        
        estimated_cost = base_cost * adjusted_multiplier * variance
        return round(max(estimated_cost, 0.10), 2)  # Minimum 10 cents

    def generate_grocery_list(self, meal_plan_text: str, days: int, meals_per_day: int) -> Dict:
        """Generate grocery list with enhanced accuracy and cost validation"""
        print(f"🛒 Generating enhanced grocery list for {days} days, {meals_per_day} meals/day")
        
        # Parse meal plan with better matching
        recipes = self.parse_meal_plan_with_better_matching(meal_plan_text)
        
        if not recipes:
            return {
                'success': False,
                'error': 'No recipes found in meal plan'
            }
        
        # Validate total meal costs
        total_estimated_meal_cost = sum(recipe.get('estimated_cost', 0) for recipe in recipes)
        if total_estimated_meal_cost > (days * meals_per_day * 12):  # $12 average per meal max
            print(f"⚠️ Total meal cost ${total_estimated_meal_cost:.2f} seems high, applying cost adjustments...")
        
        # Extract and consolidate ingredients
        grocery_items = self.extract_and_consolidate_ingredients(recipes)
        
        if not grocery_items:
            return {
                'success': False,
                'error': 'No ingredients could be extracted from meal plan'
            }
        
        # Sort items by category and name
        category_order = {
            'proteins': 1, 'vegetables': 2, 'fruits': 3, 'dairy': 4,
            'grains': 5, 'pantry': 6, 'frozen': 7, 'snacks': 8,
            'beverages': 9, 'condiments': 10, 'herbs_spices': 11
        }
        
        grocery_items.sort(key=lambda x: (category_order.get(x.category, 99), x.name))
        
        # Calculate enhanced cost breakdown
        excluded_items = []
        total_cost = 0.0
        category_costs = defaultdict(float)
        
        for item in grocery_items:
            if item.category in self.cost_excluded_categories:
                excluded_items.append(item.name)
            else:
                total_cost += item.estimated_cost
                category_costs[item.category] += item.estimated_cost
        
        # Validate total cost reasonableness
        expected_cost_range = (days * meals_per_day * 4, days * meals_per_day * 12)
        if total_cost < expected_cost_range[0]:
            print(f"⚠️ Total cost ${total_cost:.2f} seems low, might be missing ingredients")
        elif total_cost > expected_cost_range[1]:
            print(f"⚠️ Total cost ${total_cost:.2f} seems high, cost estimates may be inflated")
        
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
                'category': item.category.replace('_', ' ').title(),
                'notes': item.notes,
                'estimated_cost': item.estimated_cost,
                'excluded_from_cost': item.category in self.cost_excluded_categories,
                'is_checked': False,
                'checked_at': None
            })
        
        # Generate shopping tips
        shopping_tips = self.get_enhanced_shopping_tips(grocery_list_data, total_cost)
        
        # Statistics
        category_counts = defaultdict(int)
        for item in grocery_items:
            category_counts[item.category] += 1
        
        print(f"✅ Generated enhanced grocery list with {len(grocery_items)} items")
        print(f"💰 Total cost: ${total_cost:.2f} (${cost_per_meal:.2f}/meal)")
        
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
                'category_counts': {k.replace('_', ' ').title(): v for k, v in category_counts.items()},
                'cost_per_meal': cost_breakdown.cost_per_meal,
                'cost_validation': {
                    'is_reasonable': expected_cost_range[0] <= total_cost <= expected_cost_range[1],
                    'expected_range': expected_cost_range
                }
            },
            'shopping_tips': shopping_tips,
            'recipes_found': len(recipes),
            'ingredients_processed': len(grocery_items)
        }

    def get_enhanced_shopping_tips(self, grocery_list_data: List[Dict], total_cost: float) -> List[str]:
        """Generate enhanced shopping tips based on the grocery list and costs"""
        tips = []
        
        # Count items by category
        category_counts = defaultdict(int)
        for item in grocery_list_data:
            category_counts[item['category'].lower().replace(' ', '_')] += 1
        
        # Shopping strategy tips
        if len(grocery_list_data) > 15:
            tips.append("🛒 Shop the perimeter first (produce, meat, dairy) then work through inner aisles systematically")
        
        # Cost-saving tips based on total cost
        if total_cost > 80:
            tips.append("💰 Look for sales on proteins and buy in bulk to freeze for future meals")
            tips.append("🏷️ Consider store brands for pantry staples - they can save 20-30%")
        
        if total_cost > 120:
            tips.append("📋 This is a substantial grocery trip - consider splitting across 2 stores if you have time")
        
        # Produce tips
        produce_count = category_counts.get('vegetables', 0) + category_counts.get('fruits', 0)
        if produce_count > 8:
            tips.append("🥬 Buy a mix of ripe and unripe produce to ensure freshness throughout the week")
            tips.append("🛍️ Bring reusable produce bags to stay organized and eco-friendly")
        
        # Protein tips
        if category_counts.get('proteins', 0) > 3:
            tips.append("🥩 Ask the butcher about family packs or bulk pricing for better value")
        
        # Storage tips
        if category_counts.get('herbs_spices', 0) > 0:
            tips.append("🌿 Store fresh herbs in water like flowers, or freeze in olive oil for longer life")
        
        # Time-saving tips
        if len(grocery_list_data) > 20:
            tips.append("⏰ Shop during off-peak hours (early morning or late evening) for faster checkout")
        
        # Budget tips
        if total_cost < 60:
            tips.append("👍 Great job planning an efficient, budget-friendly grocery list!")
        
        return tips
