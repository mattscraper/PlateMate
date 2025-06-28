# Category-based calorie targets for appropriate serving sizes
            if any(cat in categories_lower for cat in ['beverage', 'drink', 'juice', 'soda']):
                target_calories = 150  # Typical drink serving
            elif any(cat in categories_lower for cat in ['snack', 'chip', 'cracker']):
                target_calories = 140  # Typical snack serving
            elif any(cat in categories_lower for cat in ['candy', 'chocolate', 'sweet']):
                target_calories = 150  # Typical candy serving
            elif any(cat in categories_lower for cat in ['cereal', 'breakfast']):
                target_calories = 110  # Typical cereal serving
            elif any(cat in categories_lower for cat in ['yogurt', 'dairy']):
                target_calories = 100  # Typical yogurt serving
            elif any(cat in categories_lower for cat in ['bread', 'bakery']):
                target_calories = 80   # Typical bread serving
            else:
                target_calories = 120  # General target
            
            # Calculate serving size: target_calories / (energy_per_100g) * 100
            estimated_serving = (target_calories / energy_val) * 100
            
            if 5 <= estimated_serving <= 500:
                return {
                    'serving_size': round(estimated_serving, 1),
                    'confidence': 'medium',
                    'source': f'energy_estimation_{energy_val}kcal',
                    'method': 'energy_density_calculation',
                    'target_calories': target_calories
                }
        except (ValueError, TypeError):
            pass
        
        return None

    def _intelligent_fallback_serving(self, product_name: str, categories: str, brands: str) -> Dict:
        """Intelligent fallback with context-aware defaults"""
        product_name_lower = product_name.lower()
        categories_lower = categories.lower()
        
        # Context-aware fallbacks
        if any(word in product_name_lower for word in ['drink', 'juice', 'soda', 'water', 'tea', 'coffee']):
            serving_size = 240.0
        elif any(word in product_name_lower for word in ['bar', 'candy', 'chocolate']):
            serving_size = 40.0
        elif any(word in product_name_lower for word in ['chip', 'crisp', 'snack']):
            serving_size = 28.0
        elif any(word in product_name_lower for word in ['yogurt', 'pudding']):
            serving_size = 170.0
        elif any(word in product_name_lower for word in ['cereal', 'flakes']):
            serving_size = 35.0
        elif any(word in product_name_lower for word in ['bread', 'slice']):
            serving_size = 28.0
        elif any(word in product_name_lower for word in ['cookie', 'biscuit']):
            serving_size = 30.0
        elif any(word in categories_lower for word in ['beverage', 'drink']):
            serving_size = 240.0
        elif any(word in categories_lower for word in ['snack', 'confectionery']):
            serving_size = 30.0
        else:
            serving_size = 50.0  # Conservative default
        
        return {
            'serving_size': serving_size,
            'confidence': 'low',
            'source': 'intelligent_fallback',
            'method': 'context_aware_default'
        }

    def search_products_intelligent(self, query: str, page_size: int = 20) -> List[Dict]:
        """Intelligent product search with relevance scoring and filtering"""
        try:
            # Enhanced search with multiple strategies
            results = []
            
            # Strategy 1: Direct search with filters
            direct_results = self._search_openfoodfacts(query, page_size * 2)
            
            # Strategy 2: Search with synonyms/variants
            variant_queries = self._generate_search_variants(query)
            for variant in variant_queries[:2]:  # Limit to 2 variants
                variant_results = self._search_openfoodfacts(variant, page_size)
                direct_results.extend(variant_results)
            
            # Remove duplicates and score relevance
            unique_products = {}
            for product in direct_results:
                barcode = product.get('code', '')
                if barcode and barcode not in unique_products:
                    # Calculate relevance score
                    relevance_score = self._calculate_relevance_score(product, query)
                    product['relevance_score'] = relevance_score
                    unique_products[barcode] = product
            
            # Filter and sort by relevance
            filtered_products = []
            for product in unique_products.values():
                # Apply quality filters
                if self._passes_quality_filters(product, query):
                    filtered_products.append(product)
            
            # Sort by relevance score (highest first)
            filtered_products.sort(key=lambda x: x.get('relevance_score', 0), reverse=True)
            
            # Limit results and add serving size info
            final_results = []
            for product in filtered_products[:page_size]:
                # Get intelligent serving size
                serving_info = self.extract_serving_size_intelligent(product)
                
                # Quick health assessment
                quick_health_score = self._quick_health_assessment(product)
                
                final_results.append({
                    'barcode': product.get('code', ''),
                    'product_name': product.get('product_name', 'Unknown'),
                    'brands': product.get('brands', ''),
                    'categories': product.get('categories', ''),
                    'image_url': product.get('image_url', ''),
                    'nutriscore_grade': product.get('nutriscore_grade', '').upper(),
                    'serving_size': serving_info['serving_size'],
                    'serving_confidence': serving_info['confidence'],
                    'quick_health_score': quick_health_score,
                    'relevance_score': product.get('relevance_score', 0),
                    'country': product.get('countries', ''),
                })
            
            return final_results
            
        except Exception as e:
            logger.error(f"Intelligent search error: {e}")
            return []

    def _search_openfoodfacts(self, query: str, page_size: int) -> List[Dict]:
        """Search OpenFoodFacts with optimized parameters"""
        url = "https://world.openfoodfacts.org/cgi/search.pl"
        
        params = {
            'search_terms': query,
            'search_simple': 1,
            'action': 'process',
            'json': 1,
            'page_size': page_size,
            'sort_by': 'popularity',  # Prioritize popular products
            'countries': 'United States,Canada,United Kingdom,Australia',  # English-speaking countries
            'fields': 'code,product_name,brands,categories,image_url,nutriscore_grade,countries,nutriments,serving_size,serving_quantity,quantity'
        }
        
        headers = {
            'User-Agent': 'PlateMate-IntelligentScanner/2.0 (platemate-app@example.com)'
        }
        
        try:
            response = requests.get(url, params=params, headers=headers, timeout=15)
            response.raise_for_status()
            data = response.json()
            return data.get('products', [])
        except Exception as e:
            logger.error(f"OpenFoodFacts search error: {e}")
            return []

    def _generate_search_variants(self, query: str) -> List[str]:
        """Generate search variants to improve results"""
        variants = []
        query_lower = query.lower().strip()
        
        # Add brand-focused variants
        if len(query_lower.split()) > 1:
            words = query_lower.split()
            # Try just the first word (often brand)
            variants.append(words[0])
            # Try last word (often product type)
            variants.append(words[-1])
        
        # Add common substitutions
        substitutions = {
            'lite': 'light',
            'light': 'lite',
            'zero': '0',
            'diet': 'zero',
            'original': 'classic',
            'regular': 'original'
        }
        
        for old, new in substitutions.items():
            if old in query_lower:
                variants.append(query_lower.replace(old, new))
        
        return variants

    def _calculate_relevance_score(self, product: Dict, query: str) -> float:
        """Calculate relevance score for search results"""
        score = 0.0
        query_lower = query.lower()
        query_words = set(query_lower.split())
        
        product_name = product.get('product_name', '').lower()
        brands = product.get('brands', '').lower()
        categories = product.get('categories', '').lower()
        
        # Exact matches get highest scores
        if query_lower in product_name:
            score += 100
        elif query_lower in brands:
            score += 80
        
        # Word-by-word matching
        product_words = set(product_name.split() + brands.split())
        word_matches = len(query_words.intersection(product_words))
        score += word_matches * 20
        
        # Partial word matching
        for query_word in query_words:
            for product_word in product_words:
                if query_word in product_word or product_word in query_word:
                    score += 10
        
        # Sequence similarity
        name_similarity = SequenceMatcher(None, query_lower, product_name).ratio()
        brand_similarity = SequenceMatcher(None, query_lower, brands).ratio()
        score += max(name_similarity, brand_similarity) * 30
        
        # Bonus for English/recognizable products
        if any(keyword in product_name for keyword in self.english_keywords):
            score += 15
        
        # Penalty for very foreign-looking names
        if self._is_likely_foreign(product_name):
            score -= 20
        
        # Bonus for having good nutrition data
        if product.get('nutriscore_grade'):
            score += 10
        
        # Bonus for having serving size data
        if product.get('serving_size') or product.get('serving_quantity'):
            score += 5
        
        return max(0, score)

    def _is_likely_foreign(self, text: str) -> bool:
        """Detect if text is likely in a foreign language"""
        if not text:
            return False
        
        text_lower = text.lower()
        
        # Check for non-Latin characters
        if any(ord(char) > 127 for char in text):
            return True
        
        # Check for foreign language patterns
        foreign_patterns = [
            r'[àáâãäåæç]',  # French/Spanish accents
            r'[èéêë]',       # French accents
            r'[ìíîï]',       # Italian accents
            r'[òóôõö]',      # Various accents
            r'[ùúûü]',       # Various accents
            r'[ñ]',          # Spanish
            r'[ß]',          # German
        ]
        
        for pattern in foreign_patterns:
            if re.search(pattern, text_lower):
                return True
        
        return False

    def _passes_quality_filters(self, product: Dict, query: str) -> bool:
        """Apply quality filters to search results"""
        product_name = product.get('product_name', '').lower()
        brands = product.get('brands', '').lower()
        countries = product.get('countries', '').lower()
        
        # Filter out products with very foreign names unless specifically searched
        if self._is_likely_foreign(product_name) and not self._is_likely_foreign(query):
            return False
        
        # Require minimum product name length
        if len(product_name.strip()) < 3:
            return False
        
        # Prefer products from English-speaking countries
        has_english_country = any(country in countries for country in ['us', 'gb', 'ca', 'au', 'united states', 'united kingdom', 'canada', 'australia'])
        has_foreign_country_only = countries and not has_english_country
        
        if has_foreign_country_only and not self._query_seems_international(query):
            return False
        
        # Filter out products with no useful information
        if not any([
            product.get('brands'),
            product.get('categories'),
            product.get('nutriscore_grade'),
            product.get('nutriments')
        ]):
            return False
        
        return True

    def _query_seems_international(self, query: str) -> bool:
        """Check if query seems to be looking for international products"""
        international_indicators = [
            'japanese', 'korean', 'chinese', 'thai', 'indian', 'mexican',
            'italian', 'french', 'german', 'spanish', 'brazilian',
            'asian', 'european', 'latin', 'authentic', 'imported'
        ]
        query_lower = query.lower()
        return any(indicator in query_lower for indicator in international_indicators)

    def _quick_health_assessment(self, product: Dict) -> int:
        """Quick health assessment for search results"""
        score = 60  # Start with neutral score
        
        nutriments = product.get('nutriments', {})
        
        # Quick penalties for bad nutrients
        sugars = nutriments.get('sugars_100g', 0)
        if sugars and sugars > 20:
            score -= 25
        elif sugars and sugars > 10:
            score -= 15
        
        sodium = nutriments.get('sodium_100g', 0)
        if sodium and sodium > 0.5:
            score -= 20
        elif sodium and sodium > 0.3:
            score -= 10
        
        # Quick bonuses for good nutrients
        fiber = nutriments.get('fiber_100g', 0)
        if fiber and fiber > 5:
            score += 20
        elif fiber and fiber > 3:
            score += 10
        
        protein = nutriments.get('proteins_100g', 0)
        if protein and protein > 15:
            score += 15
        elif protein and protein > 8:
            score += 8
        
        # Nutri-Score bonus/penalty
        nutriscore = product.get('nutriscore_grade', '').lower()
        if nutriscore == 'a':
            score += 20
        elif nutriscore == 'b':
            score += 10
        elif nutriscore == 'd':
            score -= 10
        elif nutriscore == 'e':
            score -= 20
        
        return max(0, min(100, score))

    def calculate_health_score_enhanced(self, nutrients: Dict, ingredients_analysis: Dict) -> int:
        """Enhanced health score calculation with better balance"""
        base_score = 60  # Neutral starting point
        
        # Negative factors (more balanced penalties)
        energy = nutrients.get('energy_kcal_100g', 0) or nutrients.get('energy_100g', 0)
        if energy:
            level = self._evaluate_nutrient_level('energy_kcal_100g', energy)
            penalty_map = {'terrible': -25, 'poor': -15, 'fair': -8, 'good': +5, 'excellent': +8}
            base_score += penalty_map.get(level, 0)
        
        sugar = nutrients.get('sugars_100g', 0)
        if sugar:
            level = self._evaluate_nutrient_level('sugars_100g', sugar)
            penalty_map = {'terrible': -30, 'poor': -20, 'fair': -10, 'good': +3, 'excellent': +5}
            base_score += penalty_map.get(level, 0)
        
        sat_fat = nutrients.get('saturated_fat_100g', 0)
        if sat_fat:
            level = self._evaluate_nutrient_level('saturated_fat_100g', sat_fat)
            penalty_map = {'terrible': -20, 'poor': -12, 'fair': -6, 'good': +3, 'excellent': +5}
            base_score += penalty_map.get(level, 0)
        
        sodium = nutrients.get('sodium_100g', 0) or (nutrients.get('salt_100g', 0) * 0.4 if nutrients.get('salt_100g') else 0)
        if sodium:
            level = self._evaluate_nutrient_level('sodium_100g', sodium)
            penalty_map = {'terrible': -25, 'poor': -15, 'fair': -8, 'good': +3, 'excellent': +5}
            base_score += penalty_map.get(level, 0)
        
        # Positive factors (enhanced rewards)
        fiber = nutrients.get('fiber_100g', 0)
        if fiber:
            level = self._evaluate_nutrient_level('fiber_100g', fiber)
            bonus_map = {'excellent': +25, 'good': +15, 'fair': +8, 'poor': -3, 'terrible': -5}
            base_score += bonus_map.get(level, 0)
        
        protein = nutrients.get('proteins_100g', 0)
        if protein:
            level = self._evaluate_nutrient_level('proteins_100g', protein)
            bonus_map = {'excellent': +20, 'good': +12, 'fair': +6, 'poor': -2, 'terrible': -4}
            base_score += bonus_map.get(level, 0)
        
        # Additive penalties (more severe for high-risk)
        additives = ingredients_analysis.get('additives', [])
        for additive in additives:
            if additive['risk_level'] == 'high':
                base_score -= 25
            elif additive['risk_level'] == 'medium':
                base_score -= 12
            else:
                base_score -= 5
        
        # Processing level impact
        ingredient_count = ingredients_analysis.get('ingredient_count', 0)
        if ingredient_count > 20:
            base_score -= 15
        elif ingredient_count > 15:
            base_score -= 10
        elif ingredient_count > 10:
            base_score -= 5
        elif ingredient_count <= 3 and not additives:
            base_score += 15
        elif ingredient_count <= 5 and len(additives) <= 1:
            base_score += 8
        
        return max(0, min(100, base_score))

    def _evaluate_nutrient_level(self, key: str, value: float) -> str:
        """Evaluate nutrient level using thresholds"""
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

    def analyze_ingredients_enhanced(self, ingredients_text: str) -> Dict:
        """Enhanced ingredient analysis with better detection"""
        if not ingredients_text:
            return {'additives': [], 'quality_score': 50, 'warnings': [], 'ingredient_count': 0}
        
        ingredients_lower = ingredients_text.lower()
        found_additives = []
        warnings = []
        
        # Enhanced E-number and additive detection
        for code, info in self.harmful_additives.items():
            # Check for E-number
            if code.lower() in ingredients_lower:
                found_additives.append({
                    'code': code,
                    'name': info['name'],
                    'risk_level': info['risk'],
                    'effects': info['effects']
                })
            # Check for chemical name
            elif info['name'].lower() in ingredients_lower:
                found_additives.append({
                    'code': code,
                    'name': info['name'],
                    'risk_level': info['risk'],
                    'effects': info['effects']
                })
        
        # Enhanced problematic ingredient detection
        problematic_ingredients = {
            'high fructose corn syrup': ('high', 'Linked to obesity and diabetes'),
            'partially hydrogenated': ('high', 'Contains trans fats'),
            'trans fat': ('high', 'Harmful to heart health'),
            'artificial flavor': ('medium', 'Synthetic flavoring'),
            'artificial color': ('medium', 'Synthetic coloring'),
            'palm oil': ('medium', 'Environmental and health concerns'),
            'corn syrup': ('medium', 'High sugar content'),
            'maltodextrin': ('medium', 'Highly processed sweetener'),
            'modified corn starch': ('low', 'Processed ingredient'),
            'natural flavor': ('low', 'Undefined flavoring'),
            'caramel color': ('medium', 'May contain carcinogens'),
            'phosphoric acid': ('medium', 'May affect bone health'),
            'sodium nitrite': ('high', 'Preservative linked to cancer'),
            'sodium nitrate': ('high', 'Preservative linked to cancer'),
            'carrageenan': ('medium', 'May cause digestive issues'),
            'titanium dioxide': ('medium', 'Whitening agent with health concerns')
        }
        
        for ingredient, (risk, description) in problematic_ingredients.items():
            if ingredient in ingredients_lower:
                warnings.append(f"Contains {ingredient}: {description}")
                if ingredient not in [a['name'].lower() for a in found_additives]:
                    found_additives.append({
                        'code': 'N/A',
                        'name': ingredient.title(),
                        'risk_level': risk,
                        'effects': [description]
                    })
        
        # Calculate enhanced quality score
        quality_score = 100
        
        # Heavy penalties for high-risk additives
        for additive in found_additives:
            if additive['risk_level'] == 'high':
                quality_score -= 30
            elif additive['risk_level'] == 'medium':
                quality_score -= 18
            else:
                quality_score -= 10
        
        # Count ingredients more accurately
        ingredient_list = [i.strip() for i in ingredients_text.split(',') if i.strip()]
        ingredient_count = len(ingredient_list)
        
        # Penalties for long ingredient lists (ultra-processed foods)
        if ingredient_count > 25:
            quality_score -= 25
        elif ingredient_count > 20:
            quality_score -= 20
        elif ingredient_count > 15:
            quality_score -= 15
        elif ingredient_count > 10:
            quality_score -= 10
        elif ingredient_count > 5:
            quality_score -= 5
        
        # Bonus for very clean products
        if ingredient_count <= 3 and not found_additives:
            quality_score += 15
        elif ingredient_count <= 5 and len([a for a in found_additives if a['risk_level'] == 'high']) == 0:
            quality_score += 10
        
        quality_score = max(0, min(100, quality_score))
        
        return {
            'additives': found_additives,
            'quality_score': quality_score,
            'warnings': warnings,
            'ingredient_count': ingredient_count,
            'processing_level': self._determine_processing_level(ingredient_count, found_additives)
        }

    def _determine_processing_level(self, ingredient_count: int, additives: List[Dict]) -> str:
        """Determine food processing level"""
        high_risk_additives = len([a for a in additives if a['risk_level'] == 'high'])
        
        if ingredient_count <= 3 and not additives:
            return 'minimally_processed'
        elif ingredient_count <= 5 and high_risk_additives == 0:
            return 'processed'
        elif ingredient_count <= 10 and high_risk_additives <= 1:
            return 'highly_processed'
        else:
            return 'ultra_processed'

