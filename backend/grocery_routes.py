from flask import request, jsonify, Blueprint
from flask_cors import cross_origin
from typing import Dict,Optional
from dataclasses import dataclass
from backend.grocery_generator import EnhancedGroceryListGenerator

# Enhanced Flask routes
grocery_routes = Blueprint('grocery', __name__)

@dataclass
class EnhancedGroceryListRequest:
    meal_plan: str
    days: int
    meals_per_day: int
    meal_plan_id: Optional[str] = None
    existing_grocery_list: Optional[Dict] = None

    @classmethod
    def from_request(cls, data: dict) -> 'EnhancedGroceryListRequest':
        if not data.get("meal_plan"):
            raise ValueError("meal_plan is required")
        if not data.get("days"):
            raise ValueError("days is required")
        if not data.get("meals_per_day"):
            raise ValueError("meals_per_day is required")
        
        return cls(
            meal_plan=data["meal_plan"].strip(),
            days=min(max(int(data["days"]), 1), 14),
            meals_per_day=min(max(int(data["meals_per_day"]), 1), 5),
            meal_plan_id=data.get("meal_plan_id"),
            existing_grocery_list=data.get("existing_grocery_list")
        )

# Global enhanced grocery list generator
enhanced_generator = EnhancedGroceryListGenerator()

@grocery_routes.route('/api/grocery-list', methods=["POST"])
@cross_origin()
def generate_enhanced_grocery_list():
    """Generate enhanced grocery list with persistence support"""
    try:
        if not request.is_json:
            return jsonify({"error": "Content-Type must be application/json"}), 400

        try:
            grocery_request = EnhancedGroceryListRequest.from_request(request.json)
        except (ValueError, TypeError) as e:
            return jsonify({"error": f"Invalid request data: {str(e)}"}), 400

        # Generate grocery list with persistence
        result = enhanced_generator.generate_grocery_list_with_persistence(
            meal_plan_text=grocery_request.meal_plan,
            days=grocery_request.days,
            meals_per_day=grocery_request.meals_per_day,
            meal_plan_id=grocery_request.meal_plan_id,
            existing_grocery_list=grocery_request.existing_grocery_list
        )

        if not result.get('success'):
            return jsonify({
                "error": result.get('error', 'Failed to generate grocery list')
            }), 404

        return jsonify(result)

    except Exception as e:
        print(f"Error generating enhanced grocery list: {str(e)}")
        return jsonify({
            "error": "An unexpected error occurred while generating grocery list",
            "details": str(e)
        }), 500

@grocery_routes.route('/api/grocery-list/update-checks', methods=["POST"])
@cross_origin()
def update_grocery_check_states():
    """Update check states for grocery list items"""
    try:
        if not request.is_json:
            return jsonify({"error": "Content-Type must be application/json"}), 400

        data = request.json
        grocery_list = data.get('grocery_list')
        item_updates = data.get('item_updates', [])

        if not grocery_list:
            return jsonify({"error": "grocery_list is required"}), 400

        # Update check states
        updated_list = enhanced_generator.update_grocery_list_check_state(grocery_list, item_updates)

        return jsonify({
            "success": True,
            "grocery_list": updated_list
        })

    except Exception as e:
        print(f"Error updating check states: {str(e)}")
        return jsonify({
            "error": "An unexpected error occurred while updating check states",
            "details": str(e)
        }), 500

@grocery_routes.route('/api/grocery-list/categories', methods=["GET"])
@cross_origin()
def get_enhanced_grocery_categories():
    """Get enhanced grocery categories with descriptions"""
    try:
        categories = {
            'proteins': 'Meat, Fish & Plant Proteins',
            'vegetables': 'Fresh Vegetables',
            'fruits': 'Fresh Fruits',
            'dairy': 'Dairy & Eggs',
            'grains': 'Grains & Breads',
            'pantry': 'Pantry Staples',
            'herbs_spices': 'Herbs & Spices (reusable)',
            'condiments': 'Condiments & Sauces (reusable)',
            'frozen': 'Frozen Foods',
            'snacks': 'Snacks & Nuts',
            'beverages': 'Beverages'
        }
        
        return jsonify({
            "success": True,
            "categories": categories,
            "cost_excluded_categories": ['herbs_spices', 'condiments']
        })

    except Exception as e:
        print(f"Error getting enhanced categories: {str(e)}")
        return jsonify({
            "error": "An unexpected error occurred",
            "details": str(e)
        }), 500

def init_enhanced_grocery_routes(app):
    """Initialize enhanced grocery routes"""
    app.register_blueprint(grocery_routes)
    
