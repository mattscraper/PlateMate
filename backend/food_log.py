from flask import request, jsonify, Blueprint
from flask_cors import cross_origin
from typing import Optional, List, Dict, Any
from dataclasses import dataclass
from datetime import datetime, date
import json
import os
import tempfile
import logging
from backend.openai_handler import RecipeGenerator
import openai

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create Blueprint for food logging routes
food_log_routes = Blueprint('food_log', __name__)

@dataclass
class FoodLogRequest:
    """Enhanced data class for validating food log requests"""
    food_description: str
    user_id: str
    meal_type: Optional[str] = "other"
    
    @classmethod
    def from_request(cls, data: dict) -> 'FoodLogRequest':
        """Create FoodLogRequest from request data with validation"""
        if not data.get("food_description", "").strip():
            raise ValueError("Food description is required and cannot be empty")
        if not data.get("user_id", "").strip():
            raise ValueError("User ID is required")
        
        valid_meal_types = ["breakfast", "lunch", "dinner", "snack", "other"]
        meal_type = data.get("meal_type", "other").lower().strip()
        if meal_type not in valid_meal_types:
            meal_type = "other"
            
        return cls(
            food_description=data["food_description"].strip(),
            user_id=data["user_id"].strip(),
            meal_type=meal_type
        )