# Initialize the intelligent analyzer
intelligent_analyzer = IntelligentFoodAnalyzer()

@food_scanner_bp.route('/product/<barcode>', methods=['GET'])
def get_product_info_intelligent(barcode):
    """Get product information with intelligent analysis"""
    try:
        # Validate barcode
        if not barcode or not barcode.isdigit():
            return jsonify({'error': 'Invalid barcode format'}), 400
        
        # Query OpenFoodFacts API with enhanced fields
        url = f"https://world.openfoodfacts.org/api/v0/product/{barcode}.json"
        headers = {
            'User-Agent': 'PlateMate-IntelligentScanner/2.0 (platemate-app@example.com)'
        }
        
        response = requests.get(url, headers=headers, timeout=15)
        response.raise_for_status()
        
        data = response.json()
        
        if data.get('status') != 1:
            return jsonify({'error': 'Product not found'}), 404
        
        product = data['product']
        
        # Get INTELLIGENT serving size
        serving_info = intelligent_analyzer.extract_serving_size_intelligent(product)
        serving_size = serving_info['serving_size']
        
        # Enhanced ingredient analysis
        ingredients_text = product.get('ingredients_text', '')
        ingredients_analysis = intelligent_analyzer.analyze_ingredients_enhanced(ingredients_text)
        
        # Clean nutrient data
        clean_nutrients = {}
        for key, value in product.get('nutriments', {}).items():
            if key.endswith('_100g') and value is not None:
                try:
                    clean_nutrients[key] = float(value)
                except (ValueError, TypeError):
                    clean_nutrients[key] = None
        
        # Ensure sodium calculation
        if not clean_nutrients.get('sodium_100g') and clean_nutrients.get('salt_100g'):
            clean_nutrients['sodium_100g'] = clean_nutrients['salt_100g'] * 0.4
        
        # Calculate enhanced health score
        health_score = intelligent_analyzer.calculate_health_score_enhanced(
            clean_nutrients, ingredients_analysis
        )
        
        # Enhanced Nutri-Score calculation
        nutri_score = intelligent_analyzer._calculate_nutri_score_enhanced(clean_nutrients)
        
        # Generate detailed recommendations
        recommendations = intelligent_analyzer._generate_enhanced_recommendations(
            clean_nutrients, ingredients_analysis, health_score, serving_size
        )
        
        # Prepare comprehensive response
        result = {
            'barcode': barcode,
            'product_name': product.get('product_name', 'Unknown Product'),
            'brands': product.get('brands', ''),
            'categories': product.get('categories', ''),
            'ingredients_text': ingredients_text,
            'image_url': product.get('image_url', ''),
            
            # Enhanced serving size information
            'serving_size': serving_size,
            'serving_info': serving_info,
            
            'nutri_score': nutri_score,
            'ingredients_analysis': ingredients_analysis,
            'nutriments': clean_nutrients,
            'health_score': health_score,
            'recommendations': recommendations,
            
            'quality_indicators': {
                'processing_level': ingredients_analysis.get('processing_level', 'unknown'),
                'is_ultra_processed': ingredients_analysis.get('processing_level') == 'ultra_processed',
                'has_high_risk_additives': len([a for a in ingredients_analysis.get('additives', []) if a['risk_level'] == 'high']) > 0,
                'additive_count': len(ingredients_analysis.get('additives', [])),
                'ingredient_count': ingredients_analysis.get('ingredient_count', 0),
                'overall_quality': (
                    'excellent' if health_score >= 80 else
                    'good' if health_score >= 65 else
                    'fair' if health_score >= 45 else
                    'poor'
                ),
                'serving_confidence': serving_info['confidence']
            },
            
            'nutrition_per_serving': intelligent_analyzer._calculate_per_serving_nutrition(
                clean_nutrients, serving_size
            )
        }
        
        return jsonify(result)
    
    except requests.exceptions.RequestException as e:
        logger.error(f"API request failed: {e}")
        return jsonify({'error': 'Failed to fetch product data'}), 500
    
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        return jsonify({'error': 'Internal server error'}), 500

