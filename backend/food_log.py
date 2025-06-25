from flask import request, jsonify, Blueprint
from flask_cors import cross_origin
from typing import Optional, List, Dict, Any
from dataclasses import dataclass
from datetime import datetime, date
import json
from backend.openai_handler import RecipeGenerator
import firebase_admin
from firebase_admin import firestore

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

@dataclass
class NutritionGoalsRequest:
    """Data class for validating nutrition goals requests"""
    user_id: str
    daily_calories: int
    daily_protein: int
    daily_carbs: Optional[int] = None
    daily_fat: Optional[int] = None
    
    @classmethod
    def from_request(cls, data: dict) -> 'NutritionGoalsRequest':
        if not data.get("user_id"):
            raise ValueError("user_id is required")
        if not data.get("daily_calories") or int(data.get("daily_calories", 0)) <= 0:
            raise ValueError("daily_calories must be a positive number")
        if not data.get("daily_protein") or int(data.get("daily_protein", 0)) <= 0:
            raise ValueError("daily_protein must be a positive number")
        
        return cls(
            user_id=data["user_id"].strip(),
            daily_calories=int(data["daily_calories"]),
            daily_protein=int(data["daily_protein"]),
            daily_carbs=int(data.get("daily_carbs", 0)) if data.get("daily_carbs") else None,
            daily_fat=int(data.get("daily_fat", 0)) if data.get("daily_fat") else None
        )

