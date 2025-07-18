from flask import request, jsonify, Blueprint
from flask_cors import cross_origin
from typing import Dict, Optional
from dataclasses import dataclass
import json
import time

# Import the enhanced grocery generator
from backend.grocery_generator import RealisticGroceryListGenerator

# Enhanced Flask routes
grocery_routes = Blueprint('grocery', __name__)

@dataclass
class RealisticGroceryListRequest:
    meal_plan: str
    days: int
    meals_per_day: int
    meal_plan_id: Optional[str] = None
    existing_grocery_list: Optional[Dict] = None

    @classmethod
    def from_request(cls, data: dict) -> 'RealisticGroceryListRequest':
        if not data.get("meal_plan"):
            raise ValueError("meal_plan is required")
        
        # Validate and set defaults
        days = data.get("days", 7)
        meals_per_day = data.get("meals_per_day", 3)
        
        try:
            days = int(days)
            meals_per_day = int(meals_per_day)
        except (ValueError, TypeError):
            raise ValueError("days and meals_per_day must be valid integers")
        
        # Reasonable limits
        if days < 1 or days > 21:
            raise ValueError("days must be between 1 and 21")
        if meals_per_day < 1 or meals_per_day > 6:
            raise ValueError("meals_per_day must be between 1 and 6")
        
        return cls(
            meal_plan=data["meal_plan"].strip(),
            days=days,
            meals_per_day=meals_per_day,
            meal_plan_id=data.get("meal_plan_id"),
            existing_grocery_list=data.get("existing_grocery_list")
        )

# Global realistic grocery list generator instance
# This should be imported from your enhanced grocery generator module
# realistic_generator = RealisticGroceryListGenerator()

class RealisticGroceryListGenerator:
    """Placeholder - replace with actual import"""
    pass

realistic_generator = RealisticGroceryListGenerator()

@grocery_routes.route('/api/grocery-list', methods=["POST", "OPTIONS"])
@cross_origin(origins=["http://localhost:3000", "https://platemate-6.onrender.com"],
              methods=["POST", "OPTIONS"],
              allow_headers=["Content-Type", "Authorization"])
def generate_realistic_grocery_list():
    """Generate realistic grocery list with intelligent parsing and cost estimation"""
    
    # Handle preflight requests
    if request.method == "OPTIONS":
        return jsonify({"status": "OK"}), 200
    
    try:
        print("🛒 Received grocery list generation request")
        
        if not request.is_json:
            return jsonify({
                "success": False,
                "error": "Content-Type must be application/json"
            }), 400

        # Parse and validate request
        try:
            grocery_request = RealisticGroceryListRequest.from_request(request.json)
            print(f"📋 Processing: {grocery_request.days} days, {grocery_request.meals_per_day} meals/day")
        except (ValueError, TypeError) as e:
            return jsonify({
                "success": False,
                "error": f"Invalid request data: {str(e)}"
            }), 400

        # Check if meal plan has sufficient content
        if len(grocery_request.meal_plan.strip()) < 50:
            return jsonify({
                "success": False,
                "error": "Meal plan appears too short. Please provide a detailed meal plan with ingredients."
            }), 400

        # Generate realistic grocery list using the enhanced generator
        result = realistic_generator.generate_grocery_list(
            meal_plan_text=grocery_request.meal_plan,
            days=grocery_request.days,
            meals_per_day=grocery_request.meals_per_day
        )

        # Ensure the result has the expected structure
        if not result.get('success'):
            error_msg = result.get('error', 'Failed to generate grocery list')
            print(f"❌ Generation failed: {error_msg}")
            return jsonify({
                "success": False,
                "error": error_msg
            }), 422

        # Add metadata for persistence
        if grocery_request.meal_plan_id:
            result['meal_plan_id'] = grocery_request.meal_plan_id
            result['created_at'] = time.time()
            result['updated_at'] = time.time()

        # Validate result structure
        required_fields = ['grocery_list', 'cost_breakdown', 'summary']
        missing_fields = [field for field in required_fields if field not in result]
        
        if missing_fields:
            print(f"⚠️ Result missing fields: {missing_fields}")
            return jsonify({
                "success": False,
                "error": f"Internal error: Missing result fields: {missing_fields}"
            }), 500

        print(f"✅ Generated grocery list with {len(result.get('grocery_list', []))} items")
        print(f"💰 Total cost: ${result.get('cost_breakdown', {}).get('total_cost', 0):.2f}")
        
        return jsonify(result)

    except Exception as e:
        print(f"❌ Unexpected error generating grocery list: {str(e)}")
        import traceback
        traceback.print_exc()
        
        return jsonify({
            "success": False,
            "error": "An unexpected error occurred while generating grocery list",
            "details": str(e) if app.debug else "Internal server error"
        }), 500

