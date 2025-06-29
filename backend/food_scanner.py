from flask import Blueprint, request, jsonify
import requests
import re
from typing import Dict, List, Optional
import logging
import time
import json

# Configure logging
logger = logging.getLogger(__name__)

# Create blueprint for food scanner routes
food_scanner_bp = Blueprint('food_scanner', __name__)

class FoodHealthAnalyzer:
    def __init__(self):
        # Initialize with multiple API endpoints for maximum reliability
        self.openfoodfacts_endpoints = [
            "https://world.openfoodfacts.org/api/v0/product/{}.json",
            "https://world.openfoodfacts.net/api/v0/product/{}.json",
            "https://fr.openfoodfacts.org/api/v0/product/{}.json",
            "https://de.openfoodfacts.org/api/v0/product/{}.json"
        ]
        
        # Backup APIs (free, no API key required)
        self.backup_apis = [
            "https://api.upcitemdb.com/prod/trial/lookup?upc={}",  # UPC Database
        ]
        
        # Harmful additives database with risk levels (expanded)
        self.harmful_additives = {
            # Preservatives
            'E210': {'name': 'Benzoic acid', 'risk': 'medium', 'effects': ['allergies', 'hyperactivity']},
            'E211': {'name': 'Sodium benzoate', 'risk': 'medium', 'effects': ['hyperactivity', 'allergies']},
            'E212': {'name': 'Potassium benzoate', 'risk': 'medium', 'effects': ['allergies', 'asthma']},
            'E220': {'name': 'Sulfur dioxide', 'risk': 'high', 'effects': ['respiratory issues', 'allergies']},
            'E221': {'name': 'Sodium sulfite', 'risk': 'high', 'effects': ['allergies', 'asthma']},
            'E249': {'name': 'Potassium nitrite', 'risk': 'high', 'effects': ['cancer risk', 'blood issues']},
            'E250': {'name': 'Sodium nitrite', 'risk': 'high', 'effects': ['cancer risk', 'blood issues']},
            'E251': {'name': 'Sodium nitrate', 'risk': 'high', 'effects': ['cancer risk', 'digestive issues']},
            'E252': {'name': 'Potassium nitrate', 'risk': 'high', 'effects': ['cancer risk', 'blood pressure']},
            
            # Artificial colors
            'E102': {'name': 'Tartrazine', 'risk': 'medium', 'effects': ['hyperactivity', 'allergies']},
            'E104': {'name': 'Quinoline Yellow', 'risk': 'medium', 'effects': ['hyperactivity', 'allergies']},
            'E110': {'name': 'Sunset Yellow', 'risk': 'medium', 'effects': ['hyperactivity', 'allergies']},
            'E122': {'name': 'Carmoisine', 'risk': 'medium', 'effects': ['hyperactivity', 'cancer risk']},
            'E124': {'name': 'Ponceau 4R', 'risk': 'medium', 'effects': ['hyperactivity', 'allergies']},
            'E129': {'name': 'Allura Red', 'risk': 'medium', 'effects': ['hyperactivity', 'cancer risk']},
            'E131': {'name': 'Patent Blue V', 'risk': 'low', 'effects': ['allergies']},
            'E133': {'name': 'Brilliant Blue', 'risk': 'low', 'effects': ['allergies']},
            
            # Sweeteners
            'E950': {'name': 'Acesulfame K', 'risk': 'medium', 'effects': ['cancer risk']},
            'E951': {'name': 'Aspartame', 'risk': 'medium', 'effects': ['headaches', 'neurological issues']},
            'E952': {'name': 'Cyclamate', 'risk': 'high', 'effects': ['cancer risk']},
            'E954': {'name': 'Saccharin', 'risk': 'medium', 'effects': ['cancer risk']},
            'E955': {'name': 'Sucralose', 'risk': 'low', 'effects': ['digestive issues']},
            
            # Flavor enhancers
            'E621': {'name': 'MSG', 'risk': 'low', 'effects': ['headaches', 'nausea']},
            'E622': {'name': 'Monopotassium glutamate', 'risk': 'low', 'effects': ['headaches']},
            'E623': {'name': 'Calcium glutamate', 'risk': 'low', 'effects': ['allergies']},
            'E635': {'name': 'Disodium ribonucleotides', 'risk': 'low', 'effects': ['allergies']},
            
            # Emulsifiers
            'E433': {'name': 'Polysorbate 80', 'risk': 'medium', 'effects': ['digestive issues', 'inflammation']},
            'E471': {'name': 'Mono- and diglycerides', 'risk': 'low', 'effects': ['trans fats']},
            'E472e': {'name': 'DATEM', 'risk': 'medium', 'effects': ['heart issues', 'digestive problems']},
            
            # Antioxidants
            'E320': {'name': 'BHA', 'risk': 'high', 'effects': ['cancer risk', 'endocrine disruption']},
            'E321': {'name': 'BHT', 'risk': 'high', 'effects': ['cancer risk', 'liver damage']},
        }
        
        # Strict nutritional thresholds for scoring (per 100g)
        self.nutrition_thresholds = {
            # Nutrients to limit (negative impact)
            'energy-kcal_100g': {
                'excellent': 150,  # Very low calorie
                'good': 250,       # Low calorie
                'fair': 400,       # Moderate
                'poor': 500,       # High
                'terrible': 600    # Very high
            },
            'fat_100g': {
                'excellent': 3,
                'good': 10,
                'fair': 17.5,
                'poor': 25,
                'terrible': 35
            },
            'saturated-fat_100g': {
                'excellent': 1.5,
                'good': 3,
                'fair': 5,
                'poor': 8,
                'terrible': 12
            },
            'sugars_100g': {
                'excellent': 5,
                'good': 12.5,
                'fair': 22.5,
                'poor': 35,
                'terrible': 50
            },
            'salt_100g': {
                'excellent': 0.3,
                'good': 0.75,
                'fair': 1.5,
                'poor': 2.25,
                'terrible': 3
            },
            'sodium_100g': {
                'excellent': 0.12,
                'good': 0.3,
                'fair': 0.6,
                'poor': 0.9,
                'terrible': 1.2
            },
            # Beneficial nutrients (positive impact)
            'fiber_100g': {
                'terrible': 1,
                'poor': 2,
                'fair': 3,
                'good': 6,
                'excellent': 10
            },
            'proteins_100g': {
                'terrible': 2,
                'poor': 5,
                'fair': 8,
                'good': 15,
                'excellent': 25
            }
        }

    def fetch_from_openfoodfacts(self, barcode: str) -> Optional[Dict]:
        """Fetch from OpenFoodFacts with multiple endpoint fallback"""
        headers = {
            'User-Agent': 'PlateMate-FoodScanner/1.0 (platemate-app@example.com)',
            'Accept': 'application/json',
            'Connection': 'close',
            'Cache-Control': 'no-cache'
        }
        
        for i, endpoint_template in enumerate(self.openfoodfacts_endpoints):
            url = endpoint_template.format(barcode)
            try:
                logger.info(f"Trying OpenFoodFacts endpoint {i+1}: {url}")
                
                # Short timeout for fast failover
                response = requests.get(url, headers=headers, timeout=(3, 5))
                
                if response.status_code == 200:
                    data = response.json()
                    if data.get('status') == 1 and 'product' in data:
                        logger.info(f"SUCCESS from OpenFoodFacts endpoint {i+1}")
                        return data
                    elif data.get('status') == 0:
                        logger.info(f"Product not found in OpenFoodFacts endpoint {i+1}")
                        continue
                
            except requests.exceptions.Timeout:
                logger.warning(f"Timeout on OpenFoodFacts endpoint {i+1}")
                continue
            except requests.exceptions.RequestException as e:
                logger.warning(f"Request error on OpenFoodFacts endpoint {i+1}: {e}")
                continue
            except Exception as e:
                logger.error(f"Unexpected error on OpenFoodFacts endpoint {i+1}: {e}")
                continue
        
        return None

    def fetch_from_upc_database(self, barcode: str) -> Optional[Dict]:
        """Fetch from UPC Database as backup"""
        try:
            url = f"https://api.upcitemdb.com/prod/trial/lookup?upc={barcode}"
            headers = {
                'User-Agent': 'PlateMate-FoodScanner/1.0 (platemate-app@example.com)',
                'Accept': 'application/json'
            }
            
            logger.info(f"Trying UPC Database: {url}")
            response = requests.get(url, headers=headers, timeout=(3, 5))
            
            if response.status_code == 200:
                data = response.json()
                
                if data.get('code') == 'OK' and data.get('items'):
                    item = data['items'][0]
                    
                    # Convert UPC Database format to OpenFoodFacts-like format
                    converted_data = {
                        'status': 1,
                        'product': {
                            'product_name': item.get('title', 'Unknown Product'),
                            'brands': item.get('brand', ''),
                            'categories': ', '.join(item.get('category', [])) if item.get('category') else '',
                            'ingredients_text': '',
                            'image_url': item.get('images', [None])[0] if item.get('images') else '',
                            'serving_size': '',
                            'nutriments': {},
                            'nutriscore_grade': '',
                            'quantity': item.get('size', ''),
                            '_source': 'upc_database'
                        }
                    }
                    
                    logger.info("SUCCESS from UPC Database")
                    return converted_data
                
        except Exception as e:
            logger.warning(f"UPC Database error: {e}")
        
        return None

    def fetch_product_data(self, barcode: str) -> Optional[Dict]:
        """Master fetch function that tries all APIs"""
        
        # Try OpenFoodFacts first (best nutritional data)
        data = self.fetch_from_openfoodfacts(barcode)
        if data:
            return data
        
        # Try UPC Database as backup (basic product info)
        data = self.fetch_from_upc_database(barcode)
        if data:
            return data
        
        logger.error(f"All APIs failed for barcode: {barcode}")
        return None

    def create_fallback_product(self, barcode: str) -> Dict:
        """Create fallback product when all APIs fail"""
        return {
            'barcode': barcode,
            'product_name': f'Product {barcode}',
            'brands': '',
            'categories': '',
            'ingredients_text': '',
            'image_url': '',
            'serving_size': 33.0,
            'serving_info': {
                'serving_size': 33.0,
                'confidence': 'fallback',
                'source': 'api_failure_default',
                'original_value': 'all_apis_failed',
                'unit': 'g'
            },
            'nutri_score': {'score': 0, 'grade': 'Unknown', 'points': 0},
            'ingredients_analysis': {
                'additives': [],
                'quality_score': 50,
                'warnings': ['Product data temporarily unavailable - please try scanning again'],
                'ingredient_count': 0
            },
            'nutriments': {},
            'health_score': 50,
            'recommendations': [
                'Product information unavailable - please try scanning again',
                'Check product packaging for nutritional information',
                'Consider choosing products with verified nutritional data'
            ],
            'quality_indicators': {
                'is_ultra_processed': False,
                'has_high_risk_additives': False,
                'additive_count': 0,
                'overall_quality': 'unknown'
            },
            'api_status': 'failed'
        }

    def parse_serving_string(self, serving_str):
        """Parse serving size string and extract numeric value in grams"""
        if not serving_str or not isinstance(serving_str, str):
            return None
            
        serving_str = serving_str.strip().lower()
        
        # Extract numeric value - handle multiple numbers (e.g., "2 tbsp (32g)")
        numbers = re.findall(r'\d+\.?\d*', serving_str)
        if not numbers:
            return None
        
        # Look for grams explicitly first
        gram_match = re.search(r'(\d+\.?\d*)\s*g(?:ram)?', serving_str)
        if gram_match:
            return float(gram_match.group(1))
            
        # If no grams found, use first number and convert based on unit
        value = float(numbers[0])
        
        # Convert based on unit
        if any(unit in serving_str for unit in ['ml', 'milliliter', 'millilitre']):
            return value  # 1ml ≈ 1g for most liquids
        elif any(unit in serving_str for unit in ['cl', 'centiliter', 'centilitre']):
            return value * 10  # 1cl = 10ml
        elif any(unit in serving_str for unit in ['dl', 'deciliter', 'decilitre']):
            return value * 100  # 1dl = 100ml
        elif any(unit in serving_str for unit in ['l', 'liter', 'litre', 'lt']):
            return value * 1000  # 1l = 1000ml
        elif any(unit in serving_str for unit in ['fl oz', 'fl.oz', 'fluid ounce']):
            return value * 29.5735  # 1 fl oz = 29.5735ml
        elif any(unit in serving_str for unit in ['oz', 'ounce']):
            return value * 28.3495  # 1 oz = 28.3495g
        elif any(unit in serving_str for unit in ['lb', 'pound']):
            return value * 453.592  # 1 lb = 453.592g
        elif any(unit in serving_str for unit in ['kg', 'kilogram']):
            return value * 1000  # 1kg = 1000g
        elif any(unit in serving_str for unit in ['mg', 'milligram']):
            return value / 1000  # 1mg = 0.001g
        elif any(unit in serving_str for unit in ['tbsp', 'tablespoon', 'table spoon']):
            return value * 15  # 1 tbsp ≈ 15g (varies by ingredient)
        elif any(unit in serving_str for unit in ['tsp', 'teaspoon', 'tea spoon']):
            return value * 5   # 1 tsp ≈ 5g (varies by ingredient)
        elif any(unit in serving_str for unit in ['cup']):
            return value * 240  # 1 cup ≈ 240g (varies by ingredient)
        else:
            # No unit specified, assume grams if reasonable
            if 1 <= value <= 1000:
                return value
            return None

    def get_serving_size_from_api(self, product: Dict) -> Dict:
        """Extract serving size from product data with comprehensive field checking"""
        
        # Priority 1: Check serving_size field (string with units)
        serving_size = product.get('serving_size')
        if serving_size:
            parsed = self.parse_serving_string(serving_size)
            if parsed and 1 <= parsed <= 1000:
                return {
                    'serving_size': round(parsed, 1),
                    'confidence': 'high',
                    'source': 'serving_size_field',
                    'original_value': serving_size,
                    'unit': 'g'
                }
        
        # Priority 2: Check serving_quantity field (usually numeric in grams)
        serving_quantity = product.get('serving_quantity')
        if serving_quantity:
            try:
                value = float(serving_quantity)
                if 1 <= value <= 1000:  # Reasonable serving size range
                    return {
                        'serving_size': round(value, 1),
                        'confidence': 'high',
                        'source': 'serving_quantity_field',
                        'original_value': serving_quantity,
                        'unit': 'g'
                    }
            except (ValueError, TypeError):
                pass
        
        # Priority 3: Check nutriments for serving-specific data
        nutriments = product.get('nutriments', {})
        
        # Look for any nutrient with _serving suffix to infer serving size
        for key, value in nutriments.items():
            if key.endswith('_serving') and value:
                try:
                    serving_value = float(value)
                    # Find corresponding _100g value to calculate serving size
                    base_key = key.replace('_serving', '_100g')
                    per_100g_value = nutriments.get(base_key)
                    
                    if per_100g_value and float(per_100g_value) > 0:
                        # Calculate serving size: (serving_value / per_100g_value) * 100
                        calculated_serving = (serving_value / float(per_100g_value)) * 100
                        if 5 <= calculated_serving <= 500:  # Reasonable range
                            return {
                                'serving_size': round(calculated_serving, 1),
                                'confidence': 'medium',
                                'source': f'calculated_from_{key}',
                                'original_value': f'{key}: {value}, {base_key}: {per_100g_value}',
                                'unit': 'g'
                            }
                except (ValueError, TypeError, ZeroDivisionError):
                    continue
        
        # Priority 4: Check product_quantity for single-serve items
        product_quantity = product.get('product_quantity')
        if product_quantity:
            try:
                value = float(product_quantity)
                # For single-serve items, the product quantity might be the serving size
                if 10 <= value <= 500:
                    return {
                        'serving_size': round(value, 1),
                        'confidence': 'medium',
                        'source': 'product_quantity_field',
                        'original_value': product_quantity,
                        'unit': 'g'
                    }
            except (ValueError, TypeError):
                pass
        
        # Priority 5: Parse quantity field for serving clues
        quantity = product.get('quantity')
        if quantity:
            parsed = self.parse_serving_string(quantity)
            if parsed and 10 <= parsed <= 500:
                return {
                    'serving_size': round(parsed, 1),
                    'confidence': 'low',
                    'source': 'quantity_field',
                    'original_value': quantity,
                    'unit': 'g'
                }
        
        # Priority 6: Enhanced category-based defaults
        categories = product.get('categories', '').lower()
        product_name = product.get('product_name', '').lower()
        
        # More comprehensive category mapping
        category_mappings = {
            # Beverages (most specific first)
            'energy-drinks': 250, 'sports-drinks': 355, 'soft-drinks': 355, 'sodas': 355,
            'carbonated-drinks': 355, 'fruit-juices': 240, 'orange-juices': 240,
            'apple-juices': 240, 'vegetable-juices': 240, 'smoothies': 240,
            'plant-based-milks': 240, 'almond-milk': 240, 'soy-milk': 240, 'oat-milk': 240,
            'dairy-milk': 240, 'milks': 240, 'waters': 240, 'mineral-waters': 240,
            'teas': 240, 'coffees': 240, 'iced-teas': 240, 'kombucha': 240,
            
            # Dairy & Refrigerated
            'greek-yogurts': 170, 'yogurts': 170, 'plain-yogurts': 170, 'yoghurts': 170,
            'hard-cheeses': 28, 'soft-cheeses': 28, 'cheeses': 28, 'cottage-cheese': 113,
            'cream-cheese': 28, 'ice-creams': 65, 'frozen-desserts': 65, 'gelato': 65,
            'butter': 14, 'margarine': 14, 'ghee': 14,
            
            # Spreads & Condiments (most specific first)
            'peanut-butters': 32, 'almond-butters': 32, 'cashew-butters': 32, 'nut-butters': 32,
            'chocolate-spreads': 20, 'fruit-preserves': 20, 'jams': 20, 'jellies': 20,
            'marmalades': 20, 'honey': 21, 'maple-syrups': 20, 'agave-nectar': 21,
            'spreads': 20, 'tahini': 16, 'hummus': 30,
            'salad-dressings': 30, 'mayonnaise': 15, 'mustard': 5, 'ketchup': 17,
            'hot-sauce': 5, 'barbecue-sauce': 17, 'soy-sauce': 6, 'condiments': 15,
            'sauces': 30, 'marinara-sauce': 60, 'pasta-sauces': 60,
            
            # Breakfast & Cereals
            'granolas': 55, 'muesli': 45, 'breakfast-cereals': 40, 'cereals': 40,
            'oat-flakes': 40, 'corn-flakes': 30, 'rice-cereals': 30,
            'instant-oatmeal': 40, 'oatmeal': 40, 'porridge': 40, 'quinoa-flakes': 40,
            
            # Snacks (most specific first)
            'dark-chocolates': 40, 'milk-chocolates': 40, 'white-chocolates': 40, 'chocolates': 40,
            'chocolate-bars': 45, 'candy-bars': 45, 'protein-bars': 45, 'granola-bars': 35,
            'energy-bars': 40, 'nutrition-bars': 40,
            'gummy-candies': 30, 'hard-candies': 15, 'candies': 30, 'gummies': 30,
            'lollipops': 15, 'mints': 2,
            'potato-chips': 28, 'corn-chips': 28, 'tortilla-chips': 28, 'chips': 28,
            'pretzels': 30, 'popcorn': 25, 'rice-cakes': 9, 'crackers': 30,
            'cookies': 30, 'biscuits': 30, 'wafers': 30, 'sandwich-cookies': 30,
            'mixed-nuts': 28, 'almonds': 28, 'peanuts': 28, 'cashews': 28, 'nuts': 28,
            'dried-fruits': 30, 'raisins': 30, 'dried-cranberries': 30,
            'jerky': 14, 'beef-jerky': 14, 'turkey-jerky': 14,
            
            # Staples & Grains
            'whole-wheat-breads': 25, 'white-breads': 25, 'sourdough-bread': 25, 'breads': 25,
            'bagels': 85, 'english-muffins': 60, 'muffins': 60, 'croissants': 60,
            'tortillas': 45, 'wraps': 45, 'pita-bread': 30,
            'spaghetti': 85, 'pasta': 85, 'noodles': 85, 'ramen': 85, 'macaroni': 85,
            'brown-rice': 80, 'white-rice': 80, 'rice': 80, 'wild-rice': 80,
            'quinoa': 80, 'couscous': 80, 'bulgur': 80, 'barley': 80,
            'olive-oils': 14, 'vegetable-oils': 14, 'coconut-oil': 14, 'oils': 14,
            'vinegars': 15, 'balsamic-vinegar': 15,
            
            # Prepared Foods
            'canned-soups': 245, 'instant-soups': 245, 'soups': 245, 'broths': 240,
            'frozen-meals': 280, 'ready-meals': 280, 'tv-dinners': 280,
            'frozen-pizza': 120, 'pizza': 120, 'calzones': 150,
            'sandwiches': 150, 'wraps': 150, 'burritos': 200,
            'prepared-salads': 85, 'salads': 85, 'coleslaw': 85,
            'deli-meats': 56, 'lunch-meats': 56, 'ham': 56, 'turkey-slices': 56,
            
            # Canned & Packaged
            'canned-beans': 130, 'beans': 130, 'lentils': 130, 'chickpeas': 130,
            'canned-tomatoes': 120, 'tomato-paste': 16, 'tomato-sauce': 60,
            'pickles': 30, 'olives': 15, 'capers': 5,
        }
        
        # Check categories with higher specificity first (longer strings first)
        for category, size in sorted(category_mappings.items(), key=lambda x: len(x[0]), reverse=True):
            if category in categories or category in product_name:
                return {
                    'serving_size': round(float(size), 1),
                    'confidence': 'medium',
                    'source': f'category_match_{category}',
                    'original_value': f'category: {category}',
                    'unit': 'g'
                }
        
        # Priority 7: Nutrition-based estimation
        energy_per_100g = nutriments.get('energy-kcal_100g', 0) or nutriments.get('energy_100g', 0)
        if energy_per_100g:
            try:
                energy = float(energy_per_100g)
                if energy > 500:  # High calorie density (nuts, oils, chocolate)
                    estimated_serving = 25
                elif energy > 350:  # Medium-high (baked goods, snacks)
                    estimated_serving = 35
                elif energy > 200:  # Medium (bread, pasta)
                    estimated_serving = 45
                elif energy > 100:  # Medium-low (fruits, some dairy)
                    estimated_serving = 80
                else:  # Low calorie (vegetables, diet drinks)
                    estimated_serving = 120
                    
                return {
                    'serving_size': round(float(estimated_serving), 1),
                    'confidence': 'low',
                    'source': f'nutrition_based_estimation_{energy}kcal',
                    'original_value': f'{energy} kcal/100g',
                    'unit': 'g'
                }
            except (ValueError, TypeError):
                pass
        
        # Final fallback
        return {
            'serving_size': 33.0,
            'confidence': 'very_low',
            'source': 'default_fallback',
            'original_value': 'no_data_available',
            'unit': 'g'
        }

    def evaluate_nutrient_level(self, key: str, value: float) -> str:
        """Evaluate nutrient level (excellent/good/fair/poor/terrible)"""
        if not value or key not in self.nutrition_thresholds:
            return 'unknown'
        
        thresholds = self.nutrition_thresholds[key]
        
        # For beneficial nutrients (higher is better)
        if key in ['fiber_100g', 'proteins_100g']:
            if value >= thresholds['excellent']:
                return 'excellent'
            elif value >= thresholds['good']:
                return 'good'
            elif value >= thresholds['fair']:
                return 'fair'
            elif value >= thresholds['poor']:
                return 'poor'
            else:
                return 'terrible'
        
        # For nutrients to limit (lower is better)
        else:
            if value <= thresholds['excellent']:
                return 'excellent'
            elif value <= thresholds['good']:
                return 'good'
            elif value <= thresholds['fair']:
                return 'fair'
            elif value <= thresholds['poor']:
                return 'poor'
            else:
                return 'terrible'

    def calculate_health_score(self, nutrients: Dict, ingredients_analysis: Dict) -> int:
        """Calculate balanced health score (0-100) - strict but fair"""
        base_score = 65  # Start with slightly positive score
        
        # Major negative factors (balanced penalties)
        
        # Calories (moderate penalty for high calorie foods)
        energy = nutrients.get('energy_kcal_100g', 0) or nutrients.get('energy_100g', 0)
        if energy:
            level = self.evaluate_nutrient_level('energy-kcal_100g', energy)
            if level == 'terrible': base_score -= 20
            elif level == 'poor': base_score -= 12
            elif level == 'fair': base_score -= 6
            elif level == 'good': base_score += 3
            elif level == 'excellent': base_score += 5
        
        # Sugar (strict but not excessive)
        sugar = nutrients.get('sugars_100g', 0)
        if sugar:
            level = self.evaluate_nutrient_level('sugars_100g', sugar)
            if level == 'terrible': base_score -= 25
            elif level == 'poor': base_score -= 18
            elif level == 'fair': base_score -= 10
            elif level == 'good': base_score += 3
            elif level == 'excellent': base_score += 5
        
        # Saturated fat (balanced penalties)
        sat_fat = nutrients.get('saturated_fat_100g', 0)
        if sat_fat:
            level = self.evaluate_nutrient_level('saturated-fat_100g', sat_fat)
            if level == 'terrible': base_score -= 18
            elif level == 'poor': base_score -= 12
            elif level == 'fair': base_score -= 6
            elif level == 'good': base_score += 3
            elif level == 'excellent': base_score += 5
        
        # Total fat (lighter penalties)
        fat = nutrients.get('fat_100g', 0)
        if fat:
            level = self.evaluate_nutrient_level('fat_100g', fat)
            if level == 'terrible': base_score -= 12
            elif level == 'poor': base_score -= 8
            elif level == 'fair': base_score -= 4
            elif level == 'good': base_score += 2
            elif level == 'excellent': base_score += 3
        
        # Sodium/Salt (balanced on sodium)
        sodium = nutrients.get('sodium_100g', 0) or (nutrients.get('salt_100g', 0) * 0.4 if nutrients.get('salt_100g') else 0)
        if sodium:
            level = self.evaluate_nutrient_level('sodium_100g', sodium)
            if level == 'terrible': base_score -= 18
            elif level == 'poor': base_score -= 12
            elif level == 'fair': base_score -= 6
            elif level == 'good': base_score += 3
            elif level == 'excellent': base_score += 5
        
        # Positive factors (enhanced rewards for good nutrients)
        
        # Fiber (better rewards for high fiber)
        fiber = nutrients.get('fiber_100g', 0)
        if fiber:
            level = self.evaluate_nutrient_level('fiber_100g', fiber)
            if level == 'excellent': base_score += 18
            elif level == 'good': base_score += 12
            elif level == 'fair': base_score += 6
            elif level == 'poor': base_score -= 3
            elif level == 'terrible': base_score -= 6
        
        # Protein (better rewards for high protein)
        protein = nutrients.get('proteins_100g', 0)
        if protein:
            level = self.evaluate_nutrient_level('proteins_100g', protein)
            if level == 'excellent': base_score += 15
            elif level == 'good': base_score += 10
            elif level == 'fair': base_score += 5
            elif level == 'poor': base_score -= 2
            elif level == 'terrible': base_score -= 4
        
        # Balanced penalties for additives
        additives = ingredients_analysis.get('additives', [])
        for additive in additives:
            if additive['risk_level'] == 'high':
                base_score -= 20
            elif additive['risk_level'] == 'medium':
                base_score -= 12
            else:
                base_score -= 6
        
        # Lighter penalties for processed food indicators
        quality_score = ingredients_analysis.get('quality_score', 100)
        if quality_score < 30:
            base_score -= 12
        elif quality_score < 50:
            base_score -= 8
        elif quality_score < 70:
            base_score -= 4
        
        # Bonus for very clean products (more generous)
        if not additives and quality_score > 80:
            base_score += 12
        elif not additives and quality_score > 60:
            base_score += 6
        
        # Additional bonus for natural, whole foods
        ingredient_count = ingredients_analysis.get('ingredient_count', 0)
        if ingredient_count <= 3 and not additives:
            base_score += 8
        elif ingredient_count <= 5 and len(additives) <= 1:
            base_score += 4
        
        # Ensure score is within bounds
        return max(0, min(100, base_score))

    def analyze_ingredients(self, ingredients_text: str) -> Dict:
        """Analyze ingredients for harmful additives and overall quality"""
        if not ingredients_text:
            return {'additives': [], 'quality_score': 50, 'warnings': [], 'ingredient_count': 0}
        
        ingredients_lower = ingredients_text.lower()
        found_additives = []
        warnings = []
        
        # Check for E-numbers and known additives
        for code, info in self.harmful_additives.items():
            if code.lower() in ingredients_lower or info['name'].lower() in ingredients_lower:
                found_additives.append({
                    'code': code,
                    'name': info['name'],
                    'risk_level': info['risk'],
                    'effects': info['effects']
                })
        
        # Check for problematic ingredients by keywords
        problematic_keywords = {
            'high fructose corn syrup': 'high',
            'corn syrup': 'medium',
            'partially hydrogenated': 'high',
            'trans fat': 'high',
            'artificial flavor': 'medium',
            'artificial flavour': 'medium',
            'artificial color': 'medium',
            'artificial colour': 'medium',
            'palm oil': 'medium',
            'modified corn starch': 'low',
            'maltodextrin': 'medium',
            'natural flavor': 'low',
            'caramel color': 'medium',
            'phosphoric acid': 'medium',
            'potassium sorbate': 'low',
            'sodium phosphate': 'medium'
        }
        
        for keyword, risk in problematic_keywords.items():
            if keyword in ingredients_lower:
                warnings.append(f"Contains {keyword}")
        
        # Calculate quality score based on findings
        quality_score = 100
        
        # Heavy penalties for additives
        for additive in found_additives:
            if additive['risk_level'] == 'high':
                quality_score -= 25
            elif additive['risk_level'] == 'medium':
                quality_score -= 15
            else:
                quality_score -= 8
        
        # Penalties for problematic ingredients
        quality_score -= len(warnings) * 8
        
        # Additional penalty for long ingredient lists
        ingredient_count = len([i.strip() for i in ingredients_text.split(',') if i.strip()])
        if ingredient_count > 15:
            quality_score -= 15
        elif ingredient_count > 10:
            quality_score -= 10
        elif ingredient_count > 5:
            quality_score -= 5
        
        # Bonus for very short, clean ingredient lists
        if ingredient_count <= 3 and not found_additives and not warnings:
            quality_score += 10
        
        quality_score = max(0, min(100, quality_score))
        
        return {
            'additives': found_additives,
            'quality_score': quality_score,
            'warnings': warnings,
            'ingredient_count': ingredient_count
        }

    def calculate_nutri_score(self, nutrients: Dict) -> Dict:
        """Calculate Nutri-Score based on nutritional values"""
        if not nutrients:
            return {'score': 'Unknown', 'points': 0, 'grade': 'Unknown'}
        
        # Extract nutrients (per 100g)
        energy = nutrients.get('energy_kcal_100g', 0) or nutrients.get('energy_100g', 0)
        sugars = nutrients.get('sugars_100g', 0)
        saturated_fat = nutrients.get('saturated_fat_100g', 0)
        sodium = nutrients.get('sodium_100g', 0)
        fiber = nutrients.get('fiber_100g', 0)
        protein = nutrients.get('proteins_100g', 0)
        fruits_vegetables = nutrients.get('fruits-vegetables-nuts_100g', 0)
        
        # Calculate negative points
        negative_points = 0
        
        # Energy points
        if energy > 3350: negative_points += 10
        elif energy > 3015: negative_points += 9
        elif energy > 2680: negative_points += 8
        elif energy > 2345: negative_points += 7
        elif energy > 2010: negative_points += 6
        elif energy > 1675: negative_points += 5
        elif energy > 1340: negative_points += 4
        elif energy > 1005: negative_points += 3
        elif energy > 670: negative_points += 2
        elif energy > 335: negative_points += 1
        
        # Sugar points
        if sugars > 45: negative_points += 10
        elif sugars > 40: negative_points += 9
        elif sugars > 36: negative_points += 8
        elif sugars > 31: negative_points += 7
        elif sugars > 27: negative_points += 6
        elif sugars > 22.5: negative_points += 5
        elif sugars > 18: negative_points += 4
        elif sugars > 13.5: negative_points += 3
        elif sugars > 9: negative_points += 2
        elif sugars > 4.5: negative_points += 1
        
        # Saturated fat points
        if saturated_fat > 10: negative_points += 10
        elif saturated_fat > 9: negative_points += 9
        elif saturated_fat > 8: negative_points += 8
        elif saturated_fat > 7: negative_points += 7
        elif saturated_fat > 6: negative_points += 6
        elif saturated_fat > 5: negative_points += 5
        elif saturated_fat > 4: negative_points += 4
        elif saturated_fat > 3: negative_points += 3
        elif saturated_fat > 2: negative_points += 2
        elif saturated_fat > 1: negative_points += 1
        
        # Sodium points
        sodium_mg = sodium * 1000 if sodium else 0
        if sodium_mg > 900: negative_points += 10
        elif sodium_mg > 810: negative_points += 9
        elif sodium_mg > 720: negative_points += 8
        elif sodium_mg > 630: negative_points += 7
        elif sodium_mg > 540: negative_points += 6
        elif sodium_mg > 450: negative_points += 5
        elif sodium_mg > 360: negative_points += 4
        elif sodium_mg > 270: negative_points += 3
        elif sodium_mg > 180: negative_points += 2
        elif sodium_mg > 90: negative_points += 1
        
        # Calculate positive points
        positive_points = 0
        
        # Fiber points
        if fiber > 4.7: positive_points += 5
        elif fiber > 3.7: positive_points += 4
        elif fiber > 2.8: positive_points += 3
        elif fiber > 1.9: positive_points += 2
        elif fiber > 0.9: positive_points += 1
        
        # Protein points
        if protein > 8: positive_points += 5
        elif protein > 6.4: positive_points += 4
        elif protein > 4.8: positive_points += 3
        elif protein > 3.2: positive_points += 2
        elif protein > 1.6: positive_points += 1
        
        # Fruits/vegetables points
        if fruits_vegetables > 80: positive_points += 5
        elif fruits_vegetables > 60: positive_points += 4
        elif fruits_vegetables > 40: positive_points += 2
        
        # Calculate final score
        final_score = negative_points - positive_points
        
        # Determine grade
        if final_score <= -1: grade = 'A'
        elif final_score <= 2: grade = 'B'
        elif final_score <= 10: grade = 'C'
        elif final_score <= 18: grade = 'D'
        else: grade = 'E'
        
        return {
            'score': final_score,
            'grade': grade,
            'negative_points': negative_points,
            'positive_points': positive_points
        }

    def get_health_recommendations(self, product_data: Dict, serving_size: float) -> List[str]:
        """Generate health recommendations based on product analysis"""
        recommendations = []
        
        nutrients = product_data.get('nutriments', {})
        health_score = product_data.get('health_score', 50)
        
        # Overall health assessment
        if health_score >= 80:
            recommendations.append("This product has excellent nutritional quality - enjoy in moderation")
        elif health_score >= 60:
            recommendations.append("This product has good nutritional quality")
        elif health_score >= 40:
            recommendations.append("This product should be consumed in moderation")
        else:
            recommendations.append("This product should be limited in your diet due to poor nutritional quality")
        
        # Specific nutrient warnings
        sugar = nutrients.get('sugars_100g', 0)
        if sugar and sugar > 22.5:
            recommendations.append("Very high sugar content - limit consumption and choose alternatives when possible")
        elif sugar and sugar > 12.5:
            recommendations.append("High sugar content - consume in small portions")
        
        # Sodium warnings
        sodium = nutrients.get('sodium_100g', 0) or (nutrients.get('salt_100g', 0) * 0.4 if nutrients.get('salt_100g') else 0)
        if sodium and sodium > 0.6:
            recommendations.append("High sodium content - may contribute to high blood pressure")
        elif sodium and sodium > 0.3:
            recommendations.append("Moderate sodium content - monitor your daily intake")
        
        # Saturated fat warnings
        sat_fat = nutrients.get('saturated_fat_100g', 0)
        if sat_fat and sat_fat > 5:
            recommendations.append("High saturated fat content - limit intake for heart health")
        elif sat_fat and sat_fat > 3:
            recommendations.append("Moderate saturated fat content - balance with healthier fats")
        
        # Calorie warnings per serving
        energy = nutrients.get('energy_kcal_100g', 0)
        if energy and serving_size:
            calories_per_serving = (energy * serving_size / 100)
            if calories_per_serving > 200:
                recommendations.append(f"High calorie density - {int(calories_per_serving)} calories per serving")
        
        # Additive warnings
        ingredients_analysis = product_data.get('ingredients_analysis', {})
        additives = ingredients_analysis.get('additives', [])
        high_risk_additives = [a for a in additives if a['risk_level'] == 'high']
        
        if high_risk_additives:
            recommendations.append("Contains high-risk additives - consider choosing products without these chemicals")
        elif len(additives) > 3:
            recommendations.append("Contains multiple additives - opt for less processed alternatives when possible")
        elif additives:
            recommendations.append("Contains food additives - check ingredient list for sensitivity")
        
        # Positive recommendations
        fiber = nutrients.get('fiber_100g', 0)
        if fiber and fiber > 6:
            recommendations.append("Excellent source of fiber - beneficial for digestive health")
        elif fiber and fiber > 3:
            recommendations.append("Good source of fiber - supports healthy digestion")
        
        protein = nutrients.get('proteins_100g', 0)
        if protein and protein > 15:
            recommendations.append("High protein content - excellent for muscle health and satiety")
        elif protein and protein > 8:
            recommendations.append("Good protein content - supports muscle maintenance")
        
        # Ultra-processed food warning
        ingredient_count = ingredients_analysis.get('ingredient_count', 0)
        if ingredient_count > 15:
            recommendations.append("This appears to be an ultra-processed food - limit consumption")
        
        return recommendations

