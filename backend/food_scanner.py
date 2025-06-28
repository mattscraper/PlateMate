from flask import Blueprint, request, jsonify
import requests
import re
import logging
from typing import Dict, List, Optional, Tuple
from difflib import SequenceMatcher

# Configure logging
logger = logging.getLogger(__name__)

# Create blueprint for food scanner routes
food_scanner_bp = Blueprint('food_scanner', __name__)

class ImprovedFoodAnalyzer:
    def __init__(self):
        # Realistic serving sizes based on actual nutrition labels (in grams)
        self.serving_size_database = {
            # Beverages (ml ≈ grams for most liquids)
            'beverages': 240,
            'soft-drinks': 355,  # 12 fl oz can
            'energy-drinks': 240,  # 8 fl oz serving (not full can)
            'sports-drinks': 240,
            'fruit-juices': 240,  # 8 fl oz
            'milk': 240,
            'coffee': 240,
            'tea': 240,
            'water': 240,
            'soda': 355,
            
            # Snacks - realistic single serving portions
            'potato-chips': 28,  # 1 oz
            'tortilla-chips': 28,
            'crackers': 16,  # varies by type
            'pretzels': 28,
            'popcorn': 32,  # 3.5 cups popped
            'cookies': 30,  # 2-3 cookies
            'candy': 40,
            'chocolate': 40,
            'nuts': 28,  # 1 oz
            'granola-bars': 40,
            'protein-bars': 60,
            
            # Dairy
            'yogurt': 170,  # 6 oz container
            'cheese': 28,   # 1 oz
            'ice-cream': 66,  # 1/2 cup
            'milk': 240,
            
            # Breakfast items
            'breakfast-cereals': 30,  # dry weight
            'cereal': 30,
            'oatmeal': 40,  # dry weight
            'granola': 60,  # denser than regular cereal
            
            # Breads & grains
            'bread': 28,    # 1 slice
            'bagels': 85,   # 1 medium bagel
            'muffins': 55,  # 1 medium muffin
            'pasta': 56,    # 2 oz dry
            'rice': 45,     # 1/4 cup dry
            
            # Condiments & spreads
            'peanut-butter': 32,  # 2 tbsp
            'almond-butter': 32,
            'jam': 20,      # 1 tbsp
            'jelly': 20,
            'honey': 21,    # 1 tbsp
            'mayonnaise': 13,  # 1 tbsp
            'ketchup': 17,  # 1 tbsp
            'mustard': 5,   # 1 tsp
            'salad-dressing': 30,  # 2 tbsp
            
            # Prepared foods
            'soup': 245,    # 1 cup
            'frozen-meals': 280,  # average frozen dinner
            'pizza': 107,   # 1 slice
            'sandwich': 150,
        }
        
        # Stricter health scoring criteria based on per-serving amounts
        self.health_criteria = {
            'calories': {
                'excellent': 80, 'good': 120, 'fair': 200, 'poor': 300, 'terrible': 400
            },
            'sugar_grams': {
                'excellent': 2, 'good': 5, 'fair': 10, 'poor': 18, 'terrible': 25
            },
            'sodium_mg': {
                'excellent': 100, 'good': 200, 'fair': 400, 'poor': 600, 'terrible': 800
            },
            'saturated_fat_grams': {
                'excellent': 1, 'good': 3, 'fair': 5, 'poor': 8, 'terrible': 12
            },
            'fiber_grams': {
                'terrible': 0, 'poor': 0.5, 'fair': 1.5, 'good': 3, 'excellent': 5
            },
            'protein_grams': {
                'terrible': 0, 'poor': 1, 'fair': 3, 'good': 8, 'excellent': 12
            }
        }
        
        # High-risk additives for penalty scoring
        self.harmful_additives = {
            'high_risk': [
                'bha', 'bht', 'tbhq', 'sodium nitrite', 'sodium nitrate',
                'potassium nitrite', 'potassium nitrate', 'sulfur dioxide',
                'sodium sulfite', 'high fructose corn syrup', 'partially hydrogenated',
                'trans fat', 'artificial colors', 'red dye', 'yellow dye',
                'tartrazine', 'sunset yellow', 'allura red'
            ],
            'medium_risk': [
                'msg', 'monosodium glutamate', 'aspartame', 'acesulfame k',
                'sucralose', 'saccharin', 'carrageenan', 'sodium benzoate',
                'potassium sorbate', 'artificial flavor', 'natural flavor',
                'caramel color', 'phosphoric acid'
            ],
            'processing_indicators': [
                'corn syrup', 'maltodextrin', 'modified corn starch',
                'soy protein isolate', 'palm oil', 'vegetable shortening'
            ]
        }

    def extract_serving_size_improved(self, product: Dict) -> Dict:
        """Improved serving size extraction with better API field parsing"""
        
        # Step 1: Parse serving_size field (highest priority)
        serving_size_raw = product.get('serving_size', '')
        if serving_size_raw:
            parsed = self._parse_serving_field(serving_size_raw)
            if parsed and 5 <= parsed <= 2000:
                return {
                    'serving_size': round(parsed, 1),
                    'confidence': 'high',
                    'source': 'serving_size_field',
                    'raw_value': serving_size_raw
                }
        
        # Step 2: Use serving_quantity if available
        serving_quantity = product.get('serving_quantity')
        if serving_quantity:
            try:
                qty = float(serving_quantity)
                if 5 <= qty <= 2000:
                    return {
                        'serving_size': round(qty, 1),
                        'confidence': 'high',
                        'source': 'serving_quantity_field',
                        'raw_value': serving_quantity
                    }
            except (ValueError, TypeError):
                pass
        
        # Step 3: Calculate from nutrient ratios (serving vs 100g)
        ratio_result = self._calculate_from_nutrient_ratios(product.get('nutriments', {}))
        if ratio_result:
            return ratio_result
        
        # Step 4: Category-based estimation
        categories = product.get('categories', '').lower()
        product_name = product.get('product_name', '').lower()
        
        category_result = self._get_serving_from_categories(categories, product_name)
        if category_result:
            return category_result
        
        # Step 5: Intelligent fallback based on product type
        return self._intelligent_fallback(product_name, categories)

    def _parse_serving_field(self, serving_str: str) -> Optional[float]:
        """Parse serving size field with enhanced regex patterns"""
        if not serving_str:
            return None
            
        serving_str = str(serving_str).strip().lower()
        
        # Remove common prefixes
        serving_str = re.sub(r'^(about|approximately|approx\.?|ca\.?)\s*', '', serving_str)
        
        # Patterns in order of reliability
        patterns = [
            # Grams (most reliable)
            r'(\d+(?:\.\d+)?)\s*g(?:rams?)?(?:\s|$)',
            r'(\d+(?:\.\d+)?)\s*gr(?:\s|$)',
            
            # Milliliters (for liquids, 1ml ≈ 1g)
            r'(\d+(?:\.\d+)?)\s*ml(?:\s|$)',
            r'(\d+(?:\.\d+)?)\s*milliliters?(?:\s|$)',
            
            # Fluid ounces (convert to ml/g)
            r'(\d+(?:\.\d+)?)\s*fl\.?\s*oz(?:\s|$)',
            r'(\d+(?:\.\d+)?)\s*fluid\s*ounces?(?:\s|$)',
            
            # Regular ounces (convert to grams)
            r'(\d+(?:\.\d+)?)\s*oz(?:\s|$)',
            r'(\d+(?:\.\d+)?)\s*ounces?(?:\s|$)',
            
            # Cups (context-dependent conversion)
            r'(\d+(?:\.\d+)?)\s*cups?(?:\s|$)',
            
            # Tablespoons/teaspoons
            r'(\d+(?:\.\d+)?)\s*tbsp(?:\s|$)',
            r'(\d+(?:\.\d+)?)\s*tablespoons?(?:\s|$)',
            r'(\d+(?:\.\d+)?)\s*tsp(?:\s|$)',
            r'(\d+(?:\.\d+)?)\s*teaspoons?(?:\s|$)',
            
            # Pieces/items
            r'(\d+(?:\.\d+)?)\s*pieces?(?:\s|$)',
            r'(\d+(?:\.\d+)?)\s*items?(?:\s|$)',
            r'(\d+(?:\.\d+)?)\s*units?(?:\s|$)',
            
            # Slices (for bread, pizza, etc.)
            r'(\d+(?:\.\d+)?)\s*slices?(?:\s|$)',
            
            # Any standalone number
            r'(\d+(?:\.\d+))'
        ]
        
        for pattern in patterns:
            match = re.search(pattern, serving_str)
            if match:
                value = float(match.group(1))
                
                # Convert based on unit
                if 'fl' in serving_str or 'fluid' in serving_str:
                    return value * 29.5735  # fl oz to ml
                elif 'ml' in serving_str:
                    return value  # ml ≈ g for most foods
                elif 'oz' in serving_str and 'fl' not in serving_str:
                    return value * 28.3495  # oz to g
                elif 'cup' in serving_str:
                    return value * 240  # cup to g (average)
                elif 'tbsp' in serving_str or 'tablespoon' in serving_str:
                    return value * 15  # tbsp to g
                elif 'tsp' in serving_str or 'teaspoon' in serving_str:
                    return value * 5   # tsp to g
                elif 'slice' in serving_str:
                    return value * 28  # average slice weight
                elif 'piece' in serving_str or 'item' in serving_str or 'unit' in serving_str:
                    if 1 <= value <= 10:
                        return value * 30  # estimate piece weight
                    else:
                        return value  # might be weight in grams
                elif 'g' in serving_str or 'gram' in serving_str:
                    return value
                else:
                    # No unit specified, make educated guess
                    if 5 <= value <= 2000:
                        return value  # likely grams
                    elif 1 <= value <= 10:
                        return value * 30  # likely pieces
        
        return None

    def _calculate_from_nutrient_ratios(self, nutriments: Dict) -> Optional[Dict]:
        """Calculate serving size from nutrient ratios"""
        # Check for nutrients with both serving and 100g values
        nutrient_pairs = [
            ('energy-kcal_serving', 'energy-kcal_100g'),
            ('proteins_serving', 'proteins_100g'),
            ('carbohydrates_serving', 'carbohydrates_100g'),
            ('fat_serving', 'fat_100g'),
            ('sugars_serving', 'sugars_100g'),
            ('sodium_serving', 'sodium_100g')
        ]
        
        for serving_key, per_100g_key in nutrient_pairs:
            serving_val = nutriments.get(serving_key)
            per_100g_val = nutriments.get(per_100g_key)
            
            if serving_val and per_100g_val:
                try:
                    serving_num = float(serving_val)
                    per_100g_num = float(per_100g_val)
                    
                    if per_100g_num > 0 and serving_num > 0:
                        # serving_size = (serving_value / per_100g_value) * 100
                        calculated_serving = (serving_num / per_100g_num) * 100
                        
                        if 5 <= calculated_serving <= 2000:
                            return {
                                'serving_size': round(calculated_serving, 1),
                                'confidence': 'high',
                                'source': f'nutrient_ratio_{serving_key}',
                                'calculation': f'{serving_num}/{per_100g_num}*100'
                            }
                except (ValueError, TypeError, ZeroDivisionError):
                    continue
        
        return None

    def _get_serving_from_categories(self, categories: str, product_name: str) -> Optional[Dict]:
        """Get serving size based on product categories"""
        search_text = f"{categories} {product_name}".lower()
        
        # Find best matching category
        best_match = None
        best_score = 0
        
        for category, serving_size in self.serving_size_database.items():
            if category in search_text:
                # Score based on category specificity and position
                score = len(category)
                if category in product_name:
                    score += 10  # bonus for being in product name
                
                if score > best_score:
                    best_score = score
                    best_match = (category, serving_size)
        
        if best_match:
            return {
                'serving_size': float(best_match[1]),
                'confidence': 'medium',
                'source': f'category_{best_match[0]}',
                'match_score': best_score
            }
        
        return None

    def _intelligent_fallback(self, product_name: str, categories: str) -> Dict:
        """Intelligent fallback serving size estimation"""
        search_text = f"{product_name} {categories}".lower()
        
        # Beverage indicators
        if any(word in search_text for word in ['drink', 'beverage', 'juice', 'soda', 'water', 'milk']):
            serving_size = 240.0
        # Snack indicators
        elif any(word in search_text for word in ['chip', 'cracker', 'cookie', 'candy', 'snack']):
            serving_size = 30.0
        # Breakfast items
        elif any(word in search_text for word in ['cereal', 'oatmeal', 'granola', 'breakfast']):
            serving_size = 40.0
        # Dairy
        elif any(word in search_text for word in ['yogurt', 'cheese', 'cream']):
            serving_size = 100.0
        # Condiments
        elif any(word in search_text for word in ['sauce', 'dressing', 'butter', 'jam', 'spread']):
            serving_size = 20.0
        # Bread products
        elif any(word in search_text for word in ['bread', 'bagel', 'muffin', 'roll']):
            serving_size = 50.0
        else:
            serving_size = 50.0  # Conservative default
        
        return {
            'serving_size': serving_size,
            'confidence': 'low',
            'source': 'intelligent_fallback',
            'method': 'pattern_matching'
        }

    def calculate_improved_health_score(self, product: Dict, serving_size: float) -> int:
        """Calculate health score with stricter criteria"""
        nutriments = product.get('nutriments', {})
        ingredients_text = product.get('ingredients_text', '').lower()
        
        # Start with neutral score
        score = 60
        
        # Calculate per-serving values
        per_serving = self._calculate_per_serving_nutrients(nutriments, serving_size)
        
        # Calories assessment (stricter penalties)
        calories = per_serving.get('calories', 0)
        if calories:
            if calories <= 80:
                score += 15
            elif calories <= 120:
                score += 10
            elif calories <= 200:
                score += 0
            elif calories <= 300:
                score -= 15
            else:
                score -= 25
        
        # Sugar assessment (very strict)
        sugar = per_serving.get('sugar', 0)
        if sugar:
            if sugar <= 2:
                score += 10
            elif sugar <= 5:
                score += 5
            elif sugar <= 10:
                score -= 5
            elif sugar <= 18:
                score -= 15
            else:
                score -= 30  # Very high sugar penalty
        
        # Sodium assessment (stricter)
        sodium = per_serving.get('sodium', 0)
        if sodium:
            if sodium <= 100:
                score += 10
            elif sodium <= 200:
                score += 5
            elif sodium <= 400:
                score -= 5
            elif sodium <= 600:
                score -= 15
            else:
                score -= 25
        
        # Saturated fat assessment
        sat_fat = per_serving.get('saturated_fat', 0)
        if sat_fat:
            if sat_fat <= 1:
                score += 5
            elif sat_fat <= 3:
                score += 0
            elif sat_fat <= 5:
                score -= 5
            elif sat_fat <= 8:
                score -= 10
            else:
                score -= 20
        
        # Fiber bonus (encourage high fiber)
        fiber = per_serving.get('fiber', 0)
        if fiber:
            if fiber >= 5:
                score += 15
            elif fiber >= 3:
                score += 10
            elif fiber >= 1.5:
                score += 5
        
        # Protein bonus
        protein = per_serving.get('protein', 0)
        if protein:
            if protein >= 12:
                score += 15
            elif protein >= 8:
                score += 10
            elif protein >= 3:
                score += 5
        
        # Additive penalties (very strict)
        score -= self._calculate_additive_penalty(ingredients_text)
        
        # Processing level penalty
        score -= self._calculate_processing_penalty(ingredients_text)
        
        # Ultra-processed food penalty
        if self._is_ultra_processed(ingredients_text, nutriments):
            score -= 20
        
        return max(0, min(100, score))

    def _calculate_per_serving_nutrients(self, nutriments: Dict, serving_size: float) -> Dict:
        """Calculate nutrients per serving"""
        per_serving = {}
        
        # Key nutrients to calculate
        nutrient_map = {
            'calories': ['energy-kcal_100g', 'energy_100g'],
            'sugar': ['sugars_100g'],
            'sodium': ['sodium_100g'],
            'saturated_fat': ['saturated-fat_100g'],
            'fiber': ['fiber_100g'],
            'protein': ['proteins_100g']
        }
        
        for nutrient_name, possible_keys in nutrient_map.items():
            for key in possible_keys:
                value = nutriments.get(key)
                if value:
                    try:
                        per_100g = float(value)
                        per_serving_value = (per_100g * serving_size) / 100
                        per_serving[nutrient_name] = per_serving_value
                        break
                    except (ValueError, TypeError):
                        continue
        
        # Convert sodium from grams to milligrams if needed
        if 'sodium' in per_serving and per_serving['sodium'] < 10:
            per_serving['sodium'] *= 1000
        
        return per_serving

    def _calculate_additive_penalty(self, ingredients_text: str) -> int:
        """Calculate penalty for harmful additives"""
        penalty = 0
        
        # High-risk additives
        for additive in self.harmful_additives['high_risk']:
            if additive in ingredients_text:
                penalty += 15
        
        # Medium-risk additives
        for additive in self.harmful_additives['medium_risk']:
            if additive in ingredients_text:
                penalty += 8
        
        # Processing indicators
        for indicator in self.harmful_additives['processing_indicators']:
            if indicator in ingredients_text:
                penalty += 5
        
        return min(penalty, 40)  # Cap penalty at 40 points

    def _calculate_processing_penalty(self, ingredients_text: str) -> int:
        """Calculate penalty based on processing level"""
        if not ingredients_text:
            return 5
        
        # Count ingredients
        ingredients = [i.strip() for i in ingredients_text.split(',') if i.strip()]
        ingredient_count = len(ingredients)
        
        # Penalty based on ingredient count (more = more processed)
        if ingredient_count <= 3:
            return 0
        elif ingredient_count <= 5:
            return 2
        elif ingredient_count <= 10:
            return 5
        elif ingredient_count <= 15:
            return 8
        else:
            return 15

    def _is_ultra_processed(self, ingredients_text: str, nutriments: Dict) -> bool:
        """Determine if food is ultra-processed"""
        if not ingredients_text:
            return False
        
        ultra_processed_indicators = [
            'high fructose corn syrup', 'hydrolyzed protein', 'isolate',
            'concentrate', 'modified starch', 'artificial', 'flavor enhancer',
            'emulsifier', 'stabilizer', 'thickener', 'gelling agent'
        ]
        
        # Check ingredients
        for indicator in ultra_processed_indicators:
            if indicator in ingredients_text.lower():
                return True
        
        # Check if too many additives
        ingredient_count = len([i.strip() for i in ingredients_text.split(',') if i.strip()])
        if ingredient_count > 20:
            return True
        
        return False

    def analyze_product_complete(self, product: Dict) -> Dict:
        """Complete product analysis"""
        # Get serving size
        serving_info = self.extract_serving_size_improved(product)
        serving_size = serving_info['serving_size']
        
        # Calculate health score
        health_score = self.calculate_improved_health_score(product, serving_size)
        
        # Calculate per-serving nutrition
        per_serving_nutrition = self._calculate_per_serving_nutrients(
            product.get('nutriments', {}), serving_size
        )
        
        # Generate recommendations
        recommendations = self._generate_recommendations(health_score, per_serving_nutrition)
        
        # Determine overall grade
        if health_score >= 80:
            grade = 'A'
            grade_text = 'Excellent'
        elif health_score >= 65:
            grade = 'B'
            grade_text = 'Good'
        elif health_score >= 45:
            grade = 'C'
            grade_text = 'Fair'
        elif health_score >= 25:
            grade = 'D'
            grade_text = 'Poor'
        else:
            grade = 'F'
            grade_text = 'Very Poor'
        
        return {
            'serving_info': serving_info,
            'health_score': health_score,
            'grade': grade,
            'grade_text': grade_text,
            'per_serving_nutrition': per_serving_nutrition,
            'recommendations': recommendations,
            'is_ultra_processed': self._is_ultra_processed(
                product.get('ingredients_text', ''),
                product.get('nutriments', {})
            )
        }

    def _generate_recommendations(self, health_score: int, nutrition: Dict) -> List[str]:
        """Generate specific recommendations"""
        recommendations = []
        
        # Overall assessment
        if health_score >= 80:
            recommendations.append("✅ Excellent choice! This is a nutritious option.")
        elif health_score >= 65:
            recommendations.append("👍 Good choice. Enjoy as part of a balanced diet.")
        elif health_score >= 45:
            recommendations.append("⚠️ Okay option. Consider healthier alternatives when possible.")
        elif health_score >= 25:
            recommendations.append("❌ Poor nutritional quality. Limit consumption.")
        else:
            recommendations.append("🚫 Very poor choice. Avoid or consume very rarely.")
        
        # Specific nutrient advice
        calories = nutrition.get('calories', 0)
        if calories > 300:
            recommendations.append(f"🔥 High calories: {calories:.0f} per serving. Watch portion size.")
        
        sugar = nutrition.get('sugar', 0)
        if sugar > 10:
            recommendations.append(f"🍬 High sugar: {sugar:.1f}g per serving. Limit intake.")
        
        sodium = nutrition.get('sodium', 0)
        if sodium > 400:
            recommendations.append(f"🧂 High sodium: {sodium:.0f}mg per serving. Monitor daily intake.")
        
        fiber = nutrition.get('fiber', 0)
        if fiber >= 3:
            recommendations.append(f"🌾 Good fiber source: {fiber:.1f}g per serving.")
        
        protein = nutrition.get('protein', 0)
        if protein >= 8:
            recommendations.append(f"💪 Good protein source: {protein:.1f}g per serving.")
        
        return recommendations