@grocery_routes.route('/api/grocery-list/update-checks', methods=["POST", "OPTIONS"])
@cross_origin(origins=["http://localhost:3000", "https://platemate-6.onrender.com"],
              methods=["POST", "OPTIONS"],
              allow_headers=["Content-Type", "Authorization"])
def update_grocery_check_states():
    """Update check states for grocery list items with persistence"""
    
    # Handle preflight requests
    if request.method == "OPTIONS":
        return jsonify({"status": "OK"}), 200
    
    try:
        print("🔄 Received check state update request")
        
        if not request.is_json:
            return jsonify({
                "success": False,
                "error": "Content-Type must be application/json"
            }), 400

        data = request.json
        grocery_list = data.get('grocery_list')
        item_updates = data.get('item_updates', [])
        meal_plan_id = data.get('meal_plan_id')

        if not grocery_list:
            return jsonify({
                "success": False,
                "error": "grocery_list is required"
            }), 400

        if not isinstance(item_updates, list):
            return jsonify({
                "success": False,
                "error": "item_updates must be a list"
            }), 400

        # Validate item updates structure
        for update in item_updates:
            if not isinstance(update, dict) or 'name' not in update or 'is_checked' not in update:
                return jsonify({
                    "success": False,
                    "error": "Each item_update must have 'name' and 'is_checked' fields"
                }), 400

        # Update check states in grocery list
        updated_count = 0
        for item in grocery_list.get('grocery_list', []):
            for update in item_updates:
                if item.get('name') == update['name']:
                    item['is_checked'] = update['is_checked']
                    item['checked_at'] = time.time() if update['is_checked'] else None
                    updated_count += 1
                    break

        # Update metadata
        grocery_list['updated_at'] = time.time()
        grocery_list['checked_items_count'] = sum(1 for item in grocery_list.get('grocery_list', []) if item.get('is_checked'))
        
        total_items = len(grocery_list.get('grocery_list', []))
        completion_percentage = (grocery_list['checked_items_count'] / total_items * 100) if total_items > 0 else 0
        grocery_list['completion_percentage'] = round(completion_percentage, 1)

        print(f"✅ Updated {updated_count} items, {grocery_list['checked_items_count']}/{total_items} checked")

        return jsonify({
            "success": True,
            "grocery_list": grocery_list,
            "updated_count": updated_count,
            "completion_percentage": grocery_list['completion_percentage']
        })

    except Exception as e:
        print(f"❌ Error updating check states: {str(e)}")
        return jsonify({
            "success": False,
            "error": "An unexpected error occurred while updating check states",
            "details": str(e) if app.debug else "Internal server error"
        }), 500