# Initialize analyzer
analyzer = FoodHealthAnalyzer()

@food_scanner_bp.route('/product/<barcode>', methods=['GET'])
def get_product_info(barcode):
    """Get product information by barcode with bulletproof reliability"""
    try:
        # Validate barcode
        if not barcode or not barcode.isdigit():
            return jsonify({'error': 'Invalid barcode format'}), 400
        
        logger.info(f"Processing barcode: {barcode}")
        
        # Try to fetch product data from multiple APIs
        data = analyzer.fetch_product_data(barcode)
        
        if not data:
            # All APIs failed - return fallback data so app doesn't crash
            logger.warning(f"All APIs failed for {barcode}, returning fallback data")
            fallback = analyzer.create_fallback_product(barcode)
            return jsonify(fallback), 200  # Return 200 to prevent app crash
        
        product = data['product']
        
        # Get serving size from API data
        serving_info = analyzer.get_serving_size_from_api(product)
        serving_size = serving_info['serving_size']
        
        # Analyze ingredients
        ingredients_text = product.get('ingredients_text', '')
        ingredients_analysis = analyzer.analyze_ingredients(ingredients_text)
        
        # Calculate Nutri-Score
        nutri_score = analyzer.calculate_nutri_score(product.get('nutriments', {}))
        
        # Calculate health score
        health_score = analyzer.calculate_health_score(
            product.get('nutriments', {}),
            ingredients_analysis
        )
        
        # Clean and normalize nutrient data for frontend
        clean_nutrients = {}
        nutriment_mapping = {
            'energy-kcal_100g': 'energy_kcal_100g',
            'saturated-fat_100g': 'saturated_fat_100g'
        }
        
        # Process all nutrient fields and ensure they're properly formatted
        for key, value in product.get('nutriments', {}).items():
            clean_key = nutriment_mapping.get(key, key)
            
            if clean_key in ['energy_kcal_100g', 'fat_100g', 'saturated_fat_100g', 'carbohydrates_100g',
                            'sugars_100g', 'fiber_100g', 'proteins_100g', 'salt_100g', 'sodium_100g']:
                try:
                    clean_nutrients[clean_key] = float(value) if value is not None else None
                except (ValueError, TypeError):
                    clean_nutrients[clean_key] = None
        
        # Ensure sodium is available (convert from salt if needed)
        if not clean_nutrients.get('sodium_100g') and clean_nutrients.get('salt_100g'):
            clean_nutrients['sodium_100g'] = clean_nutrients['salt_100g'] * 0.4
        
        # Generate recommendations
        enhanced_product_data = {
            'nutriments': clean_nutrients,
            'nutri_score': nutri_score,
            'ingredients_analysis': ingredients_analysis,
            'health_score': health_score
        }
        recommendations = analyzer.get_health_recommendations(enhanced_product_data, serving_size)
        
        # Prepare final response
        result = {
            'barcode': barcode,
            'product_name': product.get('product_name', 'Unknown Product'),
            'brands': product.get('brands', ''),
            'categories': product.get('categories', ''),
            'ingredients_text': ingredients_text,
            'image_url': product.get('image_url', ''),
            
            # Serving size information
            'serving_size': serving_size,
            'serving_info': serving_info,
            
            'nutri_score': nutri_score,
            'ingredients_analysis': ingredients_analysis,
            'nutriments': clean_nutrients,
            'health_score': health_score,
            'recommendations': recommendations,
            'quality_indicators': {
                'is_ultra_processed': ingredients_analysis.get('ingredient_count', 0) > 10,
                'has_high_risk_additives': len([a for a in ingredients_analysis.get('additives', []) if a['risk_level'] == 'high']) > 0,
                'additive_count': len(ingredients_analysis.get('additives', [])),
                'overall_quality': 'excellent' if health_score >= 80 else 'good' if health_score >= 60 else 'fair' if health_score >= 40 else 'poor'
            },
            'api_status': 'success',
            'data_source': product.get('_source', 'openfoodfacts')
        }
        
        logger.info(f"Successfully processed: {barcode} from {result.get('data_source', 'unknown')}")
        return jsonify(result)
        
    except Exception as e:
        # Catch any other errors
        logger.error(f"Unexpected error for {barcode}: {e}")
        fallback = analyzer.create_fallback_product(barcode)
        fallback['error_details'] = str(e)
        return jsonify(fallback), 200

