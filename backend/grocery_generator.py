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
        
        # Categories that should be excluded from cost calculations (reusable items)
        self.cost_excluded_categories = ['herbs_spices', 'condiments', 'pantry']
        
        # Estimated costs per typical serving/recipe portion (USD, realistic grocery prices)
       self.estimated_costs = {
        # Proteins (per typical recipe serving)
        'chicken': 1.50, 'beef': 2.50, 'pork': 1.75,
        'fish': 3.00, 'salmon': 4.00, 'tuna': 1.25,
        'eggs': 0.75, 'tofu': 1.25, 'beans': 0.40,
        'lentils': 0.30, 'turkey': 2.00, 'shrimp': 4.50,
        'lamb': 3.50,
        
        # Vegetables
        'onion': 0.35, 'garlic': 0.15, 'tomato': 1.00,
        'carrot': 0.40, 'celery': 0.60, 'bell pepper': 1.00,
        'broccoli': 0.75, 'spinach': 0.70, 'lettuce': 0.60,
        'cucumber': 0.75, 'potato': 0.45, 'sweet potato': 0.60,
        'mushroom': 1.25, 'zucchini': 0.75, 'corn': 0.60,
        'peas': 0.80, 'green beans': 1.00, 'cauliflower': 1.00,
        'cabbage': 0.50, 'kale': 0.80, 'asparagus': 1.50,
        'brussels sprouts': 1.25,
        
        # Fruits
        'apple': 0.75, 'banana': 0.35, 'orange': 0.75,
        'lemon': 0.50, 'lime': 0.40, 'berries': 1.50,
        'strawberry': 1.25, 'blueberry': 1.75, 'grape': 1.00,
        'avocado': 1.50, 'mango': 1.00, 'pineapple': 1.25,
        'peach': 0.85, 'pear': 0.75,
        
        # Dairy
        'milk': 0.75, 'cheese': 1.25, 'butter': 0.60,
        'yogurt': 1.00, 'cream': 0.75, 'sour cream': 0.60,
        'cottage cheese': 0.85, 'mozzarella': 1.50,
        'cheddar': 1.75, 'parmesan': 1.25,
        
        # Grains
        'rice': 0.40, 'pasta': 0.60, 'bread': 0.75,
        'flour': 0.30, 'oats': 0.50, 'quinoa': 1.00,
        'barley': 0.35, 'couscous': 0.60, 'noodles': 0.75,
        'cereal': 0.80, 'tortilla': 0.60, 'crackers': 0.80,
        
        # Frozen foods
        'frozen vegetables': 0.75, 'frozen fruit': 1.00,
        'ice cream': 1.75, 'frozen pizza': 3.50,
        'frozen chicken': 2.00,
        
        # Snacks
        'nuts': 1.25, 'chips': 1.00, 'granola bars': 1.25,
        'pretzels': 0.75,
        
        # Beverages
        'water': 0.15, 'juice': 0.80, 'soda': 1.00,
        'coffee': 0.35, 'tea': 0.25, 'wine': 4.00,
        'beer': 2.00,
        
        # Default for unknown items
        'default': 1.00
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

    def _estimate_cost(self, ingredient_name: str, quantity_info: Dict, category: str) -> float:
        """Estimate cost for an ingredient if it's not in excluded categories"""
        # Return 0 for excluded categories
        if category in self.cost_excluded_categories:
            return 0.0
            
        base_cost = self.estimated_costs.get(ingredient_name.lower(), self.estimated_costs['default'])
        
        # Adjust based on quantity - much more conservative multiplier
        try:
            quantity_str = quantity_info['display']
            # Handle different quantity formats
            if 'portions' in quantity_str:
                # Extract number from "X portions"
                multiplier = float(re.search(r'(\d+(?:\.\d+)?)', quantity_str).group(1)) if re.search(r'(\d+(?:\.\d+)?)', quantity_str) else 1.0
            else:
                multiplier = float(quantity_str)
            
            # Cap multiplier to prevent unrealistic costs
            if multiplier > 5:  # Cap at 5x base cost
                multiplier = min(multiplier, 8)
            elif multiplier > 2:  # Reduce scaling for larger quantities
                multiplier = 2 + (multiplier - 2) * 0.5
                
        except (ValueError, AttributeError):
            multiplier = 1.0
        
        # Add smaller variance for more consistent estimates
        variance = random.uniform(0.9, 1.1)
        
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
                'category': item.category,
                'notes': item.notes,
                'excluded_from_cost': item.category in self.cost_excluded_categories
            })
        
        print(f"✅ Generated grocery list with {len(grocery_items)} items")
        print(f"💰 Total cost: ${total_cost:.2f} (excluding {len(excluded_items)} reusable items)")
        
        return {
            'success': True,
            'grocery_list': grocery_list_data,
            'cost_breakdown': {
                'total_cost': cost_breakdown.total_cost,
                'cost_per_day': cost_breakdown.cost_per_day,
                'cost_per_meal': cost_breakdown.cost_per_meal,
                'category_breakdown': cost_breakdown.category_breakdown,
                'item_count': cost_breakdown.item_count,
                'excluded_items': cost_breakdown.excluded_items
            },
            'summary': {
                'total_items': len(grocery_items),
                'total_cost': cost_breakdown.total_cost,
                'excluded_items_count': len(excluded_items),
                'days': days,
                'meals_per_day': meals_per_day,
                'recipes_parsed': len(recipes)
            }
        }