class EnhancedFoodLogService:
    """Enhanced service for food logging with improved functionality"""
    
    def __init__(self):
        self.recipe_generator = RecipeGenerator()
        
    def estimate_nutrition(self, food_description: str) -> Dict[str, Any]:
        """Enhanced nutrition estimation with better accuracy and error handling"""
        system_prompt = """You are an expert nutritionist and dietitian. Analyze the food description and provide precise nutritional information.

        CRITICAL INSTRUCTIONS:
        - Respond with ONLY a valid JSON object in the exact format specified
        - Be accurate and conservative with estimates
        - Consider portion sizes carefully
        - Account for cooking methods and ingredients

        Required JSON format:
        {
            "food_name": "Clean, descriptive name of the food/meal",
            "calories": 450,
            "protein": 25,
            "carbs": 35,
            "fat": 15,
            "fiber": 8,
            "sugar": 12,
            "sodium": 650,
            "serving_size": "1 cup" or "1 piece" or "1 serving",
            "confidence": 0.85,
            "notes": "Brief explanation of estimation"
        }

        Rules:
        - All numeric values must be integers (except confidence which is float 0.1-1.0)
        - Serving size should be realistic and specific
        - For vague descriptions, estimate typical restaurant/home portions
        - For multiple foods, combine totals appropriately
        - Protein/carbs = 4 cal/g, fat = 9 cal/g, fiber doesn't count toward calories
        - Include cooking oils, dressings, and condiments in estimates
        - Consider preparation methods (grilled vs fried, etc.)
        - Be conservative but realistic with portion assumptions

        Examples:
        - "2 slices of pizza" → estimate for 2 typical slices (not personal pan)
        - "a bowl of cereal" → estimate for 1 standard cereal bowl with milk
        - "chicken breast with rice" → estimate typical restaurant portions
        - "salad" → ask yourself what type and include dressing estimate
        """

        try:
            response = self.recipe_generator.client.chat.completions.create(
                model="gpt-4",  # Use GPT-4 for better accuracy
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"Analyze this food: {food_description}"}
                ],
                temperature=0.2,  # Lower temperature for more consistent results
                max_tokens=300
            )
            
            nutrition_text = response.choices[0].message.content.strip()
            logger.info(f"OpenAI nutrition response: {nutrition_text}")
            
            # Parse and validate JSON response
            try:
                nutrition_data = json.loads(nutrition_text)
                
                # Validate and ensure all required fields exist
                required_fields = ["food_name", "calories", "protein", "carbs", "fat", "serving_size", "confidence"]
                for field in required_fields:
                    if field not in nutrition_data:
                        raise ValueError(f"Missing required field: {field}")
                
                # Type conversion and validation
                nutrition_data["calories"] = max(0, int(nutrition_data["calories"]))
                nutrition_data["protein"] = max(0, int(nutrition_data["protein"]))
                nutrition_data["carbs"] = max(0, int(nutrition_data["carbs"]))
                nutrition_data["fat"] = max(0, int(nutrition_data["fat"]))
                nutrition_data["fiber"] = max(0, int(nutrition_data.get("fiber", 0)))
                nutrition_data["sugar"] = max(0, int(nutrition_data.get("sugar", 0)))
                nutrition_data["sodium"] = max(0, int(nutrition_data.get("sodium", 0)))
                nutrition_data["confidence"] = max(0.1, min(1.0, float(nutrition_data["confidence"])))
                
                # Sanity check: ensure macros roughly add up to calories
                calculated_calories = (nutrition_data["protein"] * 4) + (nutrition_data["carbs"] * 4) + (nutrition_data["fat"] * 9)
                if abs(calculated_calories - nutrition_data["calories"]) > nutrition_data["calories"] * 0.3:
                    logger.warning(f"Macro calories ({calculated_calories}) don't match total calories ({nutrition_data['calories']})")
                
                return nutrition_data
                
            except (json.JSONDecodeError, ValueError, KeyError) as e:
                logger.error(f"Error parsing nutrition JSON: {e}")
                return self._get_fallback_nutrition(food_description)
            
        except Exception as e:
            logger.error(f"Error calling OpenAI for nutrition estimation: {e}")
            return self._get_fallback_nutrition(food_description)

    def _get_fallback_nutrition(self, food_description: str) -> Dict[str, Any]:
        """Provide intelligent fallback nutrition data"""
        # Simple heuristics based on common foods
        if any(word in food_description.lower() for word in ['salad', 'vegetables', 'greens']):
            base_calories = 150
        elif any(word in food_description.lower() for word in ['pizza', 'burger', 'fries']):
            base_calories = 500
        elif any(word in food_description.lower() for word in ['chicken', 'fish', 'meat']):
            base_calories = 300
        else:
            base_calories = 250
            
        return {
            "food_name": food_description.title(),
            "calories": base_calories,
            "protein": int(base_calories * 0.15 / 4),  # 15% protein
            "carbs": int(base_calories * 0.45 / 4),    # 45% carbs
            "fat": int(base_calories * 0.30 / 9),      # 30% fat
            "fiber": 3,
            "sugar": 5,
            "sodium": 400,
            "serving_size": "1 serving",
            "confidence": 0.4,
            "notes": "Estimated values - please verify"
        }

    def transcribe_audio(self, audio_file_path: str) -> Optional[str]:
        """Enhanced audio transcription with better error handling"""
        try:
            # Validate file exists and has content
            if not os.path.exists(audio_file_path):
                logger.error(f"Audio file does not exist: {audio_file_path}")
                return None
                
            file_size = os.path.getsize(audio_file_path)
            if file_size == 0:
                logger.error("Audio file is empty")
                return None
                
            # Check file size limits (Whisper has 25MB limit)
            if file_size > 25 * 1024 * 1024:  # 25MB
                logger.error(f"Audio file too large: {file_size} bytes")
                return None
            
            logger.info(f"Transcribing audio file: {audio_file_path} ({file_size} bytes)")
            
            with open(audio_file_path, "rb") as audio_file:
                # Enhanced Whisper API call with better parameters
                transcript = self.recipe_generator.client.audio.transcriptions.create(
                    model="whisper-1",
                    file=audio_file,
                    response_format="text",
                    language="en",  # Specify English for better accuracy
                    prompt="This is a description of food items, meals, or ingredients."  # Context helps accuracy
                )
                
                # Clean and validate transcription
                transcription = transcript.strip()
                logger.info(f"Raw transcription: {transcription}")
                
                # Enhanced validation
                if not transcription or len(transcription.strip()) < 3:
                    logger.warning("Transcription too short or empty")
                    return None
                
                # Remove common transcription artifacts
                transcription = self._clean_transcription(transcription)
                
                # Validate it looks like food-related content
                if self._is_food_related(transcription):
                    logger.info(f"Clean transcription: {transcription}")
                    return transcription
                else:
                    logger.warning(f"Transcription doesn't appear food-related: {transcription}")
                    return transcription  # Return anyway, let user decide
                
        except Exception as e:
            logger.error(f"Error transcribing audio: {str(e)}")
            return None

    def _clean_transcription(self, text: str) -> str:
        """Clean up common transcription issues"""
        # Remove common speech-to-text artifacts
        text = text.replace(".", "").replace(",", "").strip()
        
        # Fix common food-related transcription errors
        replacements = {
            "protien": "protein",
            "veggie": "vegetable",
            "veggies": "vegetables",
            "chiken": "chicken",
            "avacado": "avocado",
            "tomatoe": "tomato",
            "potatoe": "potato"
        }
        
        for wrong, right in replacements.items():
            text = text.replace(wrong, right)
            
        return text.strip()

    def _is_food_related(self, text: str) -> bool:
        """Check if transcription appears to be food-related"""
        food_keywords = [
            'eat', 'ate', 'food', 'meal', 'breakfast', 'lunch', 'dinner', 'snack',
            'chicken', 'beef', 'fish', 'salmon', 'turkey', 'pork',
            'rice', 'pasta', 'bread', 'quinoa', 'oats',
            'salad', 'vegetables', 'fruits', 'apple', 'banana',
            'cheese', 'milk', 'yogurt', 'eggs',
            'pizza', 'burger', 'sandwich', 'soup', 'smoothie'
        ]
        
        text_lower = text.lower()
        return any(keyword in text_lower for keyword in food_keywords)

    def generate_smart_suggestions(self, user_id: str, remaining_calories: int,
                                 remaining_protein: int, meal_type: str = "other") -> List[Dict[str, Any]]:
        """Generate intelligent meal suggestions based on remaining macros and preferences"""
        
        # Get time-appropriate suggestions
        current_hour = datetime.now().hour
        if current_hour < 10:
            suggested_meal_type = "breakfast"
        elif current_hour < 15:
            suggested_meal_type = "lunch"
        elif current_hour < 18:
            suggested_meal_type = "snack"
        else:
            suggested_meal_type = "dinner"
            
        if meal_type == "other":
            meal_type = suggested_meal_type

        system_prompt = f"""You are a nutrition expert and meal planning specialist. Generate 4-6 realistic, appealing meal suggestions.

        Requirements:
        - Target Calories: {remaining_calories}
        - Target Protein: {remaining_protein}g minimum
        - Meal Type: {meal_type}
        - Must be practical and accessible foods
        - Consider portion sizes carefully
        - Include cooking methods and preparation notes

        Respond with ONLY a JSON array of meal suggestions:
        [
            {{
                "meal_name": "Grilled Chicken & Quinoa Bowl",
                "description": "Grilled chicken breast with fluffy quinoa, roasted vegetables, and tahini dressing",
                "meal_type": "{meal_type}",
                "estimated_calories": 420,
                "estimated_protein": 35,
                "estimated_carbs": 28,
                "estimated_fat": 18,
                "estimated_fiber": 6,
                "preparation_time": "25 minutes",
                "difficulty": "Easy",
                "tags": ["high-protein", "balanced", "filling"]
            }}
        ]

        Guidelines:
        - Stay within ±50 calories of target when possible
        - Prioritize protein content
        - Include variety in ingredients and cooking methods
        - Make descriptions appetizing and specific
        - Add helpful tags for filtering
        - Consider dietary restrictions (offer some vegetarian options)
        """

        try:
            response = self.recipe_generator.client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"Generate {meal_type} suggestions for {remaining_calories} calories and {remaining_protein}g protein"}
                ],
                temperature=0.7,
                max_tokens=1200
            )
            
            suggestions_text = response.choices[0].message.content.strip()
            logger.info(f"Generated suggestions: {suggestions_text}")
            
            suggestions = json.loads(suggestions_text)
            
            # Validate and clean suggestions
            validated_suggestions = []
            for suggestion in suggestions[:6]:  # Limit to 6 suggestions
                if self._validate_suggestion(suggestion):
                    validated_suggestions.append(suggestion)
            
            return validated_suggestions

        except (json.JSONDecodeError, Exception) as e:
            logger.error(f"Error generating meal suggestions: {e}")
            return self._get_fallback_suggestions(remaining_calories, remaining_protein, meal_type)

    def _validate_suggestion(self, suggestion: dict) -> bool:
        """Validate that a meal suggestion has required fields"""
        required_fields = ["meal_name", "description", "estimated_calories", "estimated_protein"]
        return all(field in suggestion for field in required_fields)

    def _get_fallback_suggestions(self, calories: int, protein: int, meal_type: str) -> List[Dict[str, Any]]:
        """Provide fallback suggestions when AI generation fails"""
        fallback_suggestions = {
            "breakfast": [
                {
                    "meal_name": "Protein Smoothie Bowl",
                    "description": "Protein powder blended with banana, berries, and topped with granola",
                    "meal_type": "breakfast",
                    "estimated_calories": min(calories, 350),
                    "estimated_protein": min(protein, 25),
                    "estimated_carbs": 30,
                    "estimated_fat": 8,
                    "tags": ["quick", "high-protein"]
                }
            ],
            "lunch": [
                {
                    "meal_name": "Grilled Chicken Salad",
                    "description": "Mixed greens with grilled chicken, vegetables, and vinaigrette",
                    "meal_type": "lunch",
                    "estimated_calories": min(calories, 400),
                    "estimated_protein": min(protein, 30),
                    "estimated_carbs": 20,
                    "estimated_fat": 15,
                    "tags": ["light", "fresh"]
                }
            ],
            "dinner": [
                {
                    "meal_name": "Baked Salmon",
                    "description": "Herb-crusted salmon with roasted sweet potato and asparagus",
                    "meal_type": "dinner",
                    "estimated_calories": min(calories, 500),
                    "estimated_protein": min(protein, 35),
                    "estimated_carbs": 40,
                    "estimated_fat": 18,
                    "tags": ["healthy", "omega-3"]
                }
            ]
        }
        
        return fallback_suggestions.get(meal_type, fallback_suggestions["lunch"])