@food_scanner_bp.route('/search/<query>', methods=['GET'])
def search_products(query):
    """Search for products by name with enhanced reliability"""
    try:
        # Try OpenFoodFacts search first
        url = f"https://world.openfoodfacts.org/cgi/search.pl"
        params = {
            'search_terms': query,
            'search_simple': 1,
            'action': 'process',
            'json': 1,
            'page_size': 20
        }
        
        headers = {
            'User-Agent': 'PlateMate-FoodScanner/1.0 (platemate-app@example.com)',
            'Accept': 'application/json',
            'Connection': 'close'
        }
        
        response = requests.get(url, params=params, headers=headers, timeout=(3, 6))
        response.raise_for_status()
        
        data = response.json()
        products = []
        
        for product in data.get('products', []):
            # Quick health assessment for search results
            quick_score = 50
            
            # Quick penalties for obvious bad indicators
            sugars = product.get('nutriments', {}).get('sugars_100g', 0)
            if sugars and sugars > 25:
                quick_score -= 30
            elif sugars and sugars > 15:
                quick_score -= 20
            
            sodium = product.get('nutriments', {}).get('sodium_100g', 0)
            if sodium and sodium > 0.6:
                quick_score -= 20
            
            # Quick bonus for good indicators
            fiber = product.get('nutriments', {}).get('fiber_100g', 0)
            if fiber and fiber > 5:
                quick_score += 15
            
            protein = product.get('nutriments', {}).get('proteins_100g', 0)
            if protein and protein > 10:
                quick_score += 10
            
            quick_score = max(0, min(100, quick_score))
            
            products.append({
                'barcode': product.get('code', ''),
                'product_name': product.get('product_name', 'Unknown'),
                'brands': product.get('brands', ''),
                'image_url': product.get('image_url', ''),
                'nutriscore_grade': product.get('nutriscore_grade', '').upper(),
                'quick_health_score': quick_score
            })
        
        # Sort by health score (best first)
        products.sort(key=lambda x: x['quick_health_score'], reverse=True)
        
        return jsonify({'products': products})
    
    except Exception as e:
        logger.error(f"Search error: {e}")
        return jsonify({
            'products': [],
            'error': 'Search temporarily unavailable',
            'message': 'Please try again or scan a barcode directly'
        }), 200