# Add remaining methods to IntelligentFoodAnalyzer class
def _calculate_nutri_score_enhanced(self, nutrients: Dict) -> Dict:
    """Enhanced Nutri-Score calculation"""
    # Implementation of standard Nutri-Score algorithm
    # [Previous nutri-score calculation code would go here]
    return {'score': 0, 'grade': 'Unknown', 'points': 0}

def _generate_enhanced_recommendations(self, nutrients: Dict, ingredients_analysis: Dict, health_score: int, serving_size: float) -> List[str]:
    """Generate enhanced, personalized recommendations"""
    recommendations = []
    
    # Overall assessment
    if health_score >= 80:
        recommendations.append("🌟 Excellent nutritional choice! This product supports a healthy diet.")
    elif health_score >= 65:
        recommendations.append("✅ Good nutritional quality. Enjoy as part of a balanced diet.")
    elif health_score >= 45:
        recommendations.append("⚠️ Moderate nutritional quality. Consider healthier alternatives when possible.")
    else:
        recommendations.append("❌ Poor nutritional quality. Limit consumption and seek healthier options.")
    
    # Specific nutrient guidance with serving context
    sugar = nutrients.get('sugars_100g', 0)
    if sugar:
        sugar_per_serving = (sugar * serving_size / 100)
        if sugar_per_serving > 15:
            recommendations.append(f"🍭 Very high sugar: {sugar_per_serving:.1f}g per serving (limit intake)")
        elif sugar_per_serving > 8:
            recommendations.append(f"🍯 High sugar: {sugar_per_serving:.1f}g per serving (consume in moderation)")
    
    # Processing level warnings
    processing_level = ingredients_analysis.get('processing_level', '')
    if processing_level == 'ultra_processed':
        recommendations.append("🏭 Ultra-processed food - high in additives and low in nutrients")
    elif processing_level == 'highly_processed':
        recommendations.append("⚙️ Highly processed - choose whole foods when possible")
    
    return recommendations

