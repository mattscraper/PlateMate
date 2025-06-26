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
    """Data class for validating food log requests"""
    food_description: str
    user_id: str
    meal_type: Optional[str] = "other"  # breakfast, lunch, dinner, snack, other
    
    @classmethod
    def from_request(cls, data: dict) -> 'FoodLogRequest':
        if not data.get("food_description"):
            raise ValueError("food description is required")
        if not data.get("user_id"):
            raise ValueError("user_id is required")
        return cls(
            food_description=data["food_description"].strip(),
            user_id=data["user_id"].strip(),
            meal_type=data.get("meal_type", "other").lower().strip()
        )

class FoodLogService:
    def __init__(self):
        self.recipe_generator = RecipeGenerator()
    
    def estimate_nutrition(self, food_description: str) -> Dict[str, Any]:
        """Use OpenAI to estimate nutrition information from food description"""
        system_prompt = """You are a nutrition expert. Analyze the food description and provide accurate nutritional information.

        CRITICAL: You must respond with ONLY a valid JSON object in this exact format:
        {
            "food_name": "Clear name of the food/meal",
            "calories": 450,
            "protein": 25,
            "carbs": 35,
            "fat": 15,
            "serving_size": "1 cup" or "1 piece" or "1 serving",
            "confidence": 0.85
        }

        Rules:
        - calories, protein, carbs, fat must be numbers (integers)
        - confidence should be between 0.1 and 1.0
        - serving_size should be a realistic portion description
        - If the description is vague, estimate for a typical serving
        - For multiple foods, combine the totals
        - Be conservative with calorie estimates
        - protein/carbs = 4 calories per gram, fat = 9 calories per gram
        - Make sure the macros add up reasonably to the total calories

        Examples:
        - "2 slices of pizza" → estimate for 2 slices
        - "a bowl of cereal" → estimate for 1 typical bowl
        - "chicken breast with rice" → estimate for typical serving of both
        """

        try:
            response = self.recipe_generator.client.chat.completions.create(
                model="gpt-4",  # Use GPT-4 for better accuracy
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"Estimate nutrition for: {food_description}"}
                ],
                temperature=0.2,  # Lower temperature for consistency
                max_tokens=250
            )
            
            nutrition_text = response.choices[0].message.content.strip()
            logger.info(f"OpenAI nutrition response: {nutrition_text}")
            
            # Parse JSON response
            try:
                nutrition_data = json.loads(nutrition_text)
                
                # Validate required fields
                required_fields = ["food_name", "calories", "protein", "carbs", "fat", "serving_size", "confidence"]
                if not all(field in nutrition_data for field in required_fields):
                    raise ValueError("Missing required fields in nutrition data")
                
                # Ensure numeric fields are correct types
                nutrition_data["calories"] = int(nutrition_data["calories"])
                nutrition_data["protein"] = int(nutrition_data["protein"])
                nutrition_data["carbs"] = int(nutrition_data["carbs"])
                nutrition_data["fat"] = int(nutrition_data["fat"])
                nutrition_data["confidence"] = float(nutrition_data["confidence"])
                
                # Sanity check
                if nutrition_data["calories"] < 0 or nutrition_data["calories"] > 5000:
                    raise ValueError("Invalid calorie count")
                
                return nutrition_data
                
            except (json.JSONDecodeError, ValueError, KeyError) as e:
                logger.error(f"Error parsing nutrition JSON: {e}")
                return self._get_fallback_nutrition(food_description)
            
        except Exception as e:
            logger.error(f"Error calling OpenAI for nutrition: {e}")
            return self._get_fallback_nutrition(food_description)

    def _get_fallback_nutrition(self, food_description: str) -> Dict[str, Any]:
        """Provide fallback nutrition data"""
        return {
            "food_name": food_description,
            "calories": 300,
            "protein": 15,
            "carbs": 30,
            "fat": 10,
            "serving_size": "1 serving",
            "confidence": 0.5
        }

    def transcribe_audio(self, audio_file_path: str) -> Optional[str]:
        """Use OpenAI Whisper to transcribe audio to text"""
        try:
            # Validate file exists and has content
            if not os.path.exists(audio_file_path):
                logger.error(f"Audio file does not exist: {audio_file_path}")
                return None
                
            file_size = os.path.getsize(audio_file_path)
            if file_size == 0:
                logger.error("Audio file is empty")
                return None
            
            # Check file size limit (25MB for Whisper)
            if file_size > 25 * 1024 * 1024:
                logger.error(f"Audio file too large: {file_size} bytes")
                return None
            
            logger.info(f"Transcribing audio file: {audio_file_path} ({file_size} bytes)")
            
            # Try transcription with optimized parameters
            try:
                with open(audio_file_path, "rb") as audio_file:
                    # Use OpenAI Whisper API with careful error handling
                    transcript_response = self.recipe_generator.client.audio.transcriptions.create(
                        model="whisper-1",
                        file=audio_file,
                        response_format="text",  # Simple text response
                        language="en",  # Specify English
                        prompt="The speaker is describing food, meals, or ingredients they consumed. Common foods include chicken, rice, vegetables, fruits, sandwiches, salads, and snacks.",
                        temperature=0.0  # Deterministic output
                    )
                    
                    # Extract text from response
                    if hasattr(transcript_response, 'text'):
                        transcription = transcript_response.text.strip()
                    else:
                        transcription = str(transcript_response).strip()
                        
                    logger.info(f"Raw Whisper transcription: '{transcription}'")
                    
                    # Basic validation
                    if not transcription:
                        logger.warning("Empty transcription received")
                        return None
                    
                    if len(transcription.strip()) < 2:
                        logger.warning(f"Transcription too short: '{transcription}'")
                        return None
                    
                    # Clean and improve transcription
                    cleaned_transcription = self._clean_transcription(transcription)
                    
                    if len(cleaned_transcription.strip()) < 2:
                        logger.warning(f"Cleaned transcription too short: '{cleaned_transcription}'")
                        return None
                    
                    # Final validation - make sure it's not just noise
                    if cleaned_transcription.lower().strip() in ['', 'um', 'uh', 'hmm', 'ah']:
                        logger.warning(f"Transcription appears to be just noise: '{cleaned_transcription}'")
                        return None
                    
                    logger.info(f"Final clean transcription: '{cleaned_transcription}'")
                    return cleaned_transcription
                    
            except Exception as whisper_error:
                logger.error(f"Whisper API error: {str(whisper_error)}")
                
                # Parse specific error types
                error_str = str(whisper_error).lower()
                if "could not be decoded" in error_str or "format is not supported" in error_str:
                    logger.error("Audio format/encoding issue - file may be corrupted or in unsupported format")
                elif "invalid file format" in error_str:
                    logger.error("File format not supported by Whisper")
                elif "file too large" in error_str:
                    logger.error("File exceeds Whisper's size limit")
                elif "no audio" in error_str or "empty" in error_str:
                    logger.error("Audio file contains no readable audio data")
                else:
                    logger.error(f"Unknown Whisper API error: {whisper_error}")
                
                return None
                
        except Exception as e:
            logger.error(f"Error in transcribe_audio: {str(e)}")
            import traceback
            traceback.print_exc()
            return None

    def _clean_transcription(self, text: str) -> str:
        """Clean up common transcription issues"""
        if not text:
            return ""
            
        # Basic cleanup
        text = text.strip()
        
        # Remove multiple spaces and normalize whitespace
        import re
        text = re.sub(r'\s+', ' ', text)
        
        # Remove trailing periods and commas that don't add meaning
        text = text.rstrip('.,!?;:')
        
        # Fix common food-related transcription errors
        food_corrections = {
            # Protein sources
            "chiken": "chicken",
            "chickn": "chicken",
            "meet": "meat",
            "stake": "steak",
            "samon": "salmon",
            "tuna fish": "tuna",
            
            # Vegetables
            "tomatoe": "tomato",
            "tomatos": "tomatoes",
            "potatos": "potatoes",
            "avacado": "avocado",
            "avacados": "avocados",
            "brocoli": "broccoli",
            "cabage": "cabbage",
            
            # Fruits
            "aple": "apple",
            "apples": "apples",
            "banna": "banana",
            "bannana": "banana",
            "bannas": "bananas",
            "bannanas": "bananas",
            "berry": "berries",
            "strawbery": "strawberry",
            "strawberys": "strawberries",
            
            # Grains and starches
            "rais": "rice",
            "bred": "bread",
            "piza": "pizza",
            "past": "pasta",
            "oatmeel": "oatmeal",
            "quinowa": "quinoa",
            
            # Dairy
            "yougurt": "yogurt",
            "yoghurt": "yogurt",
            "chees": "cheese",
            "cheeze": "cheese",
            
            # General food terms
            "saled": "salad",
            "sandwitch": "sandwich",
            "sandwhich": "sandwich",
            "smoothe": "smoothie",
            "snaks": "snacks",
            "veggie": "vegetable",
            "veggies": "vegetables",
            "protien": "protein",
            
            # Cooking methods
            "griled": "grilled",
            "grilled": "grilled",
            "baked": "baked",
            "fried": "fried",
            "boiled": "boiled",
            "steamed": "steamed",
        }
        
        # Apply corrections (case insensitive)
        for wrong, correct in food_corrections.items():
            # Use word boundaries to avoid partial word replacements
            pattern = r'\b' + re.escape(wrong) + r'\b'
            text = re.sub(pattern, correct, text, flags=re.IGNORECASE)
        
        # Capitalize first letter if text exists
        if text:
            text = text[0].upper() + text[1:] if len(text) > 1 else text.upper()
            
        return text.strip()

    def generate_meal_suggestions(self, target_calories: int, target_protein: int,
                                target_carbs: Optional[int] = None, target_fat: Optional[int] = None) -> List[Dict[str, Any]]:
        """Generate meal suggestions based on remaining macros"""
        system_prompt = f"""You are a nutrition expert. Generate 4-5 practical meal suggestions based on the target macros.

        Target nutrition:
        - Calories: {target_calories}
        - Protein: {target_protein}g
        - Carbs: {target_carbs}g (if specified)
        - Fat: {target_fat}g (if specified)

        Provide realistic meals that would fit within these targets. Focus on accessible, common foods.
        
        Respond with ONLY a JSON array of meal suggestions in this format:
        [
            {{
                "meal_name": "Grilled Chicken Salad",
                "description": "Mixed greens with grilled chicken breast, cherry tomatoes, and olive oil dressing",
                "estimated_calories": 350,
                "estimated_protein": 30,
                "estimated_carbs": 15,
                "estimated_fat": 20
            }}
        ]"""

        try:
            response = self.recipe_generator.client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"Suggest meals for remaining macros: {target_calories} calories, {target_protein}g protein"}
                ],
                temperature=0.7,
                max_tokens=1000
            )
            
            suggestions_text = response.choices[0].message.content.strip()
            logger.info(f"Generated suggestions: {suggestions_text}")
            
            suggestions = json.loads(suggestions_text)
            
            # Validate suggestions
            validated_suggestions = []
            for suggestion in suggestions[:5]:  # Limit to 5
                if self._validate_suggestion(suggestion):
                    validated_suggestions.append(suggestion)
            
            return validated_suggestions

        except (json.JSONDecodeError, Exception) as e:
            logger.error(f"Error generating meal suggestions: {e}")
            return self._get_fallback_suggestions(target_calories, target_protein)

    def _validate_suggestion(self, suggestion: dict) -> bool:
        """Validate that a suggestion has required fields"""
        required_fields = ["meal_name", "description", "estimated_calories", "estimated_protein"]
        return all(field in suggestion for field in required_fields)

    def _get_fallback_suggestions(self, calories: int, protein: int) -> List[Dict[str, Any]]:
        """Provide fallback suggestions when AI generation fails"""
        return [
            {
                "meal_name": "Protein Smoothie",
                "description": "Protein powder with banana and almond milk",
                "estimated_calories": min(calories, 300),
                "estimated_protein": min(protein, 25),
                "estimated_carbs": 20,
                "estimated_fat": 5
            },
            {
                "meal_name": "Greek Yogurt Bowl",
                "description": "Greek yogurt with berries and nuts",
                "estimated_calories": min(calories, 250),
                "estimated_protein": min(protein, 20),
                "estimated_carbs": 15,
                "estimated_fat": 8
            },
            {
                "meal_name": "Grilled Chicken Salad",
                "description": "Mixed greens with grilled chicken and vinaigrette",
                "estimated_calories": min(calories, 400),
                "estimated_protein": min(protein, 30),
                "estimated_carbs": 20,
                "estimated_fat": 15
            }
        ]

