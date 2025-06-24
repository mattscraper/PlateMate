
from flask import request, jsonify, Blueprint
from flask_cors import cross_origin
from typing import Optional
from dataclasses import dataclass
from backend.grocery_generator import GroceryListGenerator

# Create a Blueprint for grocery lists
grocery_routes = Blueprint('grocery', __name__)

@dataclass
class GroceryListRequest:
    """Data class for validating grocery list requests"""
    meal_plan: str
    days: int
    meals_per_day: int

    @classmethod
    def from_request(cls, data: dict) -> 'GroceryListRequest':
        if not data.get("meal_plan"):
            raise ValueError("meal_plan is required")
        if not data.get("days"):
            raise ValueError("days is required")
        if not data.get("meals_per_day"):
            raise ValueError("meals_per_day is required")
        
        return cls(
            meal_plan=data["meal_plan"].strip(),
            days=min(max(int(data["days"]), 1), 14),
            meals_per_day=min(max(int(data["meals_per_day"]), 1), 5)
        )

# Create a global grocery list generator instance
grocery_generator = GroceryListGenerator()

@grocery_routes.route('/api/grocery-list', methods=["POST"])
@cross_origin()
def generate_grocery_list():
    """Generate grocery list from meal plan"""
    try:
        if not request.is_json:
            return jsonify({"error": "Content-Type must be application/json"}), 400

        try:
            grocery_request = GroceryListRequest.from_request(request.json)
        except (ValueError, TypeError) as e:
            return jsonify({"error": f"Invalid request data: {str(e)}"}), 400

        # Generate grocery list
        result = grocery_generator.generate_grocery_list(
            meal_plan_text=grocery_request.meal_plan,
            days=grocery_request.days,
            meals_per_day=grocery_request.meals_per_day
        )

        if not result.get('success'):
            return jsonify({
                "error": result.get('error', 'Failed to generate grocery list')
            }), 404

        return jsonify(result)

    except Exception as e:
        print(f"Error generating grocery list: {str(e)}")
        return jsonify({
            "error": "An unexpected error occurred while generating grocery list",
            "details": str(e)
        }), 500

@grocery_routes.route('/api/grocery-list/categories', methods=["GET"])
@cross_origin()
def get_grocery_categories():
    """Get available grocery categories"""
    try:
        categories = {
            'proteins': 'Meat, Fish & Proteins',
            'vegetables': 'Fresh Vegetables',
            'fruits': 'Fresh Fruits',
            'dairy': 'Dairy & Eggs',
            'grains': 'Grains & Breads',
            'pantry': 'Pantry Staples',
            'herbs_spices': 'Herbs & Spices',
            'condiments': 'Condiments & Sauces',
            'frozen': 'Frozen Foods',
            'snacks': 'Snacks & Nuts',
            'beverages': 'Beverages'
        }
        
        return jsonify({
            "success": True,
            "categories": categories
        })

    except Exception as e:
        print(f"Error getting categories: {str(e)}")
        return jsonify({
            "error": "An unexpected error occurred",
            "details": str(e)
        }), 500

def init_grocery_routes(app):
    """Initialize grocery routes"""
    app.register_blueprint(grocery_routes)
    return app

# Update your main routes file to include grocery routes:
"""
# In your main routes/app file, add:

from backend.grocery_routes import init_grocery_routes

# After creating your Flask app:
app = init_grocery_routes(app)
"""