@grocery_routes.route('/api/grocery-list/categories', methods=["GET", "OPTIONS"])
@cross_origin(origins=["http://localhost:3000", "https://platemate-6.onrender.com"])
def get_realistic_grocery_categories():
    """Get realistic grocery categories with enhanced metadata"""
    
    # Handle preflight requests
    if request.method == "OPTIONS":
        return jsonify({"status": "OK"}), 200
    
    try:
        # Categories with display information matching the enhanced generator
        categories = {
            'proteins': {
                'display_name': 'Meat & Proteins',
                'icon': '🥩',
                'description': 'Meat, fish, eggs, and plant-based proteins',
                'typical_cost_range': [15, 50],
                'storage_tips': 'Keep refrigerated, freeze portions for longer storage'
            },
            'vegetables': {
                'display_name': 'Vegetables',
                'icon': '🥕',
                'description': 'Fresh vegetables and produce',
                'typical_cost_range': [10, 25],
                'storage_tips': 'Store in crisper drawer, buy mix of ripe and unripe'
            },
            'fruits': {
                'display_name': 'Fruits',
                'icon': '🍎',
                'description': 'Fresh fruits and berries',
                'typical_cost_range': [8, 20],
                'storage_tips': 'Some ripen at room temperature, others need refrigeration'
            },
            'dairy': {
                'display_name': 'Dairy & Eggs',
                'icon': '🥛',
                'description': 'Milk, cheese, yogurt, and eggs',
                'typical_cost_range': [10, 30],
                'storage_tips': 'Keep refrigerated, check expiration dates regularly'
            },
            'grains': {
                'display_name': 'Grains & Bread',
                'icon': '🍞',
                'description': 'Rice, pasta, bread, and grain products',
                'typical_cost_range': [5, 15],
                'storage_tips': 'Store in cool, dry place, freeze bread for longer storage'
            },
            'pantry': {
                'display_name': 'Pantry Staples',
                'icon': '🥫',
                'description': 'Oils, canned goods, and baking ingredients',
                'typical_cost_range': [10, 25],
                'storage_tips': 'Check expiration dates, store in cool, dry place'
            },
            'herbs_spices': {
                'display_name': 'Herbs & Spices',
                'icon': '🌿',
                'description': 'Fresh and dried herbs and spices',
                'typical_cost_range': [5, 15],
                'storage_tips': 'Store dried spices in airtight containers',
                'cost_excluded': True
            },
            'condiments': {
                'display_name': 'Condiments',
                'icon': '🍯',
                'description': 'Sauces, dressings, and condiments',
                'typical_cost_range': [8, 20],
                'storage_tips': 'Check if refrigeration needed after opening',
                'cost_excluded': True
            }
        }
        
        # Additional metadata
        shopping_tips = [
            "Shop the perimeter first for fresh items",
            "Compare unit prices for better value",
            "Check weekly store flyers for sales",
            "Bring reusable bags and a shopping list",
            "Shop early morning or late evening for best selection"
        ]
        
        cost_estimation_info = {
            "methodology": "Based on average grocery store prices",
            "accuracy": "Estimates may vary by location and store",
            "excluded_categories": ["herbs_spices", "condiments"],
            "last_updated": "2025-01"
        }

        return jsonify({
            "success": True,
            "categories": categories,
            "shopping_tips": shopping_tips,
            "cost_estimation_info": cost_estimation_info,
            "category_order": [
                "proteins", "vegetables", "fruits", "dairy",
                "grains", "pantry", "herbs_spices", "condiments"
            ]
        })

    except Exception as e:
        print(f"❌ Error getting categories: {str(e)}")
        return jsonify({
            "success": False,
            "error": "An unexpected error occurred",
            "details": str(e) if app.debug else "Internal server error"
        }), 500

@grocery_routes.route('/api/grocery-list/health', methods=["GET"])
@cross_origin()
def grocery_service_health():
    """Health check endpoint for the grocery service"""
    try:
        return jsonify({
            "success": True,
            "service": "Realistic Grocery List Generator",
            "status": "healthy",
            "version": "2.0.0",
            "features": [
                "Intelligent ingredient parsing",
                "Realistic quantity calculations",
                "Smart cost estimation",
                "Category-based organization",
                "Shopping tips generation"
            ],
            "timestamp": time.time()
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "service": "Realistic Grocery List Generator",
            "status": "unhealthy",
            "error": str(e)
        }), 500

def init_realistic_grocery_routes(app):
    """Initialize realistic grocery routes with proper configuration"""
    print("🔧 Initializing realistic grocery list routes...")
    
    # Register the blueprint
    app.register_blueprint(grocery_routes)
    
    # Add error handlers for this blueprint
    @app.errorhandler(404)
    def not_found(error):
        if request.path.startswith('/api/grocery'):
            return jsonify({
                "success": False,
                "error": "Endpoint not found"
            }), 404
        return error

    @app.errorhandler(405)
    def method_not_allowed(error):
        if request.path.startswith('/api/grocery'):
            return jsonify({
                "success": False,
                "error": "Method not allowed"
            }), 405
        return error

    @app.errorhandler(500)
    def internal_error(error):
        if request.path.startswith('/api/grocery'):
            return jsonify({
                "success": False,
                "error": "Internal server error"
            }), 500
        return error
    
    print("✅ Realistic grocery list routes initialized successfully")

# Export for use in main app
__all__ = ['grocery_routes', 'init_realistic_grocery_routes']