def _calculate_per_serving_nutrition(self, nutrients: Dict, serving_size: float) -> Dict:
    """Calculate nutrition values per serving"""
    per_serving = {}
    
    for key, value in nutrients.items():
        if key.endswith('_100g') and value is not None:
            try:
                base_key = key.replace('_100g', '')
                per_serving_value = (float(value) * serving_size / 100)
                
                # Round appropriately based on value
                if per_serving_value >= 10:
                    per_serving[f'{base_key}_serving'] = round(per_serving_value, 1)
                else:
                    per_serving[f'{base_key}_serving'] = round(per_serving_value, 2)
                    
            except (ValueError, TypeError):
                continue
    
    return per_serving

# Add these methods to the IntelligentFoodAnalyzer class
IntelligentFoodAnalyzer._calculate_nutri_score_enhanced = _calculate_nutri_score_enhanced
IntelligentFoodAnalyzer._generate_enhanced_recommendations = _generate_enhanced_recommendations
IntelligentFoodAnalyzer._calculate_per_serving_nutrition = _calculate_per_serving_nutrition

@food_scanner_bp.route('/search/<query>', methods=['GET'])
def search_products_intelligent(query):
    """Intelligent product search with enhanced filtering and relevance"""
    try:
        page_size = request.args.get('page_size', 15, type=int)
        page_size = min(page_size, 50)  # Cap at 50 results
        
        # Use intelligent search
        products = intelligent_analyzer.search_products_intelligent(query, page_size)
        
        return jsonify({
            'products': products,
            'query': query,
            'total_results': len(products),
            'search_quality': 'intelligent_filtered'
        })
    
    except Exception as e:
        logger.error(f"Intelligent search error: {e}")
        return jsonify({'error': 'Search failed'}), 500

@food_scanner_bp.route('/serving-size-debug/<barcode>', methods=['GET'])
def debug_serving_size_intelligent(barcode):
    """Debug endpoint for intelligent serving size extraction"""
    try:
        # Query OpenFoodFacts API
        url = f"https://world.openfoodfacts.org/api/v0/product/{barcode}.json"
        headers = {
            'User-Agent': 'PlateMate-IntelligentScanner/2.0 (platemate-app@example.com)'
        }
        
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        
        data = response.json()
        
        if data.get('status') != 1:
            return jsonify({'error': 'Product not found'}), 404
        
        product = data['product']
        
        # Get all serving-related data
        serving_fields = {
            'serving_size': product.get('serving_size'),
            'serving_quantity': product.get('serving_quantity'),
            'quantity': product.get('quantity'),
            'product_quantity': product.get('product_quantity'),
        }
        
        # Test parsing methods
        parsing_tests = {}
        
        # Test serving_size parsing
        if product.get('serving_size'):
            parsing_tests['serving_size_parsed'] = intelligent_analyzer._parse_serving_string_enhanced(
                product.get('serving_size')
            )
        
        # Test quantity parsing
        if product.get('quantity'):
            parsing_tests['quantity_parsed'] = intelligent_analyzer._parse_serving_string_enhanced(
                product.get('quantity')
            )
        
        # Test nutrient ratio calculation
        parsing_tests['nutrient_ratio_calc'] = intelligent_analyzer._calculate_from_nutrient_ratios(
            product.get('nutriments', {})
        )
        
        # Test category matching
        parsing_tests['category_match'] = intelligent_analyzer._get_serving_from_categories_enhanced(
            product.get('categories', ''), product.get('product_name', '')
        )
        
        # Get final intelligent result
        final_result = intelligent_analyzer.extract_serving_size_intelligent(product)
        
        # Analyze product characteristics
        characteristics = {
            'product_name': product.get('product_name'),
            'brands': product.get('brands'),
            'categories': product.get('categories'),
            'countries': product.get('countries'),
            'is_likely_single_serve': intelligent_analyzer._is_likely_single_serve(
                product.get('product_name', ''), product.get('categories', '')
            ),
            'is_likely_foreign': intelligent_analyzer._is_likely_foreign(
                product.get('product_name', '')
            )
        }
        
        return jsonify({
            'barcode': barcode,
            'characteristics': characteristics,
            'raw_serving_fields': serving_fields,
            'parsing_tests': parsing_tests,
            'final_intelligent_result': final_result,
            'nutriments_sample': {
                k: v for k, v in product.get('nutriments', {}).items()
                if '_serving' in k or '_100g' in k
            }
        })
    
    except Exception as e:
        logger.error(f"Debug serving size error: {e}")
        return jsonify({'error': f'Debug failed: {str(e)}'}), 500

@food_scanner_bp.route('/batch-analyze', methods=['POST'])
def batch_analyze_products():
    """Analyze multiple products at once"""
    try:
        data = request.get_json()
        barcodes = data.get('barcodes', [])
        
        if not barcodes or len(barcodes) > 10:
            return jsonify({'error': 'Provide 1-10 barcodes'}), 400
        
        results = []
        for barcode in barcodes:
            try:
                # Get basic product info
                url = f"https://world.openfoodfacts.org/api/v0/product/{barcode}.json"
                headers = {
                    'User-Agent': 'PlateMate-IntelligentScanner/2.0 (platemate-app@example.com)'
                }
                
                response = requests.get(url, headers=headers, timeout=5)
                if response.status_code == 200:
                    product_data = response.json()
                    if product_data.get('status') == 1:
                        product = product_data['product']
                        
                        # Quick analysis
                        serving_info = intelligent_analyzer.extract_serving_size_intelligent(product)
                        health_score = intelligent_analyzer._quick_health_assessment(product)
                        
                        results.append({
                            'barcode': barcode,
                            'product_name': product.get('product_name', 'Unknown'),
                            'brands': product.get('brands', ''),
                            'serving_size': serving_info['serving_size'],
                            'health_score': health_score,
                            'nutriscore_grade': product.get('nutriscore_grade', '').upper(),
                            'status': 'success'
                        })
                    else:
                        results.append({
                            'barcode': barcode,
                            'status': 'not_found'
                        })
                else:
                    results.append({
                        'barcode': barcode,
                        'status': 'error'
                    })
            except Exception as e:
                results.append({
                    'barcode': barcode,
                    'status': 'error',
                    'error': str(e)
                })
        
        return jsonify({
            'results': results,
            'processed': len(results),
            'successful': len([r for r in results if r.get('status') == 'success'])
        })
    
    except Exception as e:
        logger.error(f"Batch analyze error: {e}")
        return jsonify({'error': 'Batch analysis failed'}), 500