# Initialize service
food_log_service = EnhancedFoodLogService()

@food_log_routes.route('/api/estimate-nutrition', methods=["POST"])
@cross_origin()
def estimate_nutrition():
    """Enhanced nutrition estimation endpoint"""
    try:
        if not request.is_json:
            return jsonify({"error": "Content-Type must be application/json"}), 400

        data = request.json
        if not data:
            return jsonify({"error": "Request body cannot be empty"}), 400

        food_description = data.get("food_description", "").strip()
        
        if not food_description:
            return jsonify({"error": "food_description is required and cannot be empty"}), 400

        if len(food_description) > 500:
            return jsonify({"error": "food_description too long (max 500 characters)"}), 400

        logger.info(f"Estimating nutrition for: {food_description}")
        
        # Get enhanced nutrition estimation
        nutrition_data = food_log_service.estimate_nutrition(food_description)

        return jsonify({
            "success": True,
            "nutrition": nutrition_data,
            "message": "Nutrition estimated successfully"
        })

    except Exception as e:
        logger.error(f"Error in estimate_nutrition endpoint: {str(e)}")
        return jsonify({
            "success": False,
            "error": "Failed to estimate nutrition",
            "details": str(e) if os.getenv('DEBUG') else "Internal server error"
        }), 500

@food_log_routes.route('/api/speech-to-text', methods=["POST"])
@cross_origin()
def speech_to_text():
    """Enhanced speech-to-text endpoint with better error handling"""
    temp_audio_path = None
    
    try:
        # Validate request
        if 'audio' not in request.files:
            return jsonify({"success": False, "error": "No audio file provided"}), 400

        audio_file = request.files['audio']
        
        if not audio_file.filename:
            return jsonify({"success": False, "error": "No audio file selected"}), 400

        # Validate file type
        allowed_extensions = {'.wav', '.mp3', '.m4a', '.ogg', '.flac', '.webm'}
        file_ext = os.path.splitext(audio_file.filename)[1].lower()
        if file_ext not in allowed_extensions:
            return jsonify({
                "success": False,
                "error": f"Unsupported audio format. Supported: {', '.join(allowed_extensions)}"
            }), 400

        # Create temporary file with proper extension
        with tempfile.NamedTemporaryFile(delete=False, suffix=file_ext) as temp_audio:
            audio_file.save(temp_audio.name)
            temp_audio_path = temp_audio.name

        # Validate file size
        file_size = os.path.getsize(temp_audio_path)
        logger.info(f"Received audio file: {file_size} bytes, extension: {file_ext}")
        
        if file_size == 0:
            return jsonify({
                "success": False,
                "error": "Audio file is empty"
            }), 400

        if file_size > 25 * 1024 * 1024:  # 25MB limit
            return jsonify({
                "success": False,
                "error": "Audio file too large (max 25MB)"
            }), 400

        # Transcribe the audio
        transcription = food_log_service.transcribe_audio(temp_audio_path)
        
        if not transcription:
            return jsonify({
                "success": False,
                "error": "Could not transcribe audio. Please speak clearly and try again.",
                "suggestions": [
                    "Speak clearly and at normal pace",
                    "Ensure good audio quality",
                    "Try recording in a quiet environment",
                    "Keep recordings under 30 seconds"
                ]
            }), 400

        # Success response
        return jsonify({
            "success": True,
            "transcription": transcription,
            "message": "Audio transcribed successfully",
            "confidence": "high" if len(transcription) > 10 else "medium"
        })

    except Exception as e:
        logger.error(f"Error in speech_to_text endpoint: {str(e)}")
        return jsonify({
            "success": False,
            "error": "Failed to process audio",
            "details": str(e) if os.getenv('DEBUG') else "Internal server error"
        }), 500
    
    finally:
        # Clean up temporary file
        if temp_audio_path and os.path.exists(temp_audio_path):
            try:
                os.unlink(temp_audio_path)
                logger.info(f"Cleaned up temporary file: {temp_audio_path}")
            except OSError as e:
                logger.warning(f"Failed to delete temporary file: {e}")

