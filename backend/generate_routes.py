from flask import request, jsonify, Blueprint
from flask_cors import cross_origin
from typing import Optional, List
from dataclasses import dataclass
from backend.openai_handler import RecipeGenerator


# we need to make a seperate route for the meal plans/ different file?

# Create a Blueprint for recipes
recipe_routes = Blueprint('recipes', __name__)

@dataclass
class MealTypeRecipeRequest:
    """Data class for validating meal type recipe requests"""
    meal_type: str
    healthy: bool = False
    allergies: Optional[List[str]] = None
    count: int = 5

    @classmethod
    def from_request(cls, data: dict) -> 'MealTypeRecipeRequest':
        if not data.get("meal_type"):
            raise ValueError("meal type is required")
        return cls(
            meal_type=data["meal_type"].lower().strip(),
            healthy=bool(data.get("healthy", False)),
            allergies=list(set(allergy.lower().strip() for allergy in data.get("allergies", []))),
            count=min(max(int(data.get("count", 10)), 1), 15)
        )

@dataclass
class IngredientsRecipeRequest:
    """Data class for validating ingredients-based recipe requests"""
    ingredients: List[str]
    allergies: Optional[List[str]] = None
    count: int = 10

    @classmethod
    def from_request(cls, data: dict) -> 'IngredientsRecipeRequest':
        if not data.get("ingredients"):
            raise ValueError("ingredients list cannot be empty")
        return cls(
            ingredients=list(set(ingredient.lower().strip() for ingredient in data.get("ingredients", []))),
            allergies=list(set(allergy.lower().strip() for allergy in data.get("allergies", []))),
            count=min(max(int(data.get("count", 10)), 1), 15)
        )

# Create a global recipe generator instance
recipe_generator = RecipeGenerator()

@recipe_routes.route('/api/recipes', methods=["POST"])
@cross_origin()
def get_recipes():
    try:
        if not request.is_json:
            return jsonify({"error": "Content-Type must be application/json"}), 400

        try:
            recipe_request = MealTypeRecipeRequest.from_request(request.json)
        except (ValueError, TypeError) as e:
            return jsonify({"error": f"Invalid request data: {str(e)}"}), 400

        recipes = recipe_generator.get_recipe_ideas(
            meal_type=recipe_request.meal_type,
            healthy=recipe_request.healthy,
            allergies=recipe_request.allergies,
            count=recipe_request.count
        )

        if not recipes:
            return jsonify({"error": "No recipes could be generated. Please try again."}), 404

        return jsonify({
            "success": True,
            "recipes": recipes,
            "count": len(recipes)
        })

    except Exception as e:
        print(f"Error generating recipes: {str(e)}")
        return jsonify({
            "error": "An unexpected error occurred while generating recipes",
            "details": str(e)
        }), 500

# get recipe by ingredients api route
@recipe_routes.route('/api/recipes/ingredients', methods=["POST"])
@cross_origin()
def get_recipes_ingredients():
    try:
        if not request.is_json:
            return jsonify({"error": "Content-Type must be application/json"}), 400

        try:
            recipe_request = IngredientsRecipeRequest.from_request(request.json)
        except (ValueError, TypeError) as e:
            return jsonify({"error": f"Invalid request data: {str(e)}"}), 400

        recipes = recipe_generator.get_recipe_ingredients(
            ingredients=recipe_request.ingredients,
            allergies=recipe_request.allergies,
            count=recipe_request.count
        )

        if not recipes:
            return jsonify({"error": "No recipes could be generated. Please try again."}), 404

        return jsonify({
            "success": True,
            "recipes": recipes,
            "count": len(recipes)
        })

    except Exception as e:
        print(f"Error generating recipes: {str(e)}")
        return jsonify({
            "error": "An unexpected error occurred while generating recipes",
            "details": str(e)
        }), 500


# meal plan generation api route
@recipe_routes.route('/api/mealplans', methods=["POST"])
@cross_origin()
def get_meal_plan():
    try:
        if not request.is_json:
            return jsonify({
                "Error": "Response Content-Type must be application/json"
            }), 400
        data = request.json
        
        
       
        
        # Existing parameter validation
        days = min(max(int(data.get("days", 7)), 1), 14)
        meals_per_day = min(max(int(data.get("meals_per_day", 3)), 1), 5)
        healthy = bool(data.get("healthy", False))
        allergies = list(set(allergy.lower().strip() for allergy in data.get("allergies", [])))
        preferences = list(set(preference.lower().strip() for preference in data.get("preferences", [])))
        calories_per_day = min(max(int(data.get("calories_per_day", 2000)), 1000), 5000)
        # Generate meal plan with user_id for duplicate prevention
        meal_plan = recipe_generator.generate_meal_plan(
            days=days,
            meals_per_day=meals_per_day,
            healthy=healthy,
            allergies=allergies,
            preferences=preferences,
            calories_per_day=calories_per_day,
            
        )
        if not meal_plan:
            return jsonify({
                "Error": "No meal plan could be generated. Please try again."
            }), 404
        return jsonify({
            "success": True,
            "meal_plan": meal_plan,
            "days": days,
            "meals_per_day": meals_per_day,
            "calories_per_day": calories_per_day
        })
    except Exception as e:
        print(f"Error generating meal plans: {str(e)}")
        return jsonify({
            "Error": "An unexpected error occurred while generating meal plans",
            "details": str(e)
        }), 500
def init_recipe_routes(app):
    """Initialize recipe routes"""
    app.register_blueprint(recipe_routes)
    return app