@food_scanner_bp.route('/compare', methods=['POST'])
def compare_products():
    """Compare multiple products side by side"""
    try:
        data = request.get_json()
        barcodes = data.get('barcodes', [])
        
        if not barcodes or len(barcodes) > 5:
            return jsonify({'error': 'Provide 2-5 barcodes for comparison'}), 400
        
        products = []
        for barcode in barcodes:
            try:
                url = f"https://world.openfoodfacts.org/api/v0/product/{barcode}.json"
                headers = {
                    'User-Agent': 'PlateMate-IntelligentScanner/2.0 (platemate-app@example.com)'
                }
                
                response = requests.get(url, headers=headers, timeout=10)
                if response.status_code == 200:
                    product_data = response.json()
                    if product_data.get('status') == 1:
                        product = product_data['product']
                        
                        # Full analysis for comparison
                        serving_info = intelligent_analyzer.extract_serving_size_intelligent(product)
                        ingredients_analysis = intelligent_analyzer.analyze_ingredients_enhanced(
                            product.get('ingredients_text', '')
                        )
                        
                        # Clean nutrients
                        nutrients = {}
                        for key, value in product.get('nutriments', {}).items():
                            if key.endswith('_100g') and value is not None:
                                try:
                                    nutrients[key] = float(value)
                                except (ValueError, TypeError):
                                    pass
                        
                        health_score = intelligent_analyzer.calculate_health_score_enhanced(
                            nutrients, ingredients_analysis
                        )
                        
                        # Calculate per serving nutrition
                        per_serving = intelligent_analyzer._calculate_per_serving_nutrition(
                            nutrients, serving_info['serving_size']
                        )
                        
                        products.append({
                            'barcode': barcode,
                            'product_name': product.get('product_name', 'Unknown'),
                            'brands': product.get('brands', ''),
                            'image_url': product.get('image_url', ''),
                            'serving_size': serving_info['serving_size'],
                            'health_score': health_score,
                            'nutriscore_grade': product.get('nutriscore_grade', '').upper(),
                            'nutrients_per_100g': nutrients,
                            'nutrients_per_serving': per_serving,
                            'additives_count': len(ingredients_analysis.get('additives', [])),
                            'processing_level': ingredients_analysis.get('processing_level', 'unknown'),
                            'ingredient_count': ingredients_analysis.get('ingredient_count', 0)
                        })
            except Exception as e:
                logger.error(f"Error processing barcode {barcode}: {e}")
                continue
        
        if len(products) < 2:
            return jsonify({'error': 'Need at least 2 valid products for comparison'}), 400
        
        # Generate comparison insights
        comparison_insights = []
        
        # Health score comparison
        best_health = max(products, key=lambda p: p['health_score'])
        worst_health = min(products, key=lambda p: p['health_score'])
        if best_health['health_score'] != worst_health['health_score']:
            comparison_insights.append(
                f"{best_health['product_name']} has the best health score ({best_health['health_score']}) "
                f"vs {worst_health['product_name']} ({worst_health['health_score']})"
            )
        
        # Calorie comparison (per serving)
        calorie_data = [(p, p['nutrients_per_serving'].get('energy-kcal_serving', 0)) for p in products]
        calorie_data = [(p, c) for p, c in calorie_data if c > 0]
        if calorie_data:
            lowest_cal = min(calorie_data, key=lambda x: x[1])
            highest_cal = max(calorie_data, key=lambda x: x[1])
            if lowest_cal[1] != highest_cal[1]:
                comparison_insights.append(
                    f"Calories per serving: {lowest_cal[0]['product_name']} ({lowest_cal[1]:.0f}) "
                    f"vs {highest_cal[0]['product_name']} ({highest_cal[1]:.0f})"
                )
        
        # Processing level comparison
        processing_levels = {'minimally_processed': 4, 'processed': 3, 'highly_processed': 2, 'ultra_processed': 1}
        best_processing = max(products, key=lambda p: processing_levels.get(p['processing_level'], 0))
        comparison_insights.append(f"{best_processing['product_name']} is the least processed option")
        
        return jsonify({
            'products': products,
            'comparison_insights': comparison_insights,
            'winner': best_health['product_name'],
            'total_compared': len(products)
        })
    
    except Exception as e:
        logger.error(f"Product comparison error: {e}")
        return jsonify({'error': 'Comparison failed'}), 500

@food_scanner_bp.route('/health', methods=['GET'])
def health_check_intelligent():
    """Health check for intelligent food scanner"""
    return jsonify({
        'status': 'healthy',
        'message': 'Intelligent Food Scanner API v2.0',
        'features': [
            'Ultra-accurate serving size extraction (8-step process)',
            'Brand-specific serving size database',
            'Enhanced unit conversion and parsing',
            'Intelligent search with relevance scoring',
            'Foreign product filtering',
            'Enhanced health scoring algorithm',
            'Processing level detection',
            'Batch analysis capabilities',
            'Product comparison tools',
            'Comprehensive nutrient analysis'
        ],
        'serving_size_methods': [
            'brand_specific_database',
            'enhanced_field_parsing',
            'nutrient_ratio_calculation',
            'category_intelligent_matching',
            'package_size_analysis',
            'energy_density_estimation',
            'context_aware_fallback'
        ],
        'search_improvements': [
            'relevance_scoring',
            'foreign_product_filtering',
            'english_market_preference',
            'quality_filtering',
            'variant_search_strategies'
        ]
    })

@food_scanner_bp.route('/categories', methods=['GET'])
def get_serving_categories():
    """Get all available serving size categories"""
    return jsonify({
        'categories': list(intelligent_analyzer.serving_size_database.keys()),
        'total_categories': len(intelligent_analyzer.serving_size_database),
        'brand_specific': list(intelligent_analyzer.brand_specific_servings.keys()),
        'example_usage': 'Use these categories to understand how serving sizes are determined'
    })

def init_intelligent_food_scanner_routes(app):
    """Initialize intelligent food scanner routes"""
    app.register_blueprint(food_scanner_bp, url_prefix='/api/food-scanner')from flask import Blueprint, request, jsonify
import requests
import re
from typing import Dict, List, Optional, Tuple
import logging
from difflib import SequenceMatcher
import json

# Configure logging
logger = logging.getLogger(__name__)

# Create blueprint for food scanner routes
food_scanner_bp = Blueprint('food_scanner', __name__)