@food_log_routes.route('/api/meal-suggestions', methods=["POST"])
@cross_origin()
def get_meal_suggestions():
    """Enhanced meal suggestions endpoint"""
    try:
        if not request.is_json:
            return jsonify({"error": "Content-Type must be application/json"}), 400

        data = request.json
        user_id = data.get("user_id", "")
        target_calories = max(0, int(data.get("target_calories", 0)))
        target_protein = max(0, int(data.get("target_protein", 0)))
        meal_type = data.get("meal_type", "other")

        if target_calories <= 0:
            return jsonify({"error": "target_calories must be greater than 0"}), 400

        logger.info(f"Generating suggestions for {target_calories} cal, {target_protein}g protein")

        # Generate intelligent meal suggestions
        suggestions = food_log_service.generate_smart_suggestions(
            user_id, target_calories, target_protein, meal_type
        )
        
        return jsonify({
            "success": True,
            "suggestions": suggestions,
            "message": f"Generated {len(suggestions)} meal suggestions",
            "meta": {
                "target_calories": target_calories,
                "target_protein": target_protein,
                "meal_type": meal_type
            }
        })

    except ValueError as e:
        return jsonify({"error": f"Invalid input: {str(e)}"}), 400
    except Exception as e:
        logger.error(f"Error generating meal suggestions: {str(e)}")
        return jsonify({
            "error": "Failed to generate meal suggestions",
            "details": str(e) if os.getenv('DEBUG') else "Internal server error"
        }), 500

@food_log_routes.route('/api/health', methods=["GET"])
@cross_origin()
def health_check():
    """Health check endpoint"""
    return jsonify({
        "status": "healthy",
        "service": "food_log_api",
        "timestamp": datetime.now().isoformat(),
        "version": "2.0.0"
    })

def init_food_log_routes(app):
    """Initialize enhanced food log routes with error handling"""
    try:
        app.register_blueprint(food_log_routes)
        logger.info("Food log routes initialized successfully")
        return app
    except Exception as e:
        logger.error(f"Failed to initialize food log routes: {e}")
        raise
