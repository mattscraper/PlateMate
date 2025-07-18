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

class RealisticGroceryListGenerator:
    def __init__(self):
        # Comprehensive ingredient database with realistic serving amounts
        self.ingredient_database = {
            # PROTEINS - with realistic serving sizes and costs
            'chicken breast': {'category': 'proteins', 'unit': 'lbs', 'cost_per_unit': 4.99, 'typical_serving': 0.25},
            'chicken thighs': {'category': 'proteins', 'unit': 'lbs', 'cost_per_unit': 3.49, 'typical_serving': 0.3},
            'ground beef': {'category': 'proteins', 'unit': 'lbs', 'cost_per_unit': 5.99, 'typical_serving': 0.25},
            'ground turkey': {'category': 'proteins', 'unit': 'lbs', 'cost_per_unit': 4.99, 'typical_serving': 0.25},
            'salmon fillet': {'category': 'proteins', 'unit': 'lbs', 'cost_per_unit': 12.99, 'typical_serving': 0.2},
            'tilapia': {'category': 'proteins', 'unit': 'lbs', 'cost_per_unit': 6.99, 'typical_serving': 0.2},
            'shrimp': {'category': 'proteins', 'unit': 'lbs', 'cost_per_unit': 8.99, 'typical_serving': 0.2},
            'eggs': {'category': 'proteins', 'unit': 'dozen', 'cost_per_unit': 3.49, 'typical_serving': 0.17},
            'tofu': {'category': 'proteins', 'unit': 'package', 'cost_per_unit': 2.99, 'typical_serving': 0.5},
            'black beans': {'category': 'proteins', 'unit': 'can', 'cost_per_unit': 1.29, 'typical_serving': 0.5},
            'chickpeas': {'category': 'proteins', 'unit': 'can', 'cost_per_unit': 1.39, 'typical_serving': 0.5},
            'lentils': {'category': 'proteins', 'unit': 'bag', 'cost_per_unit': 2.49, 'typical_serving': 0.1},
            
            # VEGETABLES - fresh produce with realistic pricing
            'onion': {'category': 'vegetables', 'unit': 'medium', 'cost_per_unit': 0.75, 'typical_serving': 1},
            'yellow onion': {'category': 'vegetables', 'unit': 'bag', 'cost_per_unit': 2.99, 'typical_serving': 0.2},
            'red onion': {'category': 'vegetables', 'unit': 'medium', 'cost_per_unit': 0.89, 'typical_serving': 1},
            'garlic': {'category': 'vegetables', 'unit': 'head', 'cost_per_unit': 0.69, 'typical_serving': 0.1},
            'carrots': {'category': 'vegetables', 'unit': 'bag', 'cost_per_unit': 1.99, 'typical_serving': 0.25},
            'celery': {'category': 'vegetables', 'unit': 'bunch', 'cost_per_unit': 1.79, 'typical_serving': 0.3},
            'bell pepper': {'category': 'vegetables', 'unit': 'each', 'cost_per_unit': 1.49, 'typical_serving': 1},
            'red bell pepper': {'category': 'vegetables', 'unit': 'each', 'cost_per_unit': 1.69, 'typical_serving': 1},
            'broccoli': {'category': 'vegetables', 'unit': 'head', 'cost_per_unit': 2.49, 'typical_serving': 1},
            'spinach': {'category': 'vegetables', 'unit': 'bag', 'cost_per_unit': 2.99, 'typical_serving': 0.5},
            'kale': {'category': 'vegetables', 'unit': 'bunch', 'cost_per_unit': 2.49, 'typical_serving': 0.5},
            'romaine lettuce': {'category': 'vegetables', 'unit': 'head', 'cost_per_unit': 1.99, 'typical_serving': 0.5},
            'cucumber': {'category': 'vegetables', 'unit': 'each', 'cost_per_unit': 0.99, 'typical_serving': 1},
            'zucchini': {'category': 'vegetables', 'unit': 'each', 'cost_per_unit': 1.29, 'typical_serving': 1},
            'mushrooms': {'category': 'vegetables', 'unit': 'package', 'cost_per_unit': 2.49, 'typical_serving': 0.5},
            'tomatoes': {'category': 'vegetables', 'unit': 'lbs', 'cost_per_unit': 3.99, 'typical_serving': 0.3},
            'cherry tomatoes': {'category': 'vegetables', 'unit': 'container', 'cost_per_unit': 2.99, 'typical_serving': 0.5},
            'potatoes': {'category': 'vegetables', 'unit': 'bag', 'cost_per_unit': 3.99, 'typical_serving': 0.15},
            'sweet potatoes': {'category': 'vegetables', 'unit': 'lbs', 'cost_per_unit': 1.99, 'typical_serving': 0.5},
            
            # FRUITS - seasonal pricing consideration
            'bananas': {'category': 'fruits', 'unit': 'bunch', 'cost_per_unit': 1.79, 'typical_serving': 0.2},
            'apples': {'category': 'fruits', 'unit': 'bag', 'cost_per_unit': 4.99, 'typical_serving': 0.15},
            'oranges': {'category': 'fruits', 'unit': 'bag', 'cost_per_unit': 4.49, 'typical_serving': 0.15},
            'lemons': {'category': 'fruits', 'unit': 'bag', 'cost_per_unit': 2.99, 'typical_serving': 0.15},
            'limes': {'category': 'fruits', 'unit': 'bag', 'cost_per_unit': 2.49, 'typical_serving': 0.2},
            'strawberries': {'category': 'fruits', 'unit': 'container', 'cost_per_unit': 3.99, 'typical_serving': 0.5},
            'blueberries': {'category': 'fruits', 'unit': 'container', 'cost_per_unit': 4.99, 'typical_serving': 0.5},
            'avocados': {'category': 'fruits', 'unit': 'each', 'cost_per_unit': 1.29, 'typical_serving': 1},
            'mangoes': {'category': 'fruits', 'unit': 'each', 'cost_per_unit': 1.99, 'typical_serving': 1},
            
            # DAIRY & REFRIGERATED
            'milk': {'category': 'dairy', 'unit': 'gallon', 'cost_per_unit': 3.99, 'typical_serving': 0.06},
            'heavy cream': {'category': 'dairy', 'unit': 'pint', 'cost_per_unit': 2.99, 'typical_serving': 0.25},
            'butter': {'category': 'dairy', 'unit': 'package', 'cost_per_unit': 4.99, 'typical_serving': 0.1},
            'cheddar cheese': {'category': 'dairy', 'unit': 'block', 'cost_per_unit': 4.49, 'typical_serving': 0.2},
            'mozzarella cheese': {'category': 'dairy', 'unit': 'bag', 'cost_per_unit': 3.99, 'typical_serving': 0.25},
            'parmesan cheese': {'category': 'dairy', 'unit': 'container', 'cost_per_unit': 5.99, 'typical_serving': 0.1},
            'greek yogurt': {'category': 'dairy', 'unit': 'container', 'cost_per_unit': 4.99, 'typical_serving': 0.25},
            'cream cheese': {'category': 'dairy', 'unit': 'package', 'cost_per_unit': 2.49, 'typical_serving': 0.25},
            
            # GRAINS & STARCHES
            'rice': {'category': 'grains', 'unit': 'bag', 'cost_per_unit': 3.99, 'typical_serving': 0.05},
            'pasta': {'category': 'grains', 'unit': 'box', 'cost_per_unit': 1.49, 'typical_serving': 0.5},
            'bread': {'category': 'grains', 'unit': 'loaf', 'cost_per_unit': 2.99, 'typical_serving': 0.15},
            'tortillas': {'category': 'grains', 'unit': 'package', 'cost_per_unit': 3.49, 'typical_serving': 0.2},
            'oats': {'category': 'grains', 'unit': 'container', 'cost_per_unit': 3.99, 'typical_serving': 0.1},
            'quinoa': {'category': 'grains', 'unit': 'bag', 'cost_per_unit': 4.99, 'typical_serving': 0.1},
            'flour': {'category': 'pantry', 'unit': 'bag', 'cost_per_unit': 2.99, 'typical_serving': 0.05},
            
            # PANTRY STAPLES
            'olive oil': {'category': 'pantry', 'unit': 'bottle', 'cost_per_unit': 6.99, 'typical_serving': 0.02},
            'vegetable oil': {'category': 'pantry', 'unit': 'bottle', 'cost_per_unit': 3.99, 'typical_serving': 0.02},
            'salt': {'category': 'pantry', 'unit': 'container', 'cost_per_unit': 1.29, 'typical_serving': 0.005},
            'black pepper': {'category': 'pantry', 'unit': 'container', 'cost_per_unit': 2.99, 'typical_serving': 0.01},
            'sugar': {'category': 'pantry', 'unit': 'bag', 'cost_per_unit': 2.49, 'typical_serving': 0.02},
            'baking powder': {'category': 'pantry', 'unit': 'container', 'cost_per_unit': 1.99, 'typical_serving': 0.05},
            'vanilla extract': {'category': 'pantry', 'unit': 'bottle', 'cost_per_unit': 4.99, 'typical_serving': 0.1},
            'chicken broth': {'category': 'pantry', 'unit': 'carton', 'cost_per_unit': 1.99, 'typical_serving': 0.5},
            'canned tomatoes': {'category': 'pantry', 'unit': 'can', 'cost_per_unit': 1.49, 'typical_serving': 0.5},
            'tomato paste': {'category': 'pantry', 'unit': 'can', 'cost_per_unit': 1.29, 'typical_serving': 0.5},
            
            # HERBS & SPICES - typically small amounts
            'basil': {'category': 'herbs_spices', 'unit': 'container', 'cost_per_unit': 1.99, 'typical_serving': 0.1},
            'oregano': {'category': 'herbs_spices', 'unit': 'container', 'cost_per_unit': 1.99, 'typical_serving': 0.1},
            'thyme': {'category': 'herbs_spices', 'unit': 'container', 'cost_per_unit': 1.99, 'typical_serving': 0.1},
            'paprika': {'category': 'herbs_spices', 'unit': 'container', 'cost_per_unit': 2.49, 'typical_serving': 0.1},
            'cumin': {'category': 'herbs_spices', 'unit': 'container', 'cost_per_unit': 2.49, 'typical_serving': 0.1},
            'garlic powder': {'category': 'herbs_spices', 'unit': 'container', 'cost_per_unit': 1.99, 'typical_serving': 0.1},
            'onion powder': {'category': 'herbs_spices', 'unit': 'container', 'cost_per_unit': 1.99, 'typical_serving': 0.1},
            
            # CONDIMENTS
            'mayonnaise': {'category': 'condiments', 'unit': 'jar', 'cost_per_unit': 3.99, 'typical_serving': 0.1},
            'ketchup': {'category': 'condiments', 'unit': 'bottle', 'cost_per_unit': 2.99, 'typical_serving': 0.1},
            'mustard': {'category': 'condiments', 'unit': 'bottle', 'cost_per_unit': 2.49, 'typical_serving': 0.1},
            'soy sauce': {'category': 'condiments', 'unit': 'bottle', 'cost_per_unit': 2.99, 'typical_serving': 0.05},
            'hot sauce': {'category': 'condiments', 'unit': 'bottle', 'cost_per_unit': 2.49, 'typical_serving': 0.05},
        }
        
        # Category display order and properties
        self.category_config = {
            'proteins': {'display_name': 'Meat & Proteins', 'icon': '🥩', 'order': 1},
            'vegetables': {'display_name': 'Vegetables', 'icon': '🥕', 'order': 2},
            'fruits': {'display_name': 'Fruits', 'icon': '🍎', 'order': 3},
            'dairy': {'display_name': 'Dairy & Eggs', 'icon': '🥛', 'order': 4},
            'grains': {'display_name': 'Grains & Bread', 'icon': '🍞', 'order': 5},
            'pantry': {'display_name': 'Pantry Staples', 'icon': '🥫', 'order': 6},
            'herbs_spices': {'display_name': 'Herbs & Spices', 'icon': '🌿', 'order': 7},
            'condiments': {'display_name': 'Condiments', 'icon': '🍯', 'order': 8},
        }
        
        # Common ingredient aliases for better matching
        self.ingredient_aliases = {
            'chicken': 'chicken breast',
            'ground meat': 'ground beef',
            'beef': 'ground beef',
            'fish': 'tilapia',
            'cheese': 'cheddar cheese',
            'yogurt': 'greek yogurt',
            'lettuce': 'romaine lettuce',
            'peppers': 'bell pepper',
            'oil': 'olive oil',
            'spice': 'paprika',
            'herb': 'basil',
        }

    def clean_and_parse_ingredient(self, ingredient_text: str) -> Optional[Dict]:
        """Advanced ingredient parsing with realistic quantity extraction"""
        if not ingredient_text or len(ingredient_text.strip()) < 2:
            return None
            
        # Clean the input
        cleaned = ingredient_text.strip().lower()
        
        # Remove common cooking descriptors
        descriptors_to_remove = [
            r'\b(fresh|dried|chopped|diced|minced|sliced|grated|organic|raw|cooked|frozen|canned)\b',
            r'\b(large|medium|small|extra|jumbo)\b',
            r'\b(to taste|optional|for serving|preferably)\b'
        ]
        
        for pattern in descriptors_to_remove:
            cleaned = re.sub(pattern, ' ', cleaned)
        
        # Clean up extra spaces
        cleaned = re.sub(r'\s+', ' ', cleaned).strip()
        
        # Extract quantity and unit using comprehensive patterns
        quantity_patterns = [
            # Decimal numbers with units
            r'^(\d+(?:\.\d+)?)\s*(cups?|cup|tablespoons?|tbsp|teaspoons?|tsp|pounds?|lbs?|ounces?|oz|grams?|g|kilograms?|kg|liters?|l|milliliters?|ml|pieces?|piece|cloves?|clove|heads?|head|bunches?|bunch|cans?|can|jars?|jar|packages?|package|containers?|container|bottles?|bottle|bags?|bag|boxes?|box)\s+(.+)$',
            
            # Fractions with units
            r'^(\d+\s+\d+/\d+|\d+/\d+)\s*(cups?|cup|tablespoons?|tbsp|teaspoons?|tsp|pounds?|lbs?|ounces?|oz|grams?|g)\s+(.+)$',
            
            # Just numbers (assume pieces/items)
            r'^(\d+)\s+(.+)$',
            
            # No quantity specified
            r'^(.+)$'
        ]
        
        quantity = 1.0
        unit = 'item'
        ingredient_name = cleaned
        
        for pattern in quantity_patterns:
            match = re.match(pattern, cleaned)
            if match:
                groups = match.groups()
                if len(groups) == 3:  # quantity + unit + ingredient
                    quantity_str, unit_str, ingredient_name = groups
                    quantity = self._parse_quantity_string(quantity_str)
                    unit = unit_str.lower()
                    break
                elif len(groups) == 2:  # either quantity + ingredient or fraction + unit + ingredient
                    if any(word in groups[0] for word in ['cup', 'tbsp', 'tsp', 'lb', 'oz']):
                        # This is likely quantity + unit in first group
                        parts = groups[0].split()
                        if len(parts) >= 2:
                            quantity = self._parse_quantity_string(' '.join(parts[:-1]))
                            unit = parts[-1]
                            ingredient_name = groups[1]
                        else:
                            quantity = self._parse_quantity_string(groups[0])
                            ingredient_name = groups[1]
                    else:
                        quantity = self._parse_quantity_string(groups[0])
                        ingredient_name = groups[1]
                    break
                elif len(groups) == 1:  # just ingredient
                    ingredient_name = groups[0]
                    break
        
        # Clean and normalize ingredient name
        ingredient_name = ingredient_name.strip()
        
        # Find best match in database
        matched_ingredient = self._find_best_ingredient_match(ingredient_name)
        if not matched_ingredient:
            return None
            
        return {
            'original_text': ingredient_text,
            'quantity': quantity,
            'unit': unit,
            'ingredient_key': matched_ingredient,
            'ingredient_data': self.ingredient_database[matched_ingredient]
        }

    def _parse_quantity_string(self, qty_str: str) -> float:
        """Parse quantity string including fractions and ranges"""
        qty_str = qty_str.strip()
        
        # Handle ranges (take average)
        if '-' in qty_str or 'to' in qty_str:
            parts = re.split(r'[-\s+to\s+]', qty_str)
            try:
                return (float(parts[0]) + float(parts[-1])) / 2
            except (ValueError, IndexError):
                return 1.0
        
        # Handle fractions
        if '/' in qty_str:
            try:
                if ' ' in qty_str:  # Mixed number like "1 1/2"
                    whole, fraction = qty_str.split(' ', 1)
                    whole_val = float(whole)
                    num, den = fraction.split('/')
                    frac_val = float(num) / float(den)
                    return whole_val + frac_val
                else:  # Simple fraction like "1/2"
                    num, den = qty_str.split('/')
                    return float(num) / float(den)
            except (ValueError, ZeroDivisionError):
                return 1.0
        
        # Handle regular numbers
        try:
            return float(qty_str)
        except ValueError:
            return 1.0

    def _find_best_ingredient_match(self, ingredient_name: str) -> Optional[str]:
        """Find the best matching ingredient in the database"""
        ingredient_lower = ingredient_name.lower().strip()
        
        # Direct exact match
        if ingredient_lower in self.ingredient_database:
            return ingredient_lower
        
        # Check aliases
        if ingredient_lower in self.ingredient_aliases:
            return self.ingredient_aliases[ingredient_lower]
        
        # Fuzzy matching - find best partial match
        best_match = None
        best_score = 0
        
        for db_ingredient in self.ingredient_database.keys():
            # Check if the ingredient name contains the database ingredient
            if db_ingredient in ingredient_lower:
                score = len(db_ingredient) / len(ingredient_lower)
                if score > best_score:
                    best_score = score
                    best_match = db_ingredient
            
            # Check if the database ingredient contains the ingredient name
            elif ingredient_lower in db_ingredient:
                score = len(ingredient_lower) / len(db_ingredient)
                if score > best_score:
                    best_score = score
                    best_match = db_ingredient
        
        # Require at least 50% match confidence
        if best_score >= 0.5:
            return best_match
        
        # Word-by-word matching for compound ingredients
        ingredient_words = ingredient_lower.split()
        for db_ingredient in self.ingredient_database.keys():
            db_words = db_ingredient.split()
            common_words = set(ingredient_words) & set(db_words)
            if common_words and len(common_words) >= len(db_words) * 0.6:
                return db_ingredient
        
        return None

    def parse_meal_plan_intelligently(self, meal_plan_text: str) -> List[Dict]:
        """Intelligent meal plan parsing with ingredient extraction"""
        print("🔍 Intelligently parsing meal plan for ingredients...")
        
        # Split into recipes/meals using various separators
        recipes = []
        
        # Try different splitting strategies
        splitting_patterns = [
            r'={3,}',  # === separators
            r'-{3,}',  # --- separators
            r'\n\s*\n\s*\n',  # Multiple newlines
            r'(?i)recipe\s*\d*:',  # Recipe: headers
            r'(?i)(breakfast|lunch|dinner|snack)\s*:',  # Meal type headers
        ]
        
        text_sections = [meal_plan_text]
        
        for pattern in splitting_patterns:
            new_sections = []
            for section in text_sections:
                split_parts = re.split(pattern, section)
                new_sections.extend([part.strip() for part in split_parts if part.strip()])
            
            if len(new_sections) > len(text_sections):
                text_sections = new_sections
                break
        
        # Extract ingredients from each section
        for section in text_sections:
            if len(section) < 20:  # Skip very short sections
                continue
                
            lines = section.split('\n')
            recipe_data = {
                'title': '',
                'ingredients': [],
                'meal_type': 'meal',
                'raw_text': section
            }
            
            # Extract title (first meaningful line)
            for line in lines:
                line = line.strip()
                if (line and len(line) > 3 and
                    not line.lower().startswith(('day ', 'ingredients', 'instructions')) and
                    not re.match(r'^\d+\.', line) and
                    not line.startswith('•')):
                    recipe_data['title'] = line
                    break
            
            # Extract meal type
            section_lower = section.lower()
            for meal_type in ['breakfast', 'lunch', 'dinner', 'snack']:
                if meal_type in section_lower:
                    recipe_data['meal_type'] = meal_type
                    break
            
            # Extract ingredients (lines starting with bullet points or numbers)
            for line in lines:
                line = line.strip()
                if line.startswith('•') or line.startswith('-') or re.match(r'^\d+\.', line):
                    # Clean the ingredient line
                    ingredient_text = re.sub(r'^[•\-\d\.\s]+', '', line).strip()
                    if ingredient_text and len(ingredient_text) > 2:
                        recipe_data['ingredients'].append(ingredient_text)
            
            # If no bullet points found, look for lines that might be ingredients
            if not recipe_data['ingredients']:
                for line in lines:
                    line = line.strip()
                    # Skip titles, headers, and instructions
                    if (line and len(line) > 5 and
                        not line.lower().startswith(('recipe', 'ingredients', 'instructions', 'preparation', 'cooking', 'serves', 'servings')) and
                        not line.endswith(':') and
                        any(keyword in line.lower() for keyword in ['cup', 'tbsp', 'tsp', 'lb', 'oz', 'gram', 'piece', 'clove', 'can', 'jar']) and
                        len(line.split()) >= 2):
                        recipe_data['ingredients'].append(line)
            
            if recipe_data['title'] and recipe_data['ingredients']:
                recipes.append(recipe_data)
        
        print(f"✅ Extracted {len(recipes)} recipes with ingredients")
        return recipes

    def consolidate_ingredients_realistically(self, recipes: List[Dict]) -> List[GroceryItem]:
        """Consolidate ingredients with realistic quantities and smart combining"""
        print("🔄 Consolidating ingredients with realistic quantities...")
        
        # Track ingredients by their database key
        ingredient_tracker = defaultdict(lambda: {
            'total_quantity': 0.0,
            'unit_counts': defaultdict(float),
            'recipe_uses': [],
            'ingredient_data': None
        })
        
        # Process each recipe
        for recipe in recipes:
            print(f"  Processing: {recipe['title'][:50]}...")
            
            for ingredient_text in recipe['ingredients']:
                parsed = self.clean_and_parse_ingredient(ingredient_text)
                
                if parsed:
                    key = parsed['ingredient_key']
                    data = parsed['ingredient_data']
                    
                    # Add to tracker
                    ingredient_tracker[key]['total_quantity'] += parsed['quantity']
                    ingredient_tracker[key]['unit_counts'][parsed['unit']] += parsed['quantity']
                    ingredient_tracker[key]['recipe_uses'].append({
                        'recipe': recipe['title'],
                        'quantity': parsed['quantity'],
                        'unit': parsed['unit'],
                        'original_text': parsed['original_text']
                    })
                    ingredient_tracker[key]['ingredient_data'] = data
        
        # Convert to grocery items with smart quantity calculation
        grocery_items = []
        
        for ingredient_key, tracker in ingredient_tracker.items():
            data = tracker['ingredient_data']
            
            # Determine the best unit and quantity
            unit_counts = tracker['unit_counts']
            
            # Choose the most common unit, or convert to store unit
            if unit_counts:
                # Prefer the database unit if available
                store_unit = data['unit']
                
                # Calculate total needed in store units
                total_needed = self._convert_to_store_units(unit_counts, store_unit, ingredient_key)
                
                # Round up to reasonable purchase quantities
                purchase_quantity = self._calculate_purchase_quantity(total_needed, store_unit, data)
                
                # Calculate cost
                estimated_cost = purchase_quantity * data['cost_per_unit']
                
                # Format quantity display
                quantity_display = self._format_quantity_display(purchase_quantity)
                
                grocery_item = GroceryItem(
                    name=ingredient_key.replace('_', ' ').title(),
                    quantity=quantity_display,
                    unit=store_unit,
                    category=data['category'],
                    notes=f"Used in {len(tracker['recipe_uses'])} recipes",
                    estimated_cost=round(estimated_cost, 2),
                    is_checked=False
                )
                
                grocery_items.append(grocery_item)
        
        # Sort by category and name
        category_order = {config['order']: cat for cat, config in self.category_config.items()}
        grocery_items.sort(key=lambda x: (
            self.category_config.get(x.category, {}).get('order', 99),
            x.name
        ))
        
        print(f"✅ Created {len(grocery_items)} consolidated grocery items")
        return grocery_items

    def _convert_to_store_units(self, unit_counts: Dict[str, float], store_unit: str, ingredient_key: str) -> float:
        """Convert various units to store purchase units"""
        # Simple conversion for now - in a full implementation, you'd have a comprehensive conversion table
        total_in_store_units = 0.0
        
        for unit, quantity in unit_counts.items():
            if unit == store_unit:
                total_in_store_units += quantity
            elif unit in ['cup', 'cups'] and store_unit in ['bag', 'container', 'box']:
                # Approximate conversion for volume to package
                total_in_store_units += quantity * 0.1  # Rough estimate
            elif unit in ['tbsp', 'tablespoon', 'tablespoons'] and store_unit == 'bottle':
                total_in_store_units += quantity * 0.01  # Very small amount of bottle
            elif unit in ['tsp', 'teaspoon', 'teaspoons'] and store_unit == 'container':
                total_in_store_units += quantity * 0.005  # Tiny amount
            elif unit in ['piece', 'pieces', 'each'] and store_unit in ['each', 'item', 'piece']:
                total_in_store_units += quantity
            elif unit in ['clove', 'cloves'] and ingredient_key == 'garlic':
                total_in_store_units += quantity * 0.1  # 10 cloves per head roughly
            else:
                # Default: assume the quantity maps directly
                total_in_store_units += quantity
        
        return total_in_store_units

    def _calculate_purchase_quantity(self, needed_quantity: float, unit: str, ingredient_data: Dict) -> float:
        """Calculate realistic purchase quantity (round up to typical store packages)"""
        if needed_quantity <= 0:
            return 1.0
        
        # For items sold individually, round up to whole numbers
        if unit in ['each', 'item', 'piece', 'head', 'bunch', 'container', 'package', 'bag', 'box', 'bottle', 'jar', 'can', 'carton']:
            return max(1.0, round(needed_quantity))
        
        # For items sold by weight, use reasonable minimums
        elif unit in ['lbs', 'pounds']:
            return max(0.5, round(needed_quantity * 2) / 2)  # Round to nearest 0.5 lb
        
        # For bulk items, ensure reasonable minimum quantities
        elif unit in ['bag', 'container'] and ingredient_data['category'] in ['grains', 'pantry']:
            return max(1.0, round(needed_quantity))
        
        else:
            return max(1.0, round(needed_quantity, 1))

    def _format_quantity_display(self, quantity: float) -> str:
        """Format quantity for display"""
        if quantity == int(quantity):
            return str(int(quantity))
        elif quantity < 1:
            # Convert to fraction if reasonable
            if abs(quantity - 0.5) < 0.1:
                return "1/2"
            elif abs(quantity - 0.25) < 0.1:
                return "1/4"
            elif abs(quantity - 0.75) < 0.1:
                return "3/4"
            else:
                return f"{quantity:.1f}"
        else:
            return f"{quantity:.1f}".rstrip('0').rstrip('.')

    def generate_grocery_list(self, meal_plan_text: str, days: int, meals_per_day: int) -> Dict:
        """Generate a realistic grocery list from meal plan"""
        print(f"🛒 Generating realistic grocery list for {days} days, {meals_per_day} meals/day")
        
        try:
            # Parse the meal plan
            recipes = self.parse_meal_plan_intelligently(meal_plan_text)
            
            if not recipes:
                return {
                    'success': False,
                    'error': 'No recipes or ingredients could be extracted from the meal plan'
                }
            
            # Consolidate ingredients
            grocery_items = self.consolidate_ingredients_realistically(recipes)
            
            if not grocery_items:
                return {
                    'success': False,
                    'error': 'No valid ingredients could be processed from the meal plan'
                }
            
            # Calculate costs and organize by category
            total_cost = 0.0
            category_breakdown = defaultdict(float)
            categorized_items = defaultdict(list)
            
            for item in grocery_items:
                total_cost += item.estimated_cost
                category_breakdown[item.category] += item.estimated_cost
                
                # Convert to serializable format
                item_dict = {
                    'name': item.name,
                    'quantity': item.quantity,
                    'unit': item.unit,
                    'category': self.category_config.get(item.category, {}).get('display_name', item.category.title()),
                    'notes': item.notes,
                    'estimated_cost': item.estimated_cost,
                    'is_checked': False,
                    'checked_at': None
                }
                categorized_items[item.category].append(item_dict)
            
            # Generate enhanced shopping tips
            shopping_tips = self._generate_smart_shopping_tips(grocery_items, total_cost, days)
            
            # Create cost breakdown
            cost_breakdown = {
                'total_cost': round(total_cost, 2),
                'cost_per_day': round(total_cost / max(days, 1), 2),
                'cost_per_meal': round(total_cost / max(days * meals_per_day, 1), 2),
                'category_breakdown': {
                    self.category_config.get(cat, {}).get('display_name', cat.title()): round(cost, 2)
                    for cat, cost in category_breakdown.items()
                },
                'item_count': len(grocery_items),
                'excluded_items': []
            }
            
            # Create organized grocery list
            grocery_list = []
            for category in sorted(categorized_items.keys(), key=lambda x: self.category_config.get(x, {}).get('order', 99)):
                grocery_list.extend(categorized_items[category])
            
            # Summary statistics
            summary = {
                'total_items': len(grocery_items),
                'total_cost': round(total_cost, 2),
                'recipes_processed': len(recipes),
                'days': days,
                'meals_per_day': meals_per_day,
                'avg_cost_per_meal': round(total_cost / max(days * meals_per_day, 1), 2),
                'category_counts': {
                    self.category_config.get(cat, {}).get('display_name', cat.title()): len(items)
                    for cat, items in categorized_items.items()
                }
            }
            
            return {
                'success': True,
                'grocery_list': grocery_list,
                'cost_breakdown': cost_breakdown,
                'summary': summary,
                'shopping_tips': shopping_tips,
                'recipes_found': len(recipes),
                'ingredients_processed': len(grocery_items)
            }
            
        except Exception as e:
            print(f"❌ Error generating grocery list: {e}")
            return {
                'success': False,
                'error': f'Failed to generate grocery list: {str(e)}'
            }

    def _generate_smart_shopping_tips(self, grocery_items: List[GroceryItem], total_cost: float, days: int) -> List[str]:
        """Generate intelligent shopping tips based on the list contents"""
        tips = []
        
        # Analyze list composition
        category_counts = defaultdict(int)
        high_cost_items = []
        
        for item in grocery_items:
            category_counts[item.category] += 1
            if item.estimated_cost > 8.0:
                high_cost_items.append(item.name)
        
        # Store navigation tips
        if len(grocery_items) > 15:
            tips.append("🏪 Shop the store perimeter first (produce, meat, dairy) then tackle inner aisles")
        
        # Cost-saving tips
        if total_cost > 100:
            tips.append("💰 Look for store brands on pantry staples - they can save 20-30% with same quality")
            
        if high_cost_items:
            tips.append(f"🏷️ Price check these items: {', '.join(high_cost_items[:3])} - consider sales or alternatives")
        
        # Perishables management
        if category_counts['vegetables'] + category_counts['fruits'] > 8:
            tips.append("🥬 Buy a mix of ripe and unripe produce to ensure freshness throughout the week")
        
        # Protein tips
        if category_counts['proteins'] > 3:
            tips.append("🥩 Ask about family packs for meat - often 10-15% cheaper and you can freeze portions")
        
        # Smart shopping timing
        if len(grocery_items) > 20:
            tips.append("⏰ Shop early morning or late evening for shorter lines and better produce selection")
        
        # Bulk buying opportunities
        if category_counts['pantry'] > 5:
            tips.append("📦 Consider buying pantry staples in bulk - rice, pasta, and canned goods store well")
        
        # Organization tip
        tips.append("📋 Group items by store section on your phone to speed up shopping")
        
        return tips[:6]  # Limit to 6 most relevant tips

# Flask route implementation
grocery_generator = RealisticGroceryListGenerator()

def create_grocery_list_route():
    """Create the Flask route for grocery list generation"""
    
    @cross_origin()
    def generate_grocery_list():
        try:
            data = request.get_json()
            
            if not data:
                return jsonify({'success': False, 'error': 'No data provided'}), 400
            
            meal_plan = data.get('meal_plan', '')
            days = data.get('days', 7)
            meals_per_day = data.get('meals_per_day', 3)
            
            if not meal_plan:
                return jsonify({'success': False, 'error': 'Meal plan text is required'}), 400
            
            # Generate the grocery list
            result = grocery_generator.generate_grocery_list(meal_plan, days, meals_per_day)
            
            return jsonify(result)
            
        except Exception as e:
            print(f"❌ Route error: {e}")
            return jsonify({
                'success': False,
                'error': f'Server error: {str(e)}'
            }), 500
    
    return generate_grocery_list
