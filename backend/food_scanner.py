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
        # Harmful additives database with risk levels
        self.harmful_additives = {
            # Preservatives
            'E210': {'name': 'Benzoic acid', 'risk': 'medium', 'effects': ['allergies', 'hyperactivity']},
            'E211': {'name': 'Sodium benzoate', 'risk': 'medium', 'effects': ['hyperactivity', 'allergies']},
            'E220': {'name': 'Sulfur dioxide', 'risk': 'high', 'effects': ['respiratory issues', 'allergies']},
            'E249': {'name': 'Potassium nitrite', 'risk': 'high', 'effects': ['cancer risk', 'blood issues']},
            'E250': {'name': 'Sodium nitrite', 'risk': 'high', 'effects': ['cancer risk', 'blood issues']},
            
            # Artificial colors
            'E102': {'name': 'Tartrazine', 'risk': 'medium', 'effects': ['hyperactivity', 'allergies']},
            'E110': {'name': 'Sunset Yellow', 'risk': 'medium', 'effects': ['hyperactivity', 'allergies']},
            'E129': {'name': 'Allura Red', 'risk': 'medium', 'effects': ['hyperactivity', 'cancer risk']},
            'E133': {'name': 'Brilliant Blue', 'risk': 'low', 'effects': ['allergies']},
            
            # Sweeteners
            'E950': {'name': 'Acesulfame K', 'risk': 'medium', 'effects': ['cancer risk']},
            'E951': {'name': 'Aspartame', 'risk': 'medium', 'effects': ['headaches', 'neurological issues']},
            'E952': {'name': 'Cyclamate', 'risk': 'high', 'effects': ['cancer risk']},
            
            # Flavor enhancers
            'E621': {'name': 'MSG', 'risk': 'low', 'effects': ['headaches', 'nausea']},
            'E635': {'name': 'Disodium ribonucleotides', 'risk': 'low', 'effects': ['allergies']},
            
            # Emulsifiers
            'E433': {'name': 'Polysorbate 80', 'risk': 'medium', 'effects': ['digestive issues', 'inflammation']},
            'E471': {'name': 'Mono- and diglycerides', 'risk': 'low', 'effects': ['trans fats']},
        }
        
        # Nutritional thresholds for scoring
        self.nutrition_thresholds = {
            'fat': {'low': 3, 'medium': 17.5, 'high': 20},
            'saturated_fat': {'low': 1.5, 'medium': 5, 'high': 6},
            'sugar': {'low': 5, 'medium': 22.5, 'high': 27},
            'salt': {'low': 0.3, 'medium': 1.5, 'high': 2},
            'fiber': {'low': 3, 'medium': 6, 'high': 10},
            'protein': {'low': 5, 'medium': 10, 'high': 20}
        }

    def analyze_ingredients(self, ingredients_text: str) -> Dict:
        """Analyze ingredients for harmful additives and overall quality"""
        if not ingredients_text:
            return {'additives': [], 'quality_score': 50, 'warnings': []}
        
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
            'partially hydrogenated': 'high',
            'trans fat': 'high',
            'artificial flavor': 'medium',
            'artificial color': 'medium',
            'palm oil': 'medium',
            'corn syrup': 'medium'
        }
        
        for keyword, risk in problematic_keywords.items():
            if keyword in ingredients_lower:
                warnings.append(f"Contains {keyword}")
        
        # Calculate quality score based on findings
        quality_score = 100
        for additive in found_additives:
            if additive['risk_level'] == 'high':
                quality_score -= 20
            elif additive['risk_level'] == 'medium':
                quality_score -= 10
            else:
                quality_score -= 5
        
        quality_score -= len(warnings) * 5
        quality_score = max(0, min(100, quality_score))
        
        return {
            'additives': found_additives,
            'quality_score': quality_score,
            'warnings': warnings
        }

    def calculate_nutri_score(self, nutrients: Dict) -> Dict:
        """Calculate Nutri-Score based on nutritional values"""
        if not nutrients:
            return {'score': 'Unknown', 'points': 0, 'grade': 'Unknown'}
        
        # Extract nutrients (per 100g)
        energy = nutrients.get('energy-kcal_100g', 0) or nutrients.get('energy_100g', 0)
        sugars = nutrients.get('sugars_100g', 0)
        saturated_fat = nutrients.get('saturated-fat_100g', 0)
        sodium = nutrients.get('sodium_100g', 0)
        fiber = nutrients.get('fiber_100g', 0)
        protein = nutrients.get('proteins_100g', 0)
        fruits_vegetables = nutrients.get('fruits-vegetables-nuts_100g', 0)
        
        # Calculate negative points
        negative_points = 0
        
        # Energy points
        if energy > 3350:
            negative_points += 10
        elif energy > 3015:
            negative_points += 9
        elif energy > 2680:
            negative_points += 8
        elif energy > 2345:
            negative_points += 7
        elif energy > 2010:
            negative_points += 6
        elif energy > 1675:
            negative_points += 5
        elif energy > 1340:
            negative_points += 4
        elif energy > 1005:
            negative_points += 3
        elif energy > 670:
            negative_points += 2
        elif energy > 335:
            negative_points += 1
        
        # Sugar points
        if sugars > 45:
            negative_points += 10
        elif sugars > 40:
            negative_points += 9
        elif sugars > 36:
            negative_points += 8
        elif sugars > 31:
            negative_points += 7
        elif sugars > 27:
            negative_points += 6
        elif sugars > 22.5:
            negative_points += 5
        elif sugars > 18:
            negative_points += 4
        elif sugars > 13.5:
            negative_points += 3
        elif sugars > 9:
            negative_points += 2
        elif sugars > 4.5:
            negative_points += 1
        
        # Saturated fat points
        if saturated_fat > 10:
            negative_points += 10
        elif saturated_fat > 9:
            negative_points += 9
        elif saturated_fat > 8:
            negative_points += 8
        elif saturated_fat > 7:
            negative_points += 7
        elif saturated_fat > 6:
            negative_points += 6
        elif saturated_fat > 5:
            negative_points += 5
        elif saturated_fat > 4:
            negative_points += 4
        elif saturated_fat > 3:
            negative_points += 3
        elif saturated_fat > 2:
            negative_points += 2
        elif saturated_fat > 1:
            negative_points += 1
        
        # Sodium points (convert to mg)
        sodium_mg = sodium * 1000 if sodium else 0
        if sodium_mg > 900:
            negative_points += 10
        elif sodium_mg > 810:
            negative_points += 9
        elif sodium_mg > 720:
            negative_points += 8
        elif sodium_mg > 630:
            negative_points += 7
        elif sodium_mg > 540:
            negative_points += 6
        elif sodium_mg > 450:
            negative_points += 5
        elif sodium_mg > 360:
            negative_points += 4
        elif sodium_mg > 270:
            negative_points += 3
        elif sodium_mg > 180:
            negative_points += 2
        elif sodium_mg > 90:
            negative_points += 1
        
        # Calculate positive points
        positive_points = 0
        
        # Fiber points
        if fiber > 4.7:
            positive_points += 5
        elif fiber > 3.7:
            positive_points += 4
        elif fiber > 2.8:
            positive_points += 3
        elif fiber > 1.9:
            positive_points += 2
        elif fiber > 0.9:
            positive_points += 1
        
        # Protein points
        if protein > 8:
            positive_points += 5
        elif protein > 6.4:
            positive_points += 4
        elif protein > 4.8:
            positive_points += 3
        elif protein > 3.2:
            positive_points += 2
        elif protein > 1.6:
            positive_points += 1
        
        # Fruits/vegetables points
        if fruits_vegetables > 80:
            positive_points += 5
        elif fruits_vegetables > 60:
            positive_points += 4
        elif fruits_vegetables > 40:
            positive_points += 2
        
        # Calculate final score
        final_score = negative_points - positive_points
        
        # Determine grade
        if final_score <= -1:
            grade = 'A'
        elif final_score <= 2:
            grade = 'B'
        elif final_score <= 10:
            grade = 'C'
        elif final_score <= 18:
            grade = 'D'
        else:
            grade = 'E'
        
        return {
            'score': final_score,
            'grade': grade,
            'negative_points': negative_points,
            'positive_points': positive_points
        }

    def get_health_recommendations(self, product_data: Dict) -> List[str]:
        """Generate health recommendations based on product analysis"""
        recommendations = []
        
        nutrients = product_data.get('nutriments', {})
        nutri_score = product_data.get('nutri_score', {})
        
        # Based on Nutri-Score
        if nutri_score.get('grade') in ['D', 'E']:
            recommendations.append("Consider consuming this product in moderation due to poor nutritional quality")
        
        # High sugar warning
        sugar = nutrients.get('sugars_100g', 0)
        if sugar > 15:
            recommendations.append("High sugar content - limit consumption, especially for children")
        
        # High sodium warning
        sodium = nutrients.get('sodium_100g', 0)
        if sodium > 1.5:
            recommendations.append("High sodium content - may contribute to high blood pressure")
        
        # High saturated fat warning
        sat_fat = nutrients.get('saturated-fat_100g', 0)
        if sat_fat > 5:
            recommendations.append("High saturated fat content - limit intake for heart health")
        
        # Additive warnings
        ingredients_analysis = product_data.get('ingredients_analysis', {})
        if ingredients_analysis.get('additives'):
            high_risk_additives = [a for a in ingredients_analysis['additives'] if a['risk_level'] == 'high']
            if high_risk_additives:
                recommendations.append("Contains potentially harmful additives - consider alternatives")
        
        # Positive recommendations
        fiber = nutrients.get('fiber_100g', 0)
        if fiber > 6:
            recommendations.append("Good source of fiber - beneficial for digestive health")
        
        protein = nutrients.get('proteins_100g', 0)
        if protein > 10:
            recommendations.append("Good protein content - supports muscle health")
        
        if not recommendations:
            recommendations.append("This product appears to have a reasonable nutritional profile")
        
        return recommendations

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
            'User-Agent': 'FoodScanner/1.0 (your-email@example.com)'
        }
        
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        
        data = response.json()
        
        if data.get('status') != 1:
            return jsonify({'error': 'Product not found'}), 404
        
        product = data['product']
        
        # Analyze ingredients
        ingredients_text = product.get('ingredients_text', '')
        ingredients_analysis = analyzer.analyze_ingredients(ingredients_text)
        
        # Calculate Nutri-Score
        nutri_score = analyzer.calculate_nutri_score(product.get('nutriments', {}))
        
        # Prepare response data
        result = {
            'barcode': barcode,
            'product_name': product.get('product_name', 'Unknown Product'),
            'brands': product.get('brands', ''),
            'categories': product.get('categories', ''),
            'ingredients_text': ingredients_text,
            'image_url': product.get('image_url', ''),
            'nutri_score': nutri_score,
            'ingredients_analysis': ingredients_analysis,
            'nutriments': {
                'energy_kcal_100g': product.get('nutriments', {}).get('energy-kcal_100g'),
                'fat_100g': product.get('nutriments', {}).get('fat_100g'),
                'saturated_fat_100g': product.get('nutriments', {}).get('saturated-fat_100g'),
                'carbohydrates_100g': product.get('nutriments', {}).get('carbohydrates_100g'),
                'sugars_100g': product.get('nutriments', {}).get('sugars_100g'),
                'fiber_100g': product.get('nutriments', {}).get('fiber_100g'),
                'proteins_100g': product.get('nutriments', {}).get('proteins_100g'),
                'salt_100g': product.get('nutriments', {}).get('salt_100g'),
                'sodium_100g': product.get('nutriments', {}).get('sodium_100g'),
            },
            'health_score': max(
                ingredients_analysis.get('quality_score', 50),
                (100 - (nutri_score.get('score', 0) * 5)) if nutri_score.get('score', 0) > 0 else 75
            ),
            'recommendations': analyzer.get_health_recommendations({
                'nutriments': product.get('nutriments', {}),
                'nutri_score': nutri_score,
                'ingredients_analysis': ingredients_analysis
            })
        }
        
        return jsonify(result)
    
    except requests.exceptions.RequestException as e:
        logger.error(f"API request failed: {e}")
        return jsonify({'error': 'Failed to fetch product data'}), 500
    
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@food_scanner_bp.route('/search/<query>', methods=['GET'])
def search_products(query):
    """Search for products by name"""
    try:
        url = f"https://world.openfoodfacts.org/cgi/search.pl"
        params = {
            'search_terms': query,
            'search_simple': 1,
            'action': 'process',
            'json': 1,
            'page_size': 20
        }
        
        headers = {
            'User-Agent': 'FoodScanner/1.0 (your-email@example.com)'
        }
        
        response = requests.get(url, params=params, headers=headers, timeout=10)
        response.raise_for_status()
        
        data = response.json()
        products = []
        
        for product in data.get('products', []):
            products.append({
                'barcode': product.get('code', ''),
                'product_name': product.get('product_name', 'Unknown'),
                'brands': product.get('brands', ''),
                'image_url': product.get('image_url', ''),
                'nutriscore_grade': product.get('nutriscore_grade', '').upper()
            })
        
        return jsonify({'products': products})
    
    except Exception as e:
        logger.error(f"Search error: {e}")
        return jsonify({'error': 'Search failed'}), 500

@food_scanner_bp.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint for food scanner"""
    return jsonify({'status': 'healthy', 'message': 'Food Scanner API is running'})

def init_food_scanner_routes(app):
    """Initialize food scanner routes"""
    app.register_blueprint(food_scanner_bp, url_prefix='/api/food-scanner')