# Create service instance
food_log_service = FoodLogService()

@food_log_routes.route('/api/estimate-nutrition', methods=["POST"])
@cross_origin()
def estimate_nutrition():
    """Estimate nutrition for a food description without logging it"""
    try:
        if not request.is_json:
            return jsonify({"error": "Content-Type must be application/json"}), 400

        data = request.json
        food_description = data.get("food_description", "").strip()
        
        if not food_description:
            return jsonify({"error": "food_description is required"}), 400

        if len(food_description) > 500:
            return jsonify({"error": "food_description too long (max 500 characters)"}), 400

        logger.info(f"Estimating nutrition for: {food_description}")

        # Get nutrition estimation
        nutrition_data = food_log_service.estimate_nutrition(food_description)

        return jsonify({
            "success": True,
            "nutrition": nutrition_data
        })

    except Exception as e:
        logger.error(f"Error in estimate_nutrition endpoint: {str(e)}")
        return jsonify({
            "error": "An unexpected error occurred while estimating nutrition",
            "details": str(e) if os.getenv('DEBUG') else "Internal server error"
        }), 500

@food_log_routes.route('/api/speech-to-text', methods=["POST"])
@cross_origin()
def speech_to_text():
    """Convert speech audio to text using OpenAI Whisper"""
    temp_audio_path = None
    
    try:
        # Check if audio file is in the request
        if 'audio' not in request.files:
            logger.error("No audio file provided in request")
            return jsonify({
                "success": False,
                "error": "No audio file provided"
            }), 400

        audio_file = request.files['audio']
        
        if audio_file.filename == '':
            logger.error("No audio file selected")
            return jsonify({
                "success": False,
                "error": "No audio file selected"
            }), 400

        # Log the received file info
        logger.info(f"Received audio file: {audio_file.filename}")
        logger.info(f"Content type: {audio_file.content_type}")

        # More flexible file extension handling
        file_ext = os.path.splitext(audio_file.filename)[1].lower()
        
        # If no extension, determine from content type or default
        if not file_ext:
            if 'audio/mp3' in str(audio_file.content_type) or 'audio/mpeg' in str(audio_file.content_type):
                file_ext = '.mp3'
            elif 'audio/wav' in str(audio_file.content_type):
                file_ext = '.wav'
            elif 'audio/mp4' in str(audio_file.content_type) or 'audio/m4a' in str(audio_file.content_type):
                file_ext = '.m4a'
            else:
                file_ext = '.mp3'  # Default to mp3
        
        # Whisper supports these formats natively - no conversion needed
        whisper_supported = {'.mp3', '.mp4', '.mpeg', '.mpga', '.m4a', '.wav', '.webm', '.ogg', '.flac'}
        
        if file_ext not in whisper_supported:
            logger.error(f"Unsupported audio format: {file_ext}")
            return jsonify({
                "success": False,
                "error": f"Unsupported audio format: {file_ext}. Supported formats: mp3, mp4, wav, m4a, webm, ogg, flac"
            }), 400

        # Create temporary file with the original extension
        with tempfile.NamedTemporaryFile(delete=False, suffix=file_ext) as temp_audio:
            # Save the file data
            audio_file.seek(0)  # Reset file pointer
            temp_audio.write(audio_file.read())
            temp_audio_path = temp_audio.name

        # Check file size
        file_size = os.path.getsize(temp_audio_path)
        logger.info(f"Saved audio file: {temp_audio_path} ({file_size} bytes)")
        
        if file_size == 0:
            logger.error("Audio file is empty")
            return jsonify({
                "success": False,
                "error": "Audio file is empty"
            }), 400

        if file_size > 25 * 1024 * 1024:  # 25MB limit
            logger.error(f"Audio file too large: {file_size} bytes")
            return jsonify({
                "success": False,
                "error": "Audio file too large (max 25MB)"
            }), 400

        # Minimum file size check (at least 1KB for a valid audio file)
        if file_size < 1024:
            logger.error(f"Audio file too small: {file_size} bytes")
            return jsonify({
                "success": False,
                "error": "Audio file too small - please record for at least 1 second"
            }), 400

        # Log file header for debugging
        try:
            with open(temp_audio_path, 'rb') as f:
                header = f.read(16)
                logger.info(f"Audio file header (first 16 bytes): {header.hex()}")
        except Exception as e:
            logger.warning(f"Could not read file header: {e}")

        # Transcribe the audio using our improved service
        logger.info(f"Starting transcription of file: {temp_audio_path}")
        transcription = food_log_service.transcribe_audio(temp_audio_path)
        
        if not transcription:
            logger.error("Transcription returned empty result")
            return jsonify({
                "success": False,
                "error": "Could not transcribe audio. Please try again with clearer speech.",
                "suggestions": [
                    "Speak clearly and at a normal pace",
                    "Record in a quiet environment",
                    "Hold the microphone close to your mouth",
                    "Make sure you're describing food items"
                ]
            }), 400

        logger.info(f"Transcription successful: '{transcription}'")
        return jsonify({
            "success": True,
            "transcription": transcription,
            "message": "Audio transcribed successfully"
        })

    except Exception as e:
        logger.error(f"Error in speech_to_text endpoint: {str(e)}")
        import traceback
        traceback.print_exc()
        
        return jsonify({
            "success": False,
            "error": "An unexpected error occurred while processing audio",
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
    """Get meal suggestions based on remaining macros"""
    try:
        if not request.is_json:
            return jsonify({"error": "Content-Type must be application/json"}), 400

        data = request.json
        target_calories = data.get("target_calories", 0)
        target_protein = data.get("target_protein", 0)
        target_carbs = data.get("target_carbs")
        target_fat = data.get("target_fat")

        if target_calories <= 0:
            return jsonify({"error": "target_calories must be greater than 0"}), 400

        logger.info(f"Generating suggestions for {target_calories} cal, {target_protein}g protein")

        # Generate meal suggestions using OpenAI
        suggestions = food_log_service.generate_meal_suggestions(
            target_calories, target_protein, target_carbs, target_fat
        )
        
        return jsonify({
            "success": True,
            "suggestions": suggestions
        })

    except Exception as e:
        logger.error(f"Error generating meal suggestions: {str(e)}")
        return jsonify({
            "error": "An unexpected error occurred while generating suggestions",
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
        "version": "1.1.0"
    })

def init_food_log_routes(app):
    """Initialize food log routes"""
    try:
        app.register_blueprint(food_log_routes)
        logger.info("Food log routes initialized successfully")
        return app
    except Exception as e:
        logger.error(f"Failed to initialize food log routes: {e}")
        raise