@food_scanner_bp.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint for food scanner"""
    return jsonify({
        'status': 'healthy',
        'message': 'Bulletproof Food Scanner API with Multiple Data Sources',
        'version': '4.0',
        'features': [
            'Multiple OpenFoodFacts server endpoints',
            'UPC Database backup API',
            'Ultra-short timeouts for fast failover',
            'Graceful degradation with fallback data',
            'Always returns 200 to prevent app crashes',
            'Comprehensive health scoring',
            'Enhanced additive detection'
        ],
        'data_sources': [
            'OpenFoodFacts (primary - nutritional data)',
            'UPC Database (backup - basic product info)',
            'Fallback system (ensures app never crashes)'
        ]
    })

@food_scanner_bp.route('/test-connectivity', methods=['GET'])
def test_connectivity():
    """Test endpoint to check all API connectivity"""
    test_barcode = "051500255650"  # Your problematic barcode
    results = {}
    
    # Test OpenFoodFacts endpoints
    for i, endpoint_template in enumerate(analyzer.openfoodfacts_endpoints):
        url = endpoint_template.format(test_barcode)
        endpoint_name = f"openfoodfacts_{i+1}"
        
        try:
            start_time = time.time()
            response = requests.get(url, timeout=(3, 5), headers={
                'User-Agent': 'PlateMate-FoodScanner/1.0 (platemate-app@example.com)'
            })
            end_time = time.time()
            
            results[endpoint_name] = {
                'url': url,
                'status_code': response.status_code,
                'response_time_ms': round((end_time - start_time) * 1000),
                'success': response.status_code == 200,
                'has_data': False
            }
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    results[endpoint_name]['has_data'] = data.get('status') == 1
                except:
                    pass
                    
        except Exception as e:
            results[endpoint_name] = {
                'url': url,
                'error': str(e),
                'success': False,
                'has_data': False
            }
    
    # Test UPC Database
    try:
        start_time = time.time()
        response = requests.get(f"https://api.upcitemdb.com/prod/trial/lookup?upc={test_barcode}",
                              timeout=(3, 5))
        end_time = time.time()
        
        results['upc_database'] = {
            'url': f"https://api.upcitemdb.com/prod/trial/lookup?upc={test_barcode}",
            'status_code': response.status_code,
            'response_time_ms': round((end_time - start_time) * 1000),
            'success': response.status_code == 200,
            'has_data': False
        }
        
        if response.status_code == 200:
            try:
                data = response.json()
                results['upc_database']['has_data'] = data.get('code') == 'OK' and bool(data.get('items'))
            except:
                pass
                
    except Exception as e:
        results['upc_database'] = {
            'url': f"https://api.upcitemdb.com/prod/trial/lookup?upc={test_barcode}",
            'error': str(e),
            'success': False,
            'has_data': False
        }
    
    # Summary
    successful_endpoints = sum(1 for r in results.values() if r.get('success'))
    total_endpoints = len(results)
    
    return jsonify({
        'test_barcode': test_barcode,
        'timestamp': time.time(),
        'endpoint_results': results,
        'summary': {
            'total_endpoints': total_endpoints,
            'successful_endpoints': successful_endpoints,
            'success_rate': f"{(successful_endpoints/total_endpoints)*100:.1f}%",
            'overall_status': 'healthy' if successful_endpoints > 0 else 'degraded'
        }
    })

def init_food_scanner_routes(app):
    """Initialize food scanner routes"""
    app.register_blueprint(food_scanner_bp, url_prefix='/api/food-scanner')
