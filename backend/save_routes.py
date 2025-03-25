from flask import Blueprint, jsonify, request
from backend.models import Recipe, User
from app import db
from functools import wraps
from flask_jwt_extended import get_jwt_identity,jwt_required



recipes_bp = Blueprint('recipes',__name__)


@recipes_bp.route('/api/recipes/save', methods=['POST'])
@jwt_required()  # Add the missing decorator
def save_recipe():
    data = request.get_json()
    current_user = get_jwt_identity()
    
    try:
        title = data.get('title')
        ingredients = data.get('ingredients')  # Fix spelling
        instructions = data.get('instructions')
        nutrition = data.get('nutrition')
        
        new_recipe = Recipe(
            user_id=current_user,
            title=title,
            ingredients=ingredients,  # Match your model's spelling
            instructions=instructions,
            nutrition=nutrition
        )
        db.session.add(new_recipe)
        db.session.commit()
        
        return jsonify({
            'message': 'Recipe saved successfully',
            'recipe_id': new_recipe.id
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400

@recipes_bp.route('/api/recipes/my-recipes', methods=['GET'])
@jwt_required()  # Add the missing decorator
def get_my_recipes():
    current_user = get_jwt_identity()
    
    try:
        recipes = Recipe.query.filter_by(user_id=current_user).order_by(Recipe.created_at.desc()).all()  # Fix field name
        recipes_list = [{
            'id': recipe.id,
            'title': recipe.title,
            'ingredients': recipe.ingridients,
            'instructions': recipe.instructions,
            'nutrition': recipe.nutrition,
            'created_at': recipe.created_at.isoformat()
        } for recipe in recipes]
        
        return jsonify(recipes_list), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 400