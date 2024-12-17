from flask import request, jsonify, Blueprint
from flask_cors import cross_origin
from typing import Optional, List
from dataclasses import dataclass
from openai_handler import RecipeGenerator

# Create a Blueprint for recipes
recipe_routes = Blueprint('recipes', __name__)

@dataclass
class RecipeRequest:
    """Data class for validating recipe requests"""
    meal_type: str
    healthy: bool = False
    allergies: Optional[List[str]] = None
    count: int = 10

    @classmethod
    def from_request(cls, data: dict) -> 'RecipeRequest':
        """Create a RecipeRequest from request data with validation"""
        if not data.get("meal_type"):
            raise ValueError("meal_type is required")
            
        return cls(
            meal_type=data["meal_type"].lower().strip(),
            healthy=bool(data.get("healthy", False)),
            allergies=list(set(allergy.lower().strip() for allergy in data.get("allergies", []))),
            count=min(max(int(data.get("count", 10)), 1), 15)  # Limit between 10 and 15 recipes
        )

# Create a global recipe generator instance
recipe_generator = RecipeGenerator()

@recipe_routes.route('/api/recipes', methods=["POST"])
@cross_origin()
def get_recipes():
    try:
        # Validate request content type
        if not request.is_json:
            return jsonify({
                "error": "Content-Type must be application/json"
            }), 400

        # Parse and validate request data
        try:
            recipe_request = RecipeRequest.from_request(request.json)
        except (ValueError, TypeError) as e:
            return jsonify({
                "error": f"Invalid request data: {str(e)}"
            }), 400

        # Generate recipes
        recipes = recipe_generator.get_recipe_ideas(
            meal_type=recipe_request.meal_type,
            healthy=recipe_request.healthy,
            allergies=recipe_request.allergies,
            count=recipe_request.count
        )

        # Check if we got any recipes
        if not recipes:
            return jsonify({
                "error": "No recipes could be generated. Please try again."
            }), 404

        # Return the recipes directly since they're already formatted
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

def init_recipe_routes(app):
    """Initialize recipe routes"""
    app.register_blueprint(recipe_routes)
    return app