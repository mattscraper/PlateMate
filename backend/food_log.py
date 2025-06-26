from flask import request, jsonify, Blueprint
from flask_cors import cross_origin
from typing import Optional, List, Dict, Any
from dataclasses import dataclass
from datetime import datetime, date
import json
import os
import tempfile
from backend.openai_handler import RecipeGenerator
import openai

# Create a Blueprint for food logging
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
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"Estimate nutrition for: {food_description}"}
                ],
                temperature=0.3,
                max_tokens=200
            )
            
            nutrition_text = response.choices[0].message.content.strip()
            
            # Parse JSON response
            try:
                nutrition_data = json.loads(nutrition_text)
                
                # Validate required fields
                required_fields = ["food_name", "calories", "protein", "carbs", "fat", "serving_size", "confidence"]
                if not all(field in nutrition_data for field in required_fields):
                    raise ValueError("Missing required fields in nutrition data")
                
                # Ensure numeric fields are integers
                nutrition_data["calories"] = int(nutrition_data["calories"])
                nutrition_data["protein"] = int(nutrition_data["protein"])
                nutrition_data["carbs"] = int(nutrition_data["carbs"])
                nutrition_data["fat"] = int(nutrition_data["fat"])
                nutrition_data["confidence"] = float(nutrition_data["confidence"])
                
                return nutrition_data
                
            except json.JSONDecodeError:
                # Fallback if JSON parsing fails
                return {
                    "food_name": food_description,
                    "calories": 300,
                    "protein": 15,
                    "carbs": 30,
                    "fat": 10,
                    "serving_size": "1 serving",
                    "confidence": 0.5
                }
            
        except Exception as e:
            print(f"Error estimating nutrition: {str(e)}")
            # Return safe fallback values
            return {
                "food_name": food_description,
                "calories": 300,
                "protein": 15,
                "carbs": 30,
                "fat": 10,
                "serving_size": "1 serving",
                "confidence": 0.5
            }

    def transcribe_audio(self, audio_file_path: str) -> str:
        """Use OpenAI Whisper to transcribe audio to text"""
        try:
            with open(audio_file_path, "rb") as audio_file:
                # Use OpenAI Whisper API for speech-to-text
                transcript = self.recipe_generator.client.audio.transcriptions.create(
                    model="whisper-1",
                    file=audio_file,
                    response_format="text"
                )
                
                # Clean up the transcription
                transcription = transcript.strip()
                
                # Basic validation - ensure it's not empty and looks like food description
                if not transcription or len(transcription.strip()) < 3:
                    return None
                
                return transcription
                
        except Exception as e:
            print(f"Error transcribing audio: {str(e)}")
            return None

    def generate_meal_suggestions(self, target_calories: int, target_protein: int,
                                target_carbs: Optional[int] = None, target_fat: Optional[int] = None) -> List[Dict[str, Any]]:
        """Generate meal suggestions based on remaining macros"""
        system_prompt = f"""You are a nutrition expert. Generate 3-5 meal suggestions based on the target macros.

        Target nutrition:
        - Calories: {target_calories}
        - Protein: {target_protein}g
        - Carbs: {target_carbs}g (if specified)
        - Fat: {target_fat}g (if specified)

        Provide meals that would fit within these targets. Be practical and suggest real foods.
        
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
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"Suggest meals for remaining macros: {target_calories} calories, {target_protein}g protein"}
                ],
                temperature=0.7,
                max_tokens=800
            )
            
            suggestions_text = response.choices[0].message.content.strip()
            suggestions = json.loads(suggestions_text)
            
            return suggestions

        except json.JSONDecodeError:
            # Fallback suggestions
            return [
                {
                    "meal_name": "Protein Smoothie",
                    "description": "Protein powder with banana and almond milk",
                    "estimated_calories": min(target_calories, 300),
                    "estimated_protein": min(target_protein, 25),
                    "estimated_carbs": 20,
                    "estimated_fat": 5
                },
                {
                    "meal_name": "Greek Yogurt Bowl",
                    "description": "Greek yogurt with berries and nuts",
                    "estimated_calories": min(target_calories, 250),
                    "estimated_protein": min(target_protein, 20),
                    "estimated_carbs": 15,
                    "estimated_fat": 8
                }
            ]
        except Exception as e:
            print(f"Error generating meal suggestions: {str(e)}")
            return []

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

        # Get nutrition estimation
        nutrition_data = food_log_service.estimate_nutrition(food_description)

        return jsonify({
            "success": True,
            "nutrition": nutrition_data
        })

    except Exception as e:
        print(f"Error in estimate_nutrition endpoint: {str(e)}")
        return jsonify({
            "error": "An unexpected error occurred while estimating nutrition",
            "details": str(e)
        }), 500

@food_log_routes.route('/api/speech-to-text', methods=["POST"])
@cross_origin()
def speech_to_text():
    """Convert speech audio to text using OpenAI Whisper"""
    try:
        # Check if audio file is in the request
        if 'audio' not in request.files:
            return jsonify({"error": "No audio file provided"}), 400

        audio_file = request.files['audio']
        
        if audio_file.filename == '':
            return jsonify({"error": "No audio file selected"}), 400

        # Check file extension (accept common audio formats)
        allowed_extensions = {'.m4a', '.mp3', '.wav', '.flac', '.ogg', '.webm'}
        file_ext = os.path.splitext(audio_file.filename)[1].lower()
        
        if file_ext not in allowed_extensions:
            return jsonify({"error": f"Unsupported audio format. Allowed: {', '.join(allowed_extensions)}"}), 400

        # Create temporary file to save the audio
        with tempfile.NamedTemporaryFile(delete=False, suffix=file_ext) as temp_audio:
            audio_file.save(temp_audio.name)
            temp_audio_path = temp_audio.name

        try:
            # Transcribe the audio
            transcription = food_log_service.transcribe_audio(temp_audio_path)
            
            if not transcription:
                return jsonify({
                    "success": False,
                    "error": "Could not transcribe audio. Please speak more clearly or try again."
                }), 400

            return jsonify({
                "success": True,
                "transcription": transcription,
                "message": "Audio transcribed successfully"
            })

        finally:
            # Clean up temporary file
            try:
                os.unlink(temp_audio_path)
            except OSError:
                pass

    except Exception as e:
        print(f"Error in speech_to_text endpoint: {str(e)}")
        return jsonify({
            "success": False,
            "error": "An unexpected error occurred while processing audio",
            "details": str(e)
        }), 500

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

        # Generate meal suggestions using OpenAI
        suggestions = food_log_service.generate_meal_suggestions(
            target_calories, target_protein, target_carbs, target_fat
        )
        
        return jsonify({
            "success": True,
            "suggestions": suggestions
        })

    except Exception as e:
        print(f"Error generating meal suggestions: {str(e)}")
        return jsonify({
            "error": "An unexpected error occurred while generating suggestions",
            "details": str(e)
        }), 500

def init_food_log_routes(app):
    """Initialize food log routes"""
    app.register_blueprint(food_log_routes)
    return app