class FoodLogService:
    def __init__(self):
        self.db = firestore.client()
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

    def log_food_entry(self, user_id: str, food_description: str, meal_type: str) -> Dict[str, Any]:
        """Log a food entry for the user"""
        try:
            # Get nutrition estimation
            nutrition_data = self.estimate_nutrition(food_description)
            
            # Create food log entry
            food_entry = {
                "user_id": user_id,
                "food_description": food_description,
                "meal_type": meal_type,
                "food_name": nutrition_data["food_name"],
                "calories": nutrition_data["calories"],
                "protein": nutrition_data["protein"],
                "carbs": nutrition_data["carbs"],
                "fat": nutrition_data["fat"],
                "serving_size": nutrition_data["serving_size"],
                "confidence": nutrition_data["confidence"],
                "logged_at": datetime.utcnow(),
                "date": date.today().isoformat()
            }
            
            # Save to Firestore
            doc_ref = self.db.collection("food_logs").add(food_entry)
            food_entry["id"] = doc_ref[1].id
            
            return food_entry
            
        except Exception as e:
            print(f"Error logging food entry: {str(e)}")
            raise e

    def get_user_goals(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get user's nutrition goals"""
        try:
            doc_ref = self.db.collection("nutrition_goals").document(user_id)
            doc = doc_ref.get()
            
            if doc.exists:
                return doc.to_dict()
            return None
            
        except Exception as e:
            print(f"Error getting user goals: {str(e)}")
            return None

    def set_user_goals(self, user_id: str, daily_calories: int, daily_protein: int,
                      daily_carbs: Optional[int] = None, daily_fat: Optional[int] = None) -> Dict[str, Any]:
        """Set or update user's nutrition goals"""
        try:
            goals = {
                "user_id": user_id,
                "daily_calories": daily_calories,
                "daily_protein": daily_protein,
                "daily_carbs": daily_carbs,
                "daily_fat": daily_fat,
                "updated_at": datetime.utcnow()
            }
            
            # Save to Firestore
            self.db.collection("nutrition_goals").document(user_id).set(goals)
            
            return goals
            
        except Exception as e:
            print(f"Error setting user goals: {str(e)}")
            raise e

    def get_daily_progress(self, user_id: str, target_date: Optional[str] = None) -> Dict[str, Any]:
        """Get user's daily nutrition progress"""
        try:
            if target_date is None:
                target_date = date.today().isoformat()
            
            # Get today's food logs
            food_logs_ref = self.db.collection("food_logs")
            query = food_logs_ref.where("user_id", "==", user_id).where("date", "==", target_date)
            docs = query.stream()
            
            # Calculate totals
            total_calories = 0
            total_protein = 0
            total_carbs = 0
            total_fat = 0
            entries = []
            
            for doc in docs:
                entry = doc.to_dict()
                entry["id"] = doc.id
                entries.append(entry)
                
                total_calories += entry.get("calories", 0)
                total_protein += entry.get("protein", 0)
                total_carbs += entry.get("carbs", 0)
                total_fat += entry.get("fat", 0)
            
            # Get user's goals
            goals = self.get_user_goals(user_id)
            
            # Calculate remaining macros
            remaining_calories = (goals.get("daily_calories", 2000) - total_calories) if goals else 0
            remaining_protein = (goals.get("daily_protein", 100) - total_protein) if goals else 0
            remaining_carbs = (goals.get("daily_carbs", 250) - total_carbs) if goals and goals.get("daily_carbs") else None
            remaining_fat = (goals.get("daily_fat", 70) - total_fat) if goals and goals.get("daily_fat") else None
            
            return {
                "date": target_date,
                "goals": goals,
                "consumed": {
                    "calories": total_calories,
                    "protein": total_protein,
                    "carbs": total_carbs,
                    "fat": total_fat
                },
                "remaining": {
                    "calories": max(0, remaining_calories),
                    "protein": max(0, remaining_protein),
                    "carbs": max(0, remaining_carbs) if remaining_carbs is not None else None,
                    "fat": max(0, remaining_fat) if remaining_fat is not None else None
                },
                "entries": entries,
                "entry_count": len(entries)
            }
            
        except Exception as e:
            print(f"Error getting daily progress: {str(e)}")
            raise e

# Create service instance
food_log_service = FoodLogService()

@food_log_routes.route('/api/food-log', methods=["POST"])
@cross_origin()
def log_food():
    """Log a food entry"""
    try:
        if not request.is_json:
            return jsonify({"error": "Content-Type must be application/json"}), 400

        try:
            food_request = FoodLogRequest.from_request(request.json)
        except (ValueError, TypeError) as e:
            return jsonify({"error": f"Invalid request data: {str(e)}"}), 400

        # Log the food entry
        food_entry = food_log_service.log_food_entry(
            user_id=food_request.user_id,
            food_description=food_request.food_description,
            meal_type=food_request.meal_type
        )

        return jsonify({
            "success": True,
            "food_entry": food_entry,
            "message": "Food logged successfully!"
        })

    except Exception as e:
        print(f"Error in log_food endpoint: {str(e)}")
        return jsonify({
            "error": "An unexpected error occurred while logging food",
            "details": str(e)
        }), 500

@food_log_routes.route('/api/nutrition-goals', methods=["POST"])
@cross_origin()
def set_nutrition_goals():
    """Set user's nutrition goals"""
    try:
        if not request.is_json:
            return jsonify({"error": "Content-Type must be application/json"}), 400

        try:
            goals_request = NutritionGoalsRequest.from_request(request.json)
        except (ValueError, TypeError) as e:
            return jsonify({"error": f"Invalid request data: {str(e)}"}), 400

        # Set the goals
        goals = food_log_service.set_user_goals(
            user_id=goals_request.user_id,
            daily_calories=goals_request.daily_calories,
            daily_protein=goals_request.daily_protein,
            daily_carbs=goals_request.daily_carbs,
            daily_fat=goals_request.daily_fat
        )

        return jsonify({
            "success": True,
            "goals": goals,
            "message": "Nutrition goals updated successfully!"
        })

    except Exception as e:
        print(f"Error in set_nutrition_goals endpoint: {str(e)}")
        return jsonify({
            "error": "An unexpected error occurred while setting goals",
            "details": str(e)
        }), 500

@food_log_routes.route('/api/nutrition-goals/<user_id>', methods=["GET"])
@cross_origin()
def get_nutrition_goals(user_id):
    """Get user's nutrition goals"""
    try:
        goals = food_log_service.get_user_goals(user_id)
        
        if not goals:
            return jsonify({
                "success": False,
                "message": "No nutrition goals found for this user"
            }), 404

        return jsonify({
            "success": True,
            "goals": goals
        })

    except Exception as e:
        print(f"Error in get_nutrition_goals endpoint: {str(e)}")
        return jsonify({
            "error": "An unexpected error occurred while getting goals",
            "details": str(e)
        }), 500

@food_log_routes.route('/api/daily-progress/<user_id>', methods=["GET"])
@cross_origin()
def get_daily_progress(user_id):
    """Get user's daily nutrition progress"""
    try:
        target_date = request.args.get('date')  # Optional date parameter
        
        progress = food_log_service.get_daily_progress(user_id, target_date)

        return jsonify({
            "success": True,
            "progress": progress
        })

    except Exception as e:
        print(f"Error in get_daily_progress endpoint: {str(e)}")
        return jsonify({
            "error": "An unexpected error occurred while getting progress",
            "details": str(e)
        }), 500

@food_log_routes.route('/api/food-logs/<user_id>', methods=["GET"])
@cross_origin()
def get_food_logs(user_id):
    """Get user's food log history"""
    try:
        # Get optional query parameters
        limit = min(int(request.args.get('limit', 50)), 100)  # Max 100 entries
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        
        food_logs_ref = food_log_service.db.collection("food_logs")
        query = food_logs_ref.where("user_id", "==", user_id)
        
        # Add date filters if provided
        if start_date:
            query = query.where("date", ">=", start_date)
        if end_date:
            query = query.where("date", "<=", end_date)
        
        # Order by most recent first and limit results
        query = query.order_by("logged_at", direction=firestore.Query.DESCENDING).limit(limit)
        
        docs = query.stream()
        
        food_logs = []
        for doc in docs:
            entry = doc.to_dict()
            entry["id"] = doc.id
            # Convert datetime to string for JSON serialization
            if "logged_at" in entry:
                entry["logged_at"] = entry["logged_at"].isoformat()
            food_logs.append(entry)

        return jsonify({
            "success": True,
            "food_logs": food_logs,
            "count": len(food_logs)
        })

    except Exception as e:
        print(f"Error in get_food_logs endpoint: {str(e)}")
        return jsonify({
            "error": "An unexpected error occurred while getting food logs",
            "details": str(e)
        }), 500
        
# Add these additional endpoints to your food_log_routes.py

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

@food_log_routes.route('/api/food-log/<entry_id>', methods=["DELETE"])
@cross_origin()
def delete_food_entry(entry_id):
    """Delete a food log entry"""
    try:
        # Delete from Firestore
        food_log_service.db.collection("food_logs").document(entry_id).delete()
        
        return jsonify({
            "success": True,
            "message": "Food entry deleted successfully"
        })

    except Exception as e:
        print(f"Error deleting food entry: {str(e)}")
        return jsonify({
            "error": "An unexpected error occurred while deleting entry",
            "details": str(e)
        }), 500

@food_log_routes.route('/api/food-log/<entry_id>', methods=["PUT"])
@cross_origin()
def update_food_entry(entry_id):
    """Update a food log entry"""
    try:
        if not request.is_json:
            return jsonify({"error": "Content-Type must be application/json"}), 400

        data = request.json
        
        # Validate that only allowed fields are being updated
        allowed_fields = ['food_description', 'meal_type', 'calories', 'protein', 'carbs', 'fat', 'serving_size']
        updates = {k: v for k, v in data.items() if k in allowed_fields}
        
        if not updates:
            return jsonify({"error": "No valid fields to update"}), 400

        # Add updated timestamp
        updates['updated_at'] = datetime.utcnow()

        # Update in Firestore
        food_log_service.db.collection("food_logs").document(entry_id).update(updates)
        
        return jsonify({
            "success": True,
            "message": "Food entry updated successfully",
            "updates": updates
        })

    except Exception as e:
        print(f"Error updating food entry: {str(e)}")
        return jsonify({
            "error": "An unexpected error occurred while updating entry",
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
        user_id = data.get("user_id")
        target_calories = data.get("target_calories", 0)
        target_protein = data.get("target_protein", 0)
        target_carbs = data.get("target_carbs")
        target_fat = data.get("target_fat")

        if not user_id:
            return jsonify({"error": "user_id is required"}), 400

        # Generate meal suggestions using OpenAI
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
            response = food_log_service.recipe_generator.client.chat.completions.create(
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
            
            return jsonify({
                "success": True,
                "suggestions": suggestions
            })

        except json.JSONDecodeError:
            # Fallback suggestions
            fallback_suggestions = [
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
            
            return jsonify({
                "success": True,
                "suggestions": fallback_suggestions
            })

    except Exception as e:
        print(f"Error generating meal suggestions: {str(e)}")
        return jsonify({
            "error": "An unexpected error occurred while generating suggestions",
            "details": str(e)
        }), 500

@food_log_routes.route('/api/nutrition-summary/<user_id>', methods=["GET"])
@cross_origin()
def get_nutrition_summary(user_id):
    """Get nutrition summary for a date range"""
    try:
        # Get query parameters
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        
        if not start_date or not end_date:
            return jsonify({"error": "start_date and end_date are required"}), 400

        # Query food logs for the date range
        food_logs_ref = food_log_service.db.collection("food_logs")
        query = food_logs_ref.where("user_id", "==", user_id)
        query = query.where("date", ">=", start_date)
        query = query.where("date", "<=", end_date)
        query = query.order_by("date")
        
        docs = query.stream()
        
        # Calculate daily totals
        daily_totals = {}
        total_entries = 0
        
        for doc in docs:
            entry = doc.to_dict()
            date = entry.get("date")
            total_entries += 1
            
            if date not in daily_totals:
                daily_totals[date] = {
                    "calories": 0,
                    "protein": 0,
                    "carbs": 0,
                    "fat": 0,
                    "entries": 0
                }
            
            daily_totals[date]["calories"] += entry.get("calories", 0)
            daily_totals[date]["protein"] += entry.get("protein", 0)
            daily_totals[date]["carbs"] += entry.get("carbs", 0)
            daily_totals[date]["fat"] += entry.get("fat", 0)
            daily_totals[date]["entries"] += 1

        # Calculate averages
        days = list(daily_totals.keys())
        num_days = len(days)
        
        summary = {
            "start_date": start_date,
            "end_date": end_date,
            "total_days": num_days,
            "total_entries": total_entries,
            "daily_breakdown": daily_totals,
            "averages": {
                "calories": 0,
                "protein": 0,
                "carbs": 0,
                "fat": 0
            }
        }
        
        if num_days > 0:
            summary["averages"] = {
                "calories": round(sum(day["calories"] for day in daily_totals.values()) / num_days),
                "protein": round(sum(day["protein"] for day in daily_totals.values()) / num_days),
                "carbs": round(sum(day["carbs"] for day in daily_totals.values()) / num_days),
                "fat": round(sum(day["fat"] for day in daily_totals.values()) / num_days)
            }

        return jsonify({
            "success": True,
            "summary": summary
        })

    except Exception as e:
        print(f"Error getting nutrition summary: {str(e)}")
        return jsonify({
            "error": "An unexpected error occurred while getting summary",
            "details": str(e)
        }), 500

@food_log_routes.route('/api/weekly-progress/<user_id>', methods=["GET"])
@cross_origin()
def get_weekly_progress(user_id):
    """Get weekly nutrition progress"""
    try:
        from datetime import timedelta
        
        # Calculate date range for the past 7 days
        end_date = date.today()
        start_date = end_date - timedelta(days=6)
        
        # Get food logs for the week
        food_logs_ref = food_log_service.db.collection("food_logs")
        query = food_logs_ref.where("user_id", "==", user_id)
        query = query.where("date", ">=", start_date.isoformat())
        query = query.where("date", "<=", end_date.isoformat())
        
        docs = query.stream()
        
        # Initialize daily data for all 7 days
        daily_data = {}
        current_date = start_date
        for i in range(7):
            daily_data[current_date.isoformat()] = {
                "date": current_date.isoformat(),
                "calories": 0,
                "protein": 0,
                "carbs": 0,
                "fat": 0,
                "entries": 0
            }
            current_date += timedelta(days=1)
        
        # Aggregate data by date
        for doc in docs:
            entry = doc.to_dict()
            entry_date = entry.get("date")
            
            if entry_date in daily_data:
                daily_data[entry_date]["calories"] += entry.get("calories", 0)
                daily_data[entry_date]["protein"] += entry.get("protein", 0)
                daily_data[entry_date]["carbs"] += entry.get("carbs", 0)
                daily_data[entry_date]["fat"] += entry.get("fat", 0)
                daily_data[entry_date]["entries"] += 1

        # Get user goals for comparison
        goals = food_log_service.get_user_goals(user_id)
        
        # Convert to list and sort by date
        weekly_data = list(daily_data.values())
        weekly_data.sort(key=lambda x: x["date"])

        return jsonify({
            "success": True,
            "weekly_data": weekly_data,
            "goals": goals,
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat()
        })

    except Exception as e:
        print(f"Error getting weekly progress: {str(e)}")
        return jsonify({
            "error": "An unexpected error occurred while getting weekly progress",
            "details": str(e)
        }), 500

def init_food_log_routes(app):
    """Initialize food log routes"""
    app.register_blueprint(food_log_routes)
    return app