# Initialize the analyzer
analyzer = ImprovedFoodAnalyzer()

@food_scanner_bp.route('/product/<barcode>', methods=['GET'])
def get_product_info(barcode):
    """Get comprehensive product information"""
    try:
        if not barcode or not barcode.isdigit():
            return jsonify({'error': 'Invalid barcode format'}), 400
        
        # Query OpenFoodFacts API
        url = f"https://world.openfoodfacts.org/api/v0/product/{barcode}.json"
        headers = {
            'User-Agent': 'ImprovedFoodScanner/1.0'
        }
        
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        
        data = response.json()
        
        if data.get('status') != 1:
            return jsonify({'error': 'Product not found'}), 404
        
        product = data['product']
        
        # Perform complete analysis
        analysis = analyzer.analyze_product_complete(product)
        
        # Prepare response
        result = {
            'barcode': barcode,
            'product_name': product.get('product_name', 'Unknown Product'),
            'brands': product.get('brands', ''),
            'categories': product.get('categories', ''),
            'image_url': product.get('image_url', ''),
            'ingredients_text': product.get('ingredients_text', ''),
            'nutriscore_grade': product.get('nutriscore_grade', '').upper(),
            'serving_size': analysis['serving_info']['serving_size'],
            'serving_confidence': analysis['serving_info']['confidence'],
            'health_score': analysis['health_score'],
            'grade': analysis['grade'],
            'grade_description': analysis['grade_text'],
            'nutrition_per_serving': analysis['per_serving_nutrition'],
            'recommendations': analysis['recommendations'],
            'is_ultra_processed': analysis['is_ultra_processed'],
            'analysis_details': {
                'serving_source': analysis['serving_info'].get('source', 'unknown'),
                'serving_method': analysis['serving_info'].get('method', 'unknown'),
                'raw_serving_data': analysis['serving_info'].get('raw_value', '')
            }
        }
        
        return jsonify(result)
    
    except requests.exceptions.RequestException as e:
        logger.error(f"API request failed: {e}")
        return jsonify({'error': 'Failed to fetch product data'}), 500
    
    except Exception as e:
        logger.error(f"Analysis error: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@food_scanner_bp.route('/search/<query>', methods=['GET'])
def search_products(query):
    """Search for products with improved filtering"""
    try:
        page_size = min(request.args.get('page_size', 20, type=int), 50)
        
        # Search OpenFoodFacts
        url = "https://world.openfoodfacts.org/cgi/search.pl"
        params = {
            'search_terms': query,
            'search_simple': 1,
            'action': 'process',
            'json': 1,
            'page_size': page_size * 2,  # Get more to filter
            'sort_by': 'popularity',
            'fields': 'code,product_name,brands,categories,image_url,nutriscore_grade,nutriments,serving_size,serving_quantity'
        }
        
        headers = {'User-Agent': 'ImprovedFoodScanner/1.0'}
        
        response = requests.get(url, params=params, headers=headers, timeout=10)
        response.raise_for_status()
        
        data = response.json()
        products = data.get('products', [])
        
        # Filter and analyze products
        results = []
        for product in products[:page_size]:
            try:
                # Quick analysis
                serving_info = analyzer.extract_serving_size_improved(product)
                health_score = analyzer.calculate_improved_health_score(product, serving_info['serving_size'])
                
                results.append({
                    'barcode': product.get('code', ''),
                    'product_name': product.get('product_name', 'Unknown'),
                    'brands': product.get('brands', ''),
                    'image_url': product.get('image_url', ''),
                    'nutriscore_grade': product.get('nutriscore_grade', '').upper(),
                    'serving_size': serving_info['serving_size'],
                    'health_score': health_score,
                    'grade': 'A' if health_score >= 80 else 'B' if health_score >= 65 else 'C' if health_score >= 45 else 'D' if health_score >= 25 else 'F'
                })
            except Exception as e:
                logger.warning(f"Error analyzing product {product.get('code', 'unknown')}: {e}")
                continue
        
        return jsonify({
            'products': results,
            'query': query,
            'total_results': len(results)
        })
    
    except Exception as e:
        logger.error(f"Search error: {e}")
        return jsonify({'error': 'Search failed'}), 500

@food_scanner_bp.route('/analyze-ingredients', methods=['POST'])
def analyze_ingredients():
    """Analyze ingredients text for harmful additives"""
    try:
        data = request.get_json()
        ingredients_text = data.get('ingredients_text', '')
        
        if not ingredients_text:
            return jsonify({'error': 'No ingredients text provided'}), 400
        
        ingredients_lower = ingredients_text.lower()
        found_additives = {'high_risk': [], 'medium_risk': [], 'processing_indicators': []}
        
        # Check for harmful additives
        for category, additives in analyzer.harmful_additives.items():
            for additive in additives:
                if additive in ingredients_lower:
                    found_additives[category].append(additive)
        
        # Calculate penalty
        penalty = analyzer._calculate_additive_penalty(ingredients_text)
        processing_penalty = analyzer._calculate_processing_penalty(ingredients_text)
        
        # Count ingredients
        ingredient_list = [i.strip() for i in ingredients_text.split(',') if i.strip()]
        
        return jsonify({
            'ingredient_count': len(ingredient_list),
            'found_additives': found_additives,
            'additive_penalty': penalty,
            'processing_penalty': processing_penalty,
            'is_ultra_processed': analyzer._is_ultra_processed(ingredients_text, {}),
            'total_penalty': penalty + processing_penalty
        })
    
    except Exception as e:
        logger.error(f"Ingredient analysis error: {e}")
        return jsonify({'error': 'Analysis failed'}), 500

@food_scanner_bp.route('/compare', methods=['POST'])
def compare_products():
    """Compare multiple products"""
    try:
        data = request.get_json()
        barcodes = data.get('barcodes', [])
        
        if not barcodes or len(barcodes) > 5:
            return jsonify({'error': 'Provide 2-5 barcodes for comparison'}), 400
        
        products = []
        
        for barcode in barcodes:
            try:
                # Get product data
                url = f"https://world.openfoodfacts.org/api/v0/product/{barcode}.json"
                headers = {'User-Agent': 'ImprovedFoodScanner/1.0'}
                
                response = requests.get(url, headers=headers, timeout=8)
                if response.status_code == 200:
                    product_data = response.json()
                    if product_data.get('status') == 1:
                        product = product_data['product']
                        analysis = analyzer.analyze_product_complete(product)
                        
                        products.append({
                            'barcode': barcode,
                            'product_name': product.get('product_name', 'Unknown'),
                            'brands': product.get('brands', ''),
                            'image_url': product.get('image_url', ''),
                            'health_score': analysis['health_score'],
                            'grade': analysis['grade'],
                            'serving_size': analysis['serving_info']['serving_size'],
                            'nutrition_per_serving': analysis['per_serving_nutrition'],
                            'is_ultra_processed': analysis['is_ultra_processed']
                        })
            except Exception as e:
                logger.warning(f"Error processing barcode {barcode}: {e}")
                continue
        
        if len(products) < 2:
            return jsonify({'error': 'Need at least 2 valid products for comparison'}), 400
        
        # Generate comparison insights
        best_product = max(products, key=lambda p: p['health_score'])
        worst_product = min(products, key=lambda p: p['health_score'])
        
        insights = []
        insights.append(f"🏆 Best choice: {best_product['product_name']} (Score: {best_product['health_score']})")
        
        if best_product['health_score'] != worst_product['health_score']:
            insights.append(f"❌ Worst choice: {worst_product['product_name']} (Score: {worst_product['health_score']})")
        
        # Compare calories
        calorie_data = [(p, p['nutrition_per_serving'].get('calories', 0)) for p in products]
        calorie_data = [(p, c) for p, c in calorie_data if c > 0]
        if len(calorie_data) > 1:
            lowest_cal = min(calorie_data, key=lambda x: x[1])
            highest_cal = max(calorie_data, key=lambda x: x[1])
            if lowest_cal[1] != highest_cal[1]:
                insights.append(f"🔥 Calories: {lowest_cal[0]['product_name']} has {lowest_cal[1]:.0f} vs {highest_cal[0]['product_name']} with {highest_cal[1]:.0f}")
        
        # Compare sugar
        sugar_data = [(p, p['nutrition_per_serving'].get('sugar', 0)) for p in products]
        sugar_data = [(p, s) for p, s in sugar_data if s > 0]
        if len(sugar_data) > 1:
            lowest_sugar = min(sugar_data, key=lambda x: x[1])
            highest_sugar = max(sugar_data, key=lambda x: x[1])
            if lowest_sugar[1] != highest_sugar[1]:
                insights.append(f"🍬 Sugar: {lowest_sugar[0]['product_name']} has {lowest_sugar[1]:.1f}g vs {highest_sugar[0]['product_name']} with {highest_sugar[1]:.1f}g")
        
        return jsonify({
            'products': products,
            'comparison_insights': insights,
            'recommendation': best_product['product_name'],
            'total_compared': len(products)
        })
    
    except Exception as e:
        logger.error(f"Comparison error: {e}")
        return jsonify({'error': 'Comparison failed'}), 500

@food_scanner_bp.route('/serving-size-debug/<barcode>', methods=['GET'])
def debug_serving_size(barcode):
    """Debug serving size extraction for a specific product"""
    try:
        # Get product data
        url = f"https://world.openfoodfacts.org/api/v0/product/{barcode}.json"
        headers = {'User-Agent': 'ImprovedFoodScanner/1.0'}
        
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        
        data = response.json()
        if data.get('status') != 1:
            return jsonify({'error': 'Product not found'}), 404
        
        product = data['product']
        
        # Test all serving size extraction methods
        debug_info = {
            'product_name': product.get('product_name', ''),
            'brands': product.get('brands', ''),
            'categories': product.get('categories', ''),
            'raw_fields': {
                'serving_size': product.get('serving_size', ''),
                'serving_quantity': product.get('serving_quantity', ''),
                'quantity': product.get('quantity', ''),
            },
            'parsing_tests': {},
            'final_result': {}
        }
        
        # Test field parsing
        serving_size_raw = product.get('serving_size', '')
        if serving_size_raw:
            debug_info['parsing_tests']['serving_size_field'] = {
                'raw': serving_size_raw,
                'parsed': analyzer._parse_serving_field(serving_size_raw)
            }
        
        # Test nutrient ratio calculation
        ratio_result = analyzer._calculate_from_nutrient_ratios(product.get('nutriments', {}))
        debug_info['parsing_tests']['nutrient_ratios'] = ratio_result
        
        # Test category matching
        categories = product.get('categories', '').lower()
        product_name = product.get('product_name', '').lower()
        category_result = analyzer._get_serving_from_categories(categories, product_name)
        debug_info['parsing_tests']['category_matching'] = category_result
        
        # Test fallback
        fallback_result = analyzer._intelligent_fallback(product_name, categories)
        debug_info['parsing_tests']['fallback'] = fallback_result
        
        # Get final result
        final_result = analyzer.extract_serving_size_improved(product)
        debug_info['final_result'] = final_result
        
        # Show sample nutrients
        nutriments = product.get('nutriments', {})
        debug_info['sample_nutrients'] = {
            k: v for k, v in nutriments.items()
            if '_serving' in k or '_100g' in k
        }
        
        return jsonify(debug_info)
    
    except Exception as e:
        logger.error(f"Debug error: {e}")
        return jsonify({'error': f'Debug failed: {str(e)}'}), 500

@food_scanner_bp.route('/health', methods=['GET'])
def health_check():
    """API health check"""
    return jsonify({
        'status': 'healthy',
        'message': 'Improved Food Scanner API v1.0',
        'features': [
            'Accurate serving size extraction from API fields',
            'Stricter health scoring with realistic thresholds',
            'Comprehensive additive detection',
            'Ultra-processed food identification',
            'Per-serving nutrition calculation',
            'Product comparison tools',
            'Detailed analysis and recommendations'
        ],
        'serving_size_methods': [
            'API serving_size field parsing',
            'serving_quantity field usage',
            'Nutrient ratio calculations',
            'Category-based estimation',
            'Intelligent fallback system'
        ],
        'health_scoring_factors': [
            'Calories per serving',
            'Sugar content (strict limits)',
            'Sodium content',
            'Saturated fat',
            'Fiber content (bonus)',
            'Protein content (bonus)',
            'Harmful additives (penalties)',
            'Processing level (penalties)',
            'Ultra-processed classification'
        ]
    })

@food_scanner_bp.route('/nutrition-facts/<barcode>', methods=['GET'])
def get_nutrition_facts(barcode):
    """Get formatted nutrition facts label data"""
    try:
        # Get product data
        url = f"https://world.openfoodfacts.org/api/v0/product/{barcode}.json"
        headers = {'User-Agent': 'ImprovedFoodScanner/1.0'}
        
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        
        data = response.json()
        if data.get('status') != 1:
            return jsonify({'error': 'Product not found'}), 404
        
        product = data['product']
        
        # Get serving size
        serving_info = analyzer.extract_serving_size_improved(product)
        serving_size = serving_info['serving_size']
        
        # Calculate nutrition per serving
        nutriments = product.get('nutriments', {})
        nutrition_facts = {}
        
        # Key nutrients for nutrition label
        nutrient_mapping = {
            'calories': ['energy-kcal_100g', 'energy_100g'],
            'total_fat': ['fat_100g'],
            'saturated_fat': ['saturated-fat_100g'],
            'trans_fat': ['trans-fat_100g'],
            'cholesterol': ['cholesterol_100g'],
            'sodium': ['sodium_100g'],
            'total_carbs': ['carbohydrates_100g'],
            'dietary_fiber': ['fiber_100g'],
            'total_sugars': ['sugars_100g'],
            'added_sugars': ['added-sugars_100g'],
            'protein': ['proteins_100g'],
            'vitamin_d': ['vitamin-d_100g'],
            'calcium': ['calcium_100g'],
            'iron': ['iron_100g'],
            'potassium': ['potassium_100g']
        }
        
        for nutrient_name, possible_keys in nutrient_mapping.items():
            for key in possible_keys:
                value = nutriments.get(key)
                if value is not None:
                    try:
                        per_100g = float(value)
                        per_serving = (per_100g * serving_size) / 100
                        
                        # Special handling for different units
                        if nutrient_name == 'calories':
                            nutrition_facts[nutrient_name] = round(per_serving)
                        elif nutrient_name == 'sodium' and per_serving < 10:
                            # Convert to mg if in grams
                            nutrition_facts[nutrient_name] = round(per_serving * 1000)
                        elif nutrient_name in ['calcium', 'iron', 'potassium', 'vitamin_d']:
                            # Usually in mg or µg
                            nutrition_facts[nutrient_name] = round(per_serving, 1)
                        else:
                            # Fats, carbs, protein, fiber in grams
                            nutrition_facts[nutrient_name] = round(per_serving, 1)
                        break
                    except (ValueError, TypeError):
                        continue
        
        return jsonify({
            'barcode': barcode,
            'product_name': product.get('product_name', 'Unknown'),
            'serving_size': f"{serving_size}g",
            'nutrition_facts': nutrition_facts,
            'serving_confidence': serving_info['confidence'],
            'data_source': serving_info.get('source', 'unknown')
        })
    
    except Exception as e:
        logger.error(f"Nutrition facts error: {e}")
        return jsonify({'error': 'Failed to get nutrition facts'}), 500

def init_food_scanner_routes(app):
    """Initialize food scanner routes"""
    app.register_blueprint(food_scanner_bp, url_prefix='/api/food-scanner')
