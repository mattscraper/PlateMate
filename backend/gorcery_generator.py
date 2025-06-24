import re
import json
from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass
from collections import defaultdict
import random

@dataclass
class GroceryItem:
    name: str
    quantity: str
    unit: str
    category: str
    estimated_cost: float
    notes: str = ""

@dataclass
class CostBreakdown:
    total_cost: float
    cost_per_day: float
    cost_per_meal: float
    category_breakdown: Dict[str, float]
    item_count: int

class GroceryListGenerator:
    def __init__(self):
        # Ingredient categories for organization
        self.categories = {
            'proteins': ['chicken', 'beef', 'pork', 'fish', 'salmon', 'tuna', 'eggs', 'tofu', 'beans', 'lentils', 'turkey', 'shrimp', 'lamb', 'duck'],
            'vegetables': ['onion', 'garlic', 'tomato', 'carrot', 'celery', 'bell pepper', 'broccoli', 'spinach', 'lettuce', 'cucumber', 'potato', 'sweet potato', 'mushroom', 'zucchini', 'corn', 'peas', 'green beans', 'cauliflower', 'cabbage', 'kale', 'asparagus', 'brussels sprouts'],
            'fruits': ['apple', 'banana', 'orange', 'lemon', 'lime', 'berries', 'strawberry', 'blueberry', 'grape', 'avocado', 'mango', 'pineapple', 'peach', 'pear'],
            'dairy': ['milk', 'cheese', 'butter', 'yogurt', 'cream', 'sour cream', 'cottage cheese', 'mozzarella', 'cheddar', 'parmesan'],
            'grains': ['rice', 'pasta', 'bread', 'flour', 'oats', 'quinoa', 'barley', 'couscous', 'noodles', 'cereal', 'tortilla', 'crackers'],
            'pantry': ['olive oil', 'vegetable oil', 'salt', 'pepper', 'sugar', 'honey', 'vinegar', 'soy sauce', 'hot sauce', 'ketchup', 'mustard', 'mayo', 'ranch'],
            'herbs_spices': ['basil', 'oregano', 'thyme', 'rosemary', 'paprika', 'cumin', 'chili powder', 'garlic powder', 'onion powder', 'cinnamon', 'ginger', 'turmeric', 'bay leaves'],
            'condiments': ['mustard', 'ketchup', 'mayo', 'bbq sauce', 'ranch', 'italian dressing', 'balsamic', 'worcestershire', 'sriracha'],
            'frozen': ['frozen vegetables', 'frozen fruit', 'ice cream', 'frozen pizza', 'frozen chicken'],
            'snacks': ['nuts', 'chips', 'crackers', 'granola bars', 'pretzels'],
            'beverages': ['water', 'juice', 'soda', 'coffee', 'tea', 'wine', 'beer']
        }
        
        # Estimated costs per item (USD, rough averages)
        self.estimated_costs = {
            # Proteins (per lb/package)
            'chicken': 4.50, 'beef': 8.00, 'pork': 5.50, 'fish': 12.00, 'salmon': 15.00,
            'tuna': 3.00, 'eggs': 3.50, 'tofu': 4.00, 'beans': 2.00, 'lentils': 2.50,
            'turkey': 6.00, 'shrimp': 18.00, 'lamb': 12.00,
            
            # Vegetables (per lb or unit)
            'onion': 1.50, 'garlic': 2.00, 'tomato': 3.00, 'carrot': 1.80, 'celery': 2.50,
            'bell pepper': 4.00, 'broccoli': 3.50, 'spinach': 4.00, 'lettuce': 3.00,
            'cucumber': 2.00, 'potato': 2.00, 'sweet potato': 2.50, 'mushroom': 4.50,
            'zucchini': 2.50, 'corn': 3.00, 'peas': 3.50, 'green beans': 4.00,
            'cauliflower': 4.00, 'cabbage': 2.00, 'kale': 4.50, 'asparagus': 5.00,
            'brussels sprouts': 4.50,
            
            # Fruits
            'apple': 3.00, 'banana': 1.50, 'orange': 3.50, 'lemon': 2.00, 'lime': 2.50,
            'berries': 6.00, 'strawberry': 5.00, 'blueberry': 6.50, 'grape': 4.00,
            'avocado': 2.50, 'mango': 3.00, 'pineapple': 4.00, 'peach': 4.50, 'pear': 3.50,
            
            # Dairy
            'milk': 4.00, 'cheese': 6.00, 'butter': 5.00, 'yogurt': 5.50, 'cream': 4.50,
            'sour cream': 3.50, 'cottage cheese': 4.00, 'mozzarella': 5.50, 'cheddar': 6.50,
            'parmesan': 8.00,
            
            # Grains
            'rice': 3.00, 'pasta': 2.50, 'bread': 3.50, 'flour': 4.00, 'oats': 4.50,
            'quinoa': 8.00, 'barley': 3.50, 'couscous': 4.00, 'noodles': 3.00,
            'cereal': 5.50, 'tortilla': 3.00, 'crackers': 4.00,
            
            # Pantry staples
            'olive oil': 6.00, 'vegetable oil': 4.00, 'salt': 2.00, 'pepper': 3.00,
            'sugar': 3.50, 'honey': 6.00, 'vinegar': 3.00, 'soy sauce': 4.00,
            'hot sauce': 3.50, 'ketchup': 4.00, 'mustard': 3.00, 'mayo': 4.50,
            
            # Herbs & Spices
            'basil': 3.00, 'oregano': 2.50, 'thyme': 3.00, 'rosemary': 3.50,
            'paprika': 3.00, 'cumin': 3.50, 'chili powder': 3.00, 'garlic powder': 2.50,
            'onion powder': 2.50, 'cinnamon': 4.00, 'ginger': 4.50, 'turmeric': 4.00,
            
            # Default for unknown items
            'default': 4.00
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
                    not line.startswith('•')):
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
            
            # Get estimated cost
            estimated_cost = self._estimate_cost(base_name, total_quantity)
            
            # Combine notes
            notes = ' • '.join(filter(None, data['notes']))
            
            grocery_item = GroceryItem(
                name=base_name.title(),
                quantity=total_quantity['display'],
                unit=total_quantity['unit'],
                category=data['category'],
                estimated_cost=estimated_cost,
                notes=notes[:100] if notes else ""  # Limit notes length
            )
            grocery_items.append(grocery_item)
        
        print(f"✅ Created {len(grocery_items)} consolidated grocery items")
        return grocery_items

    def _parse_ingredient(self, ingredient_text: str) -> Optional[Dict]:
        """Parse individual ingredient text"""
        # Clean up the text
        ingredient_text = ingredient_text.strip()
        if not ingredient_text:
            return None
        
        # Patterns to extract quantity, unit, and ingredient name
        patterns = [
            r'^(\d+(?:\.\d+)?(?:\s*-\s*\d+(?:\.\d+)?)?)\s*(cups?|cup|tbsp|tablespoons?|tsp|teaspoons?|lbs?|pounds?|oz|ounces?|g|grams?|kg|kilograms?|pieces?|cloves?|slices?|cans?|packages?|containers?|bottles?|jars?)\s+(.+)$',
            r'^(\d+(?:\.\d+)?)\s*([a-zA-Z]*)\s+(.+)$',
            r'^(.+)$'  # Just the ingredient name
        ]
        
        quantity = "1"
        unit = "item"
        base_name = ingredient_text.lower()
        notes = ""
        
        for pattern in patterns:
            match = re.match(pattern, ingredient_text, re.IGNORECASE)
            if match:
                if len(match.groups()) == 3:
                    quantity = match.group(1)
                    unit = match.group(2) or "item"
                    base_name = match.group(3).lower()
                elif len(match.groups()) == 1:
                    base_name = match.group(1).lower()
                break
        
        # Clean base name - remove common descriptors
        descriptors_to_remove = [
            'fresh', 'dried', 'chopped', 'diced', 'minced', 'sliced',
            'ground', 'whole', 'crushed', 'grated', 'shredded',
            'organic', 'raw', 'cooked', 'frozen', 'canned',
            'large', 'medium', 'small', 'extra', 'virgin',
            'unsalted', 'salted', 'low-fat', 'fat-free',
            'to taste', 'optional', 'for serving', 'for garnish'
        ]
        
        original_name = base_name
        for descriptor in descriptors_to_remove:
            if descriptor in base_name:
                notes += f"{descriptor} "
                base_name = base_name.replace(descriptor, "").strip()
        
        # Clean up extra spaces and commas
        base_name = re.sub(r'\s+', ' ', base_name).strip(' ,')
        notes = notes.strip()
        
        # If base_name becomes too short, use original
        if len(base_name) < 2:
            base_name = original_name
        
        return {
            'quantity': quantity,
            'unit': unit.lower(),
            'base_name': base_name,
            'notes': notes
        }

    def _categorize_ingredient(self, ingredient_name: str) -> str:
        """Categorize ingredient based on name"""
        ingredient_lower = ingredient_name.lower()
        
        for category, items in self.categories.items():
            for item in items:
                if item in ingredient_lower or ingredient_lower in item:
                    return category
        
        return 'pantry'  # Default category

    def _combine_quantities(self, quantities: List[str], units: List[str]) -> Dict:
        """Intelligently combine quantities"""
        if not quantities:
            return {'display': '1', 'unit': 'item'}
        
        # If all quantities are numeric, sum them
        numeric_quantities = []
        for q in quantities:
            try:
                # Handle ranges like "1-2"
                if '-' in q:
                    parts = q.split('-')
                    avg = (float(parts[0]) + float(parts[1])) / 2
                    numeric_quantities.append(avg)
                else:
                    numeric_quantities.append(float(q))
            except ValueError:
                pass
        
        if numeric_quantities:
            total = sum(numeric_quantities)
            # Round to reasonable precision
            if total < 1:
                display = f"{total:.2f}".rstrip('0').rstrip('.')
            elif total < 10:
                display = f"{total:.1f}".rstrip('0').rstrip('.')
            else:
                display = str(int(total))
            
            # Choose most common unit
            unit = max(set(units), key=units.count) if units else 'item'
            
            return {'display': display, 'unit': unit}
        
        # If can't combine numerically, show range or count
        if len(quantities) == 1:
            unit = units[0] if units else 'item'
            return {'display': quantities[0], 'unit': unit}
        else:
            return {'display': f"{len(quantities)} portions", 'unit': 'needed'}

    def _estimate_cost(self, ingredient_name: str, quantity_info: Dict) -> float:
        """Estimate cost for an ingredient"""
        base_cost = self.estimated_costs.get(ingredient_name.lower(), self.estimated_costs['default'])
        
        # Adjust based on quantity
        try:
            multiplier = float(quantity_info['display'])
            if multiplier > 10:  # Cap large quantities
                multiplier = min(multiplier, 20)
        except ValueError:
            multiplier = 1.0
        
        # Add some randomness for realism
        variance = random.uniform(0.8, 1.2)
        
        estimated_cost = base_cost * multiplier * variance
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
        
        # Sort items by category
        grocery_items.sort(key=lambda x: (x.category, x.name))
        
        # Calculate cost breakdown
        total_cost = sum(item.estimated_cost for item in grocery_items)
        cost_per_day = total_cost / days if days > 0 else 0
        total_meals = days * meals_per_day
        cost_per_meal = total_cost / total_meals if total_meals > 0 else 0
        
        # Category breakdown
        category_costs = defaultdict(float)
        for item in grocery_items:
            category_costs[item.category] += item.estimated_cost
        
        cost_breakdown = CostBreakdown(
            total_cost=round(total_cost, 2),
            cost_per_day=round(cost_per_day, 2),
            cost_per_meal=round(cost_per_meal, 2),
            category_breakdown=dict(category_costs),
            item_count=len(grocery_items)
        )
        
        # Convert to serializable format
        grocery_list_data = []
        for item in grocery_items:
            grocery_list_data.append({
                'name': item.name,
                'quantity': item.quantity,
                'unit': item.unit,
                'category': item.category,
                'estimated_cost': item.estimated_cost,
                'notes': item.notes
            })
        
        print(f"✅ Generated grocery list with {len(grocery_items)} items, total cost: ${total_cost:.2f}")
        
        return {
            'success': True,
            'grocery_list': grocery_list_data,
            'cost_breakdown': {
                'total_cost': cost_breakdown.total_cost,
                'cost_per_day': cost_breakdown.cost_per_day,
                'cost_per_meal': cost_breakdown.cost_per_meal,
                'category_breakdown': cost_breakdown.category_breakdown,
                'item_count': cost_breakdown.item_count
            },
            'summary': {
                'total_items': len(grocery_items),
                'total_cost': cost_breakdown.total_cost,
                'days': days,
                'meals_per_day': meals_per_day,
                'recipes_parsed': len(recipes)
            }
        }
