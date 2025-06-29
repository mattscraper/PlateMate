from flask import Blueprint, request, jsonify
import requests
import re
from typing import Dict, List, Optional
import logging

# Configure logging
logger = logging.getLogger(__name__)

# Create blueprint for food scanner routes
food_scanner_bp = Blueprint('food_scanner', __name__)

class FoodHealthAnalyzer:
    def __init__(self):
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
        
        # FIXED: Use underscore format consistently for frontend compatibility
        self.nutrition_thresholds = {
            # Nutrients to limit (negative impact)
            'energy_kcal_100g': {
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
            'saturated_fat_100g': {
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
        """Extract serving size from OpenFoodFacts API"""
        
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
        
        # Priority 2: Check serving_quantity field
        serving_quantity = product.get('serving_quantity')
        if serving_quantity:
            try:
                value = float(serving_quantity)
                if 1 <= value <= 1000:
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
        """Calculate balanced health score (0-100)"""
        base_score = 65  # Start with slightly positive score
        
        # Helper function to get nutrient value with fallback for both formats
        def get_nutrient_value(underscore_key, hyphen_key=None):
            value = nutrients.get(underscore_key, 0)
            if not value and hyphen_key:
                value = nutrients.get(hyphen_key, 0)
            return value
        
        # Calories (try both formats)
        energy = get_nutrient_value('energy_kcal_100g', 'energy-kcal_100g') or get_nutrient_value('energy_100g')
        if energy:
            level = self.evaluate_nutrient_level('energy_kcal_100g', energy)
            if level == 'terrible': base_score -= 20
            elif level == 'poor': base_score -= 12
            elif level == 'fair': base_score -= 6
            elif level == 'good': base_score += 3
            elif level == 'excellent': base_score += 5
        
        # Sugar
        sugar = get_nutrient_value('sugars_100g')
        if sugar:
            level = self.evaluate_nutrient_level('sugars_100g', sugar)
            if level == 'terrible': base_score -= 25
            elif level == 'poor': base_score -= 18
            elif level == 'fair': base_score -= 10
            elif level == 'good': base_score += 3
            elif level == 'excellent': base_score += 5
        
        # Saturated fat (try both formats)
        sat_fat = get_nutrient_value('saturated_fat_100g', 'saturated-fat_100g')
        if sat_fat:
            level = self.evaluate_nutrient_level('saturated_fat_100g', sat_fat)
            if level == 'terrible': base_score -= 18
            elif level == 'poor': base_score -= 12
            elif level == 'fair': base_score -= 6
            elif level == 'good': base_score += 3
            elif level == 'excellent': base_score += 5
        
        # Total fat
        fat = get_nutrient_value('fat_100g')
        if fat:
            level = self.evaluate_nutrient_level('fat_100g', fat)
            if level == 'terrible': base_score -= 12
            elif level == 'poor': base_score -= 8
            elif level == 'fair': base_score -= 4
            elif level == 'good': base_score += 2
            elif level == 'excellent': base_score += 3
        
        # Sodium/Salt
        sodium = get_nutrient_value('sodium_100g') or (get_nutrient_value('salt_100g') * 0.4 if get_nutrient_value('salt_100g') else 0)
        if sodium:
            level = self.evaluate_nutrient_level('sodium_100g', sodium)
            if level == 'terrible': base_score -= 18
            elif level == 'poor': base_score -= 12
            elif level == 'fair': base_score -= 6
            elif level == 'good': base_score += 3
            elif level == 'excellent': base_score += 5
        
        # Fiber
        fiber = get_nutrient_value('fiber_100g')
        if fiber:
            level = self.evaluate_nutrient_level('fiber_100g', fiber)
            if level == 'excellent': base_score += 18
            elif level == 'good': base_score += 12
            elif level == 'fair': base_score += 6
            elif level == 'poor': base_score -= 3
            elif level == 'terrible': base_score -= 6
        
        # Protein
        protein = get_nutrient_value('proteins_100g')
        if protein:
            level = self.evaluate_nutrient_level('proteins_100g', protein)
            if level == 'excellent': base_score += 15
            elif level == 'good': base_score += 10
            elif level == 'fair': base_score += 5
            elif level == 'poor': base_score -= 2
            elif level == 'terrible': base_score -= 4
        
        # Penalties for additives
        additives = ingredients_analysis.get('additives', [])
        for additive in additives:
            if additive['risk_level'] == 'high':
                base_score -= 20
            elif additive['risk_level'] == 'medium':
                base_score -= 12
            else:
                base_score -= 6
        
        # Quality bonuses
        quality_score = ingredients_analysis.get('quality_score', 100)
        if quality_score < 30:
            base_score -= 12
        elif quality_score < 50:
            base_score -= 8
        elif quality_score < 70:
            base_score -= 4
        
        if not additives and quality_score > 80:
            base_score += 12
        elif not additives and quality_score > 60:
            base_score += 6
        
        ingredient_count = ingredients_analysis.get('ingredient_count', 0)
        if ingredient_count <= 3 and not additives:
            base_score += 8
        elif ingredient_count <= 5 and len(additives) <= 1:
            base_score += 4
        
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
        
        # Calculate quality score
        quality_score = 100
        
        # Penalties for additives
        for additive in found_additives:
            if additive['risk_level'] == 'high':
                quality_score -= 25
            elif additive['risk_level'] == 'medium':
                quality_score -= 15
            else:
                quality_score -= 8
        
        # Additional penalty for long ingredient lists
        ingredient_count = len([i.strip() for i in ingredients_text.split(',') if i.strip()])
        if ingredient_count > 15:
            quality_score -= 15
        elif ingredient_count > 10:
            quality_score -= 10
        elif ingredient_count > 5:
            quality_score -= 5
        
        # Bonus for very short, clean ingredient lists
        if ingredient_count <= 3 and not found_additives:
            quality_score += 10
        
        quality_score = max(0, min(100, quality_score))
        
        return {
            'additives': found_additives,
            'quality_score': quality_score,
            'warnings': warnings,
            'ingredient_count': ingredient_count
        }

# Initialize analyzer
analyzer = FoodHealthAnalyzer()

@food_scanner_bp.route('/product/<barcode>', methods=['GET'])
def get_product_info(barcode):
    """Get product information by barcode"""
    try:
        # Validate barcode
        if not barcode or not barcode.isdigit():
            return jsonify({'error': 'Invalid barcode format'}), 400
        
        # Query OpenFoodFacts API
        url = f"https://world.openfoodfacts.org/api/v0/product/{barcode}.json"
        headers = {
            'User-Agent': 'PlateMate-FoodScanner/1.0 (platemate-app@example.com)'
        }
        
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        
        data = response.json()
        
        if data.get('status') != 1:
            return jsonify({'error': 'Product not found'}), 404
        
        product = data['product']
        
        # Get serving size
        serving_info = analyzer.get_serving_size_from_api(product)
        serving_size = serving_info['serving_size']
        
        # Analyze ingredients
        ingredients_text = product.get('ingredients_text', '')
        ingredients_analysis = analyzer.analyze_ingredients(ingredients_text)
        
        # FIXED: Clean and normalize nutrient data using UNDERSCORE format for frontend
        clean_nutrients = {}
        
        # Mapping from API field names (both formats) to frontend expected format
        field_mappings = {
            'energy-kcal_100g': 'energy_kcal_100g',
            'energy_kcal_100g': 'energy_kcal_100g',
            'energy_100g': 'energy_100g',
            'saturated-fat_100g': 'saturated_fat_100g',
            'saturated_fat_100g': 'saturated_fat_100g',
            'fat_100g': 'fat_100g',
            'carbohydrates_100g': 'carbohydrates_100g',
            'sugars_100g': 'sugars_100g',
            'fiber_100g': 'fiber_100g',
            'proteins_100g': 'proteins_100g',
            'salt_100g': 'salt_100g',
            'sodium_100g': 'sodium_100g'
        }
        
        # Process all nutrient fields
        for api_key, frontend_key in field_mappings.items():
            value = product.get('nutriments', {}).get(api_key)
            if value is not None:
                try:
                    clean_nutrients[frontend_key] = float(value)
                except (ValueError, TypeError):
                    clean_nutrients[frontend_key] = None
        
        # Ensure sodium is available (convert from salt if needed)
        if not clean_nutrients.get('sodium_100g') and clean_nutrients.get('salt_100g'):
            clean_nutrients['sodium_100g'] = clean_nutrients['salt_100g'] * 0.4
        
        # Ensure we have energy_kcal_100g if we only have energy_100g
        if not clean_nutrients.get('energy_kcal_100g') and clean_nutrients.get('energy_100g'):
            energy_kj = clean_nutrients['energy_100g']
            if energy_kj > 1000:  # Likely in kJ
                clean_nutrients['energy_kcal_100g'] = energy_kj / 4.184
            else:  # Already in kcal
                clean_nutrients['energy_kcal_100g'] = energy_kj
        
        # Calculate health score
        health_score = analyzer.calculate_health_score(clean_nutrients, ingredients_analysis)
        
        # Prepare final response
        result = {
            'barcode': barcode,
            'product_name': product.get('product_name', 'Unknown Product'),
            'brands': product.get('brands', ''),
            'categories': product.get('categories', ''),
            'ingredients_text': ingredients_text,
            'image_url': product.get('image_url', ''),
            'serving_size': serving_size,
            'serving_info': serving_info,
            'ingredients_analysis': ingredients_analysis,
            'nutriments': clean_nutrients,
            'health_score': health_score,
            'quality_indicators': {
                'is_ultra_processed': ingredients_analysis.get('ingredient_count', 0) > 10,
                'has_high_risk_additives': len([a for a in ingredients_analysis.get('additives', []) if a['risk_level'] == 'high']) > 0,
                'additive_count': len(ingredients_analysis.get('additives', [])),
                'overall_quality': 'excellent' if health_score >= 80 else 'good' if health_score >= 60 else 'fair' if health_score >= 40 else 'poor'
            }
        }
        
        return jsonify(result)
    
    except requests.exceptions.RequestException as e:
        logger.error(f"API request failed: {e}")
        return jsonify({'error': 'Failed to fetch product data'}), 500
    
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@food_scanner_bp.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint for food scanner"""
    return jsonify({
        'status': 'healthy',
        'message': 'Fixed Food Scanner API',
        'version': '4.0'
    })

def init_food_scanner_routes(app):
    """Initialize food scanner routes"""
    app.register_blueprint(food_scanner_bp, url_prefix='/api/food-scanner')