class IntelligentFoodAnalyzer:
    def __init__(self):
        # Comprehensive serving size database with precise measurements
        self.serving_size_database = {
            # Beverages (ml to g conversion, most liquids ~1g/ml)
            'soft-drinks': 355, 'sodas': 355, 'cola': 355, 'carbonated-drinks': 355,
            'energy-drinks': 250, 'sports-drinks': 355, 'fruit-juices': 240,
            'orange-juice': 240, 'apple-juice': 240, 'cranberry-juice': 240,
            'vegetable-juices': 240, 'tomato-juice': 240, 'smoothies': 240,
            'milk': 240, 'dairy-milk': 240, 'whole-milk': 240, 'skim-milk': 240,
            'almond-milk': 240, 'soy-milk': 240, 'oat-milk': 240, 'coconut-milk': 240,
            'water': 240, 'sparkling-water': 240, 'mineral-water': 240,
            'coffee': 240, 'tea': 240, 'iced-tea': 240, 'green-tea': 240,
            'wine': 150, 'beer': 355, 'kombucha': 240,
            
            # Dairy & Refrigerated (precise gram measurements)
            'yogurt': 170, 'greek-yogurt': 170, 'plain-yogurt': 170, 'fruit-yogurt': 170,
            'cheese': 28, 'cheddar-cheese': 28, 'mozzarella-cheese': 28, 'swiss-cheese': 28,
            'parmesan-cheese': 28, 'cream-cheese': 28, 'cottage-cheese': 113,
            'ricotta-cheese': 60, 'feta-cheese': 28, 'goat-cheese': 28,
            'ice-cream': 65, 'frozen-yogurt': 65, 'gelato': 65, 'sorbet': 65,
            'butter': 14, 'margarine': 14, 'ghee': 14,
            
            # Spreads & Condiments (tablespoon/teaspoon based)
            'peanut-butter': 32, 'almond-butter': 32, 'cashew-butter': 32, 'sunflower-seed-butter': 32,
            'nutella': 20, 'chocolate-spread': 20, 'hazelnut-spread': 20,
            'jam': 20, 'jelly': 20, 'preserve': 20, 'marmalade': 20,
            'honey': 21, 'maple-syrup': 20, 'agave-nectar': 21, 'corn-syrup': 20,
            'mayonnaise': 15, 'mustard': 5, 'ketchup': 17, 'bbq-sauce': 17,
            'hot-sauce': 5, 'sriracha': 5, 'tabasco': 5, 'soy-sauce': 6,
            'worcestershire-sauce': 5, 'fish-sauce': 6, 'oyster-sauce': 6,
            'ranch-dressing': 30, 'italian-dressing': 30, 'caesar-dressing': 30,
            'hummus': 30, 'tahini': 16, 'salsa': 30, 'guacamole': 30,
            
            # Breakfast & Cereals (bowl-based servings)
            'cereal': 40, 'breakfast-cereal': 40, 'corn-flakes': 30, 'cheerios': 28,
            'granola': 55, 'muesli': 45, 'oatmeal': 40, 'instant-oatmeal': 40,
            'quinoa-flakes': 40, 'rice-cereal': 30, 'bran-flakes': 30,
            'frosted-flakes': 30, 'fruit-loops': 30, 'lucky-charms': 30,
            
            # Snacks (standard package/handful sizes)
            'potato-chips': 28, 'corn-chips': 28, 'tortilla-chips': 28, 'pretzels': 30,
            'popcorn': 25, 'rice-cakes': 9, 'crackers': 30, 'graham-crackers': 30,
            'cookies': 30, 'chocolate-chip-cookies': 30, 'oreos': 34, 'sandwich-cookies': 30,
            'granola-bars': 35, 'protein-bars': 45, 'energy-bars': 40, 'nutrition-bars': 40,
            'candy-bars': 45, 'chocolate-bars': 40, 'snickers': 52, 'mars-bar': 47,
            'nuts': 28, 'almonds': 28, 'peanuts': 28, 'cashews': 28, 'walnuts': 28,
            'mixed-nuts': 28, 'trail-mix': 28, 'sunflower-seeds': 28, 'pumpkin-seeds': 28,
            'jerky': 14, 'beef-jerky': 14, 'turkey-jerky': 14,
            
            # Candy & Sweets (appropriate portion sizes)
            'chocolate': 40, 'dark-chocolate': 40, 'milk-chocolate': 40, 'white-chocolate': 40,
            'gummy-candy': 30, 'gummy-bears': 30, 'fruit-gummies': 30,
            'hard-candy': 15, 'lollipop': 15, 'candy-cane': 15, 'mints': 2,
            
            # Staples & Grains (cooked portions)
            'bread': 28, 'white-bread': 28, 'whole-wheat-bread': 28, 'sourdough': 28,
            'bagel': 85, 'english-muffin': 60, 'croissant': 60, 'muffin': 60,
            'tortilla': 45, 'wrap': 45, 'pita-bread': 30, 'naan': 60,
            'pasta': 85, 'spaghetti': 85, 'penne': 85, 'macaroni': 85, 'noodles': 85,
            'rice': 80, 'brown-rice': 80, 'white-rice': 80, 'wild-rice': 80,
            'quinoa': 80, 'couscous': 80, 'bulgur': 80, 'barley': 80,
            'oats': 40, 'rolled-oats': 40, 'steel-cut-oats': 40,
            
            # Oils & Fats (tablespoon based)
            'olive-oil': 14, 'vegetable-oil': 14, 'canola-oil': 14, 'coconut-oil': 14,
            'avocado-oil': 14, 'sesame-oil': 14, 'sunflower-oil': 14,
            
            # Prepared Foods (meal portions)
            'soup': 245, 'canned-soup': 245, 'instant-soup': 245, 'broth': 240,
            'frozen-meal': 280, 'tv-dinner': 280, 'ready-meal': 280,
            'pizza': 120, 'frozen-pizza': 120, 'pizza-slice': 120,
            'sandwich': 150, 'burger': 150, 'hot-dog': 150,
            'salad': 85, 'caesar-salad': 85, 'greek-salad': 85, 'garden-salad': 85,
            
            # Fruits (medium fruit or cup serving)
            'apple': 182, 'banana': 118, 'orange': 154, 'pear': 178, 'peach': 150,
            'strawberry': 150, 'blueberry': 148, 'raspberry': 123, 'blackberry': 144,
            'grape': 92, 'cherry': 138, 'plum': 66, 'apricot': 35,
            'mango': 165, 'pineapple': 155, 'kiwi': 69, 'avocado': 150,
            
            # Vegetables (cup serving or medium piece)
            'broccoli': 91, 'cauliflower': 100, 'carrot': 61, 'celery': 101,
            'cucumber': 119, 'tomato': 149, 'bell-pepper': 119, 'onion': 115,
            'potato': 148, 'sweet-potato': 128, 'corn': 145, 'peas': 145,
            'green-beans': 125, 'asparagus': 134, 'spinach': 30, 'lettuce': 36,
            'cabbage': 89, 'kale': 67, 'brussels-sprouts': 88,
        }
        
        # Brand-specific serving sizes for accuracy
        self.brand_specific_servings = {
            'coca-cola': {'standard': 355, 'mini': 237, 'bottle': 500},
            'pepsi': {'standard': 355, 'mini': 237, 'bottle': 500},
            'red-bull': {'standard': 250, 'large': 355},
            'monster': {'standard': 473, 'mini': 237},
            'gatorade': {'standard': 591, 'bottle': 355},
            'powerade': {'standard': 591, 'bottle': 355},
            'vitamin-water': {'standard': 591},
            'snapple': {'standard': 473},
            'arizona': {'standard': 680, 'can': 340},
        }
        
        # Enhanced harmful additives database
        self.harmful_additives = {
            # High Risk Preservatives
            'E220': {'name': 'Sulfur dioxide', 'risk': 'high', 'effects': ['respiratory issues', 'allergies', 'asthma']},
            'E221': {'name': 'Sodium sulfite', 'risk': 'high', 'effects': ['allergies', 'asthma', 'headaches']},
            'E249': {'name': 'Potassium nitrite', 'risk': 'high', 'effects': ['cancer risk', 'blood issues', 'headaches']},
            'E250': {'name': 'Sodium nitrite', 'risk': 'high', 'effects': ['cancer risk', 'blood issues', 'digestive issues']},
            'E251': {'name': 'Sodium nitrate', 'risk': 'high', 'effects': ['cancer risk', 'digestive issues', 'blood pressure']},
            'E252': {'name': 'Potassium nitrate', 'risk': 'high', 'effects': ['cancer risk', 'blood pressure', 'kidney issues']},
            'E320': {'name': 'BHA', 'risk': 'high', 'effects': ['cancer risk', 'endocrine disruption', 'liver damage']},
            'E321': {'name': 'BHT', 'risk': 'high', 'effects': ['cancer risk', 'liver damage', 'kidney issues']},
            'E952': {'name': 'Cyclamate', 'risk': 'high', 'effects': ['cancer risk', 'bladder issues']},
            
            # Medium Risk Additives
            'E102': {'name': 'Tartrazine', 'risk': 'medium', 'effects': ['hyperactivity', 'allergies', 'asthma']},
            'E110': {'name': 'Sunset Yellow', 'risk': 'medium', 'effects': ['hyperactivity', 'allergies', 'attention issues']},
            'E122': {'name': 'Carmoisine', 'risk': 'medium', 'effects': ['hyperactivity', 'potential cancer risk']},
            'E124': {'name': 'Ponceau 4R', 'risk': 'medium', 'effects': ['hyperactivity', 'allergies', 'skin reactions']},
            'E129': {'name': 'Allura Red', 'risk': 'medium', 'effects': ['hyperactivity', 'potential cancer risk']},
            'E210': {'name': 'Benzoic acid', 'risk': 'medium', 'effects': ['allergies', 'hyperactivity', 'asthma']},
            'E211': {'name': 'Sodium benzoate', 'risk': 'medium', 'effects': ['hyperactivity', 'allergies', 'DNA damage']},
            'E433': {'name': 'Polysorbate 80', 'risk': 'medium', 'effects': ['digestive issues', 'inflammation', 'gut bacteria']},
            'E472e': {'name': 'DATEM', 'risk': 'medium', 'effects': ['heart issues', 'digestive problems']},
            'E950': {'name': 'Acesulfame K', 'risk': 'medium', 'effects': ['potential cancer risk', 'kidney issues']},
            'E951': {'name': 'Aspartame', 'risk': 'medium', 'effects': ['headaches', 'neurological issues', 'mood changes']},
            'E954': {'name': 'Saccharin', 'risk': 'medium', 'effects': ['potential cancer risk', 'bladder issues']},
            
            # Low Risk (but still worth noting)
            'E621': {'name': 'MSG', 'risk': 'low', 'effects': ['headaches', 'nausea', 'flushing']},
            'E955': {'name': 'Sucralose', 'risk': 'low', 'effects': ['digestive issues', 'gut bacteria']},
            'E133': {'name': 'Brilliant Blue', 'risk': 'low', 'effects': ['allergies', 'hyperactivity']},
            'E471': {'name': 'Mono- and diglycerides', 'risk': 'low', 'effects': ['trans fats', 'heart health']},
        }
        
        # Strict nutritional thresholds (per 100g) for accurate health scoring
        self.nutrition_thresholds = {
            'energy_kcal_100g': {'excellent': 120, 'good': 200, 'fair': 300, 'poor': 450, 'terrible': 600},
            'fat_100g': {'excellent': 2, 'good': 8, 'fair': 15, 'poor': 22, 'terrible': 30},
            'saturated_fat_100g': {'excellent': 1, 'good': 2.5, 'fair': 4, 'poor': 6, 'terrible': 10},
            'sugars_100g': {'excellent': 3, 'good': 8, 'fair': 15, 'poor': 25, 'terrible': 40},
            'salt_100g': {'excellent': 0.2, 'good': 0.5, 'fair': 1.0, 'poor': 1.8, 'terrible': 2.5},
            'sodium_100g': {'excellent': 0.08, 'good': 0.2, 'fair': 0.4, 'poor': 0.72, 'terrible': 1.0},
            'fiber_100g': {'terrible': 0.5, 'poor': 1.5, 'fair': 2.5, 'good': 5, 'excellent': 8},
            'proteins_100g': {'terrible': 1, 'poor': 3, 'fair': 6, 'good': 12, 'excellent': 20}
        }
        
        # Country codes for better search filtering (focus on US/English markets)
        self.preferred_countries = ['us', 'gb', 'ca', 'au', 'nz', 'ie']
        
        # Common English product keywords for relevance scoring
        self.english_keywords = {
            'organic', 'natural', 'fresh', 'healthy', 'lite', 'light', 'diet', 'zero',
            'low', 'reduced', 'free', 'whole', 'grain', 'wheat', 'gluten', 'dairy',
            'vegan', 'vegetarian', 'plant', 'based', 'premium', 'artisan', 'craft',
            'homestyle', 'classic', 'original', 'traditional', 'gourmet', 'select'
        }

    def extract_serving_size_intelligent(self, product: Dict) -> Dict:
        """
        Ultra-intelligent serving size extraction with multiple validation layers
        """
        product_name = product.get('product_name', '').lower()
        categories = product.get('categories', '').lower()
        brands = product.get('brands', '').lower()
        quantity = product.get('quantity', '')
        nutriments = product.get('nutriments', {})
        
        # Step 1: Brand-specific serving sizes (highest priority)
        for brand, sizes in self.brand_specific_servings.items():
            if brand in brands or brand in product_name:
                # Try to determine which size variant
                if 'mini' in product_name or 'small' in product_name:
                    serving_size = sizes.get('mini', sizes.get('standard', 355))
                elif 'large' in product_name or 'big' in product_name:
                    serving_size = sizes.get('large', sizes.get('standard', 355))
                elif 'bottle' in product_name and 'bottle' in sizes:
                    serving_size = sizes.get('bottle', sizes.get('standard', 355))
                else:
                    serving_size = sizes.get('standard', 355)
                
                return {
                    'serving_size': float(serving_size),
                    'confidence': 'very_high',
                    'source': f'brand_specific_{brand}',
                    'method': 'brand_database_match'
                }
        
        # Step 2: Parse serving_size field with enhanced regex
        serving_size_field = product.get('serving_size', '')
        if serving_size_field:
            parsed_serving = self._parse_serving_string_enhanced(serving_size_field)
            if parsed_serving and 5 <= parsed_serving <= 1000:
                return {
                    'serving_size': round(parsed_serving, 1),
                    'confidence': 'high',
                    'source': 'serving_size_field',
                    'original_value': serving_size_field,
                    'method': 'field_parsing'
                }
        
        # Step 3: Parse serving_quantity field
        serving_quantity = product.get('serving_quantity')
        if serving_quantity:
            try:
                value = float(serving_quantity)
                if 5 <= value <= 1000:
                    return {
                        'serving_size': round(value, 1),
                        'confidence': 'high',
                        'source': 'serving_quantity_field',
                        'method': 'direct_quantity'
                    }
            except (ValueError, TypeError):
                pass
        
        # Step 4: Calculate from nutrient ratios (serving vs 100g)
        serving_calc = self._calculate_from_nutrient_ratios(nutriments)
        if serving_calc:
            return serving_calc
        
        # Step 5: Enhanced category-based matching with specificity scoring
        category_serving = self._get_serving_from_categories_enhanced(categories, product_name)
        if category_serving:
            return category_serving
        
        # Step 6: Parse quantity field for package size clues
        if quantity:
            quantity_parsed = self._parse_serving_string_enhanced(quantity)
            if quantity_parsed:
                # For single-serve items
                if 10 <= quantity_parsed <= 500 and self._is_likely_single_serve(product_name, categories):
                    return {
                        'serving_size': round(quantity_parsed, 1),
                        'confidence': 'medium',
                        'source': 'quantity_single_serve',
                        'method': 'quantity_analysis'
                    }
                # For multi-serve items, estimate serving
                elif quantity_parsed > 500:
                    estimated_serving = self._estimate_serving_from_package_size(quantity_parsed, categories)
                    if estimated_serving:
                        return {
                            'serving_size': round(estimated_serving, 1),
                            'confidence': 'medium',
                            'source': 'package_size_estimation',
                            'method': 'package_analysis'
                        }
        
        # Step 7: Energy-based estimation with category context
        energy_estimation = self._estimate_from_energy_and_category(nutriments, categories, product_name)
        if energy_estimation:
            return energy_estimation
        
        # Step 8: Intelligent fallback based on product type
        fallback_serving = self._intelligent_fallback_serving(product_name, categories, brands)
        return fallback_serving

    def _parse_serving_string_enhanced(self, serving_str: str) -> Optional[float]:
        """Enhanced serving string parsing with better unit handling"""
        if not serving_str or not isinstance(serving_str, str):
            return None
        
        serving_str = serving_str.strip().lower()
        
        # Handle parenthetical information first (often contains grams)
        paren_match = re.search(r'\(([^)]+)\)', serving_str)
        if paren_match:
            paren_content = paren_match.group(1)
            gram_in_paren = re.search(r'(\d+(?:\.\d+)?)\s*g(?:ram)?s?', paren_content)
            if gram_in_paren:
                return float(gram_in_paren.group(1))
        
        # Enhanced patterns for different formats
        patterns = [
            # Grams (highest priority)
            r'(\d+(?:\.\d+)?)\s*g(?:ram)?s?\b',
            r'(\d+(?:\.\d+)?)\s*gr\b',
            
            # Milliliters (convert to grams)
            r'(\d+(?:\.\d+)?)\s*ml\b',
            r'(\d+(?:\.\d+)?)\s*milliliters?\b',
            
            # Fluid ounces
            r'(\d+(?:\.\d+)?)\s*fl\.?\s*oz\b',
            r'(\d+(?:\.\d+)?)\s*fluid\s*ounces?\b',
            
            # Regular ounces
            r'(\d+(?:\.\d+)?)\s*oz\b',
            r'(\d+(?:\.\d+)?)\s*ounces?\b',
            
            # Cups and tablespoons
            r'(\d+(?:\.\d+)?)\s*cups?\b',
            r'(\d+(?:\.\d+)?)\s*c\b',
            r'(\d+(?:\.\d+)?)\s*tbsp\b',
            r'(\d+(?:\.\d+)?)\s*tablespoons?\b',
            r'(\d+(?:\.\d+)?)\s*tsp\b',
            r'(\d+(?:\.\d+)?)\s*teaspoons?\b',
            
            # Pieces/units
            r'(\d+(?:\.\d+)?)\s*pieces?\b',
            r'(\d+(?:\.\d+)?)\s*units?\b',
            r'(\d+(?:\.\d+)?)\s*items?\b',
            
            # Any number (last resort)
            r'(\d+(?:\.\d+)?)'
        ]
        
        for pattern in patterns:
            match = re.search(pattern, serving_str)
            if match:
                value = float(match.group(1))
                
                # Convert based on unit context
                if 'fl' in serving_str or 'fluid' in serving_str:
                    return value * 29.5735  # fl oz to ml/g
                elif 'ml' in serving_str or 'milliliter' in serving_str:
                    return value  # ml ≈ g for most liquids
                elif 'oz' in serving_str and 'fl' not in serving_str:
                    return value * 28.3495  # oz to g
                elif 'cup' in serving_str or serving_str.endswith(' c'):
                    return value * 240  # cup to g (varies by ingredient)
                elif 'tbsp' in serving_str or 'tablespoon' in serving_str:
                    return value * 15  # tbsp to g
                elif 'tsp' in serving_str or 'teaspoon' in serving_str:
                    return value * 5   # tsp to g
                elif 'g' in serving_str or 'gram' in serving_str:
                    return value
                elif 'piece' in serving_str or 'unit' in serving_str or 'item' in serving_str:
                    # For pieces, estimate based on typical food weights
                    if 1 <= value <= 5:  # 1-5 pieces
                        return value * 30  # Assume ~30g per piece
                    else:
                        return value  # If many pieces, might already be in grams
                else:
                    # Context-free number - make educated guess
                    if 5 <= value <= 1000:
                        return value  # Likely grams
                    elif 1 <= value <= 5:
                        return value * 30  # Likely pieces
                    else:
                        return None
        
        return None

    def _calculate_from_nutrient_ratios(self, nutriments: Dict) -> Optional[Dict]:
        """Calculate serving size from serving vs 100g nutrient ratios"""
        # Look for nutrients with both _serving and _100g values
        for nutrient_base in ['energy-kcal', 'proteins', 'carbohydrates', 'fat', 'sugars']:
            serving_key = f'{nutrient_base}_serving'
            per_100g_key = f'{nutrient_base}_100g'
            
            serving_value = nutriments.get(serving_key)
            per_100g_value = nutriments.get(per_100g_key)
            
            if serving_value and per_100g_value:
                try:
                    serving_val = float(serving_value)
                    per_100g_val = float(per_100g_value)
                    
                    if per_100g_val > 0 and serving_val > 0:
                        # Calculate: (serving_value / per_100g_value) * 100 = serving size in grams
                        calculated_serving = (serving_val / per_100g_val) * 100
                        
                        # Validate the result
                        if 5 <= calculated_serving <= 1000:
                            return {
                                'serving_size': round(calculated_serving, 1),
                                'confidence': 'high',
                                'source': f'nutrient_ratio_{nutrient_base}',
                                'method': 'nutrient_calculation',
                                'calculation': f'{serving_val}/{per_100g_val}*100'
                            }
                except (ValueError, TypeError, ZeroDivisionError):
                    continue
        
        return None

    def _get_serving_from_categories_enhanced(self, categories: str, product_name: str) -> Optional[Dict]:
        """Enhanced category matching with specificity scoring"""
        categories_lower = categories.lower()
        product_name_lower = product_name.lower()
        
        # Combine categories and product name for comprehensive matching
        search_text = f"{categories_lower} {product_name_lower}"
        
        # Find all matching categories and score them by specificity
        matches = []
        for category, serving_size in self.serving_size_database.items():
            if category in search_text:
                # Calculate specificity score (longer, more specific terms get higher scores)
                specificity = len(category) + (10 if category in product_name_lower else 0)
                matches.append((category, serving_size, specificity))
        
        if matches:
            # Sort by specificity (highest first)
            matches.sort(key=lambda x: x[2], reverse=True)
            best_match = matches[0]
            
            return {
                'serving_size': float(best_match[1]),
                'confidence': 'medium' if best_match[2] > 15 else 'low',
                'source': f'category_match_{best_match[0]}',
                'method': 'category_database',
                'specificity_score': best_match[2]
            }
        
        return None

    def _is_likely_single_serve(self, product_name: str, categories: str) -> bool:
        """Determine if product is likely single-serve"""
        single_serve_indicators = [
            'bottle', 'can', 'bar', 'cup', 'pack', 'serving', 'individual',
            'single', 'mini', 'snack', 'portion', 'ready-to-eat', 'drink'
        ]
        
        search_text = f"{product_name} {categories}".lower()
        return any(indicator in search_text for indicator in single_serve_indicators)

    def _estimate_serving_from_package_size(self, package_size: float, categories: str) -> Optional[float]:
        """Estimate serving size from total package size"""
        categories_lower = categories.lower()
        
        # Estimate servings per package based on category
        if any(cat in categories_lower for cat in ['cereal', 'grain', 'pasta']):
            return package_size / 12  # ~12 servings per package
        elif any(cat in categories_lower for cat in ['snack', 'chip', 'cracker']):
            return package_size / 10  # ~10 servings per package
        elif any(cat in categories_lower for cat in ['cookie', 'candy', 'chocolate']):
            return package_size / 8   # ~8 servings per package
        elif any(cat in categories_lower for cat in ['sauce', 'dressing', 'condiment']):
            return package_size / 15  # ~15 servings per package
        else:
            return package_size / 10  # Default estimate
    
    def _estimate_from_energy_and_category(self, nutriments: Dict, categories: str, product_name: str) -> Optional[Dict]:
        """Estimate serving size from energy density and product category"""
        energy = nutriments.get('energy-kcal_100g') or nutriments.get('energy_100g')
        if not energy:
            return None
        
        try:
            energy_val = float(energy)
            categories_lower = categories.lower()
            product_name_lower = product_name.lower()
            
            # Category-based calorie targets for appropriate serving
