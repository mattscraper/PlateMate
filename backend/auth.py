
"""
We need to figure out a strategy to implement this with paid users... 01/16/25
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    jwt_required,
    get_jwt_identity
)
from models import User
from extensions import db
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import timedelta

auth_bp = Blueprint('auth', __name__)
# the register aspect should only apply to paid users. find out how to implement this.
@auth_bp.route('/register', methods=["POST"])
def register():
    try:
        data = request.get_json()
        email = data.get("email")
        password = data.get("password")
        
        if not email or not password:
            return jsonify({"error": "Email and password are required"}), 400
        
        if User.query.filter_by(email=email).first():
            return jsonify({"error": "Email already registered"}), 409
        
        hashed_password = generate_password_hash(password, method='sha256')
        
        new_user = User(
            email=email,
            password=hashed_password
        )
        
        db.session.add(new_user)
        db.session.commit()
        
        # Create tokens
        access_token = create_access_token(identity=new_user.id)
        refresh_token = create_refresh_token(identity=new_user.id)
        
        return jsonify({
            "message": "User created successfully",
            "access_token": access_token,
            "refresh_token": refresh_token,
            "user": {"id": new_user.id, "email": new_user.email}
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500
    
# login should be an automatic process... find out how to do this
@auth_bp.route('/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        email = data.get("email")
        password = data.get("password")
        
        if not email or not password:
            return jsonify({"error": "Email and password are required"}), 400
        
        user = User.query.filter_by(email=email).first()
        
        if not user or not check_password_hash(user.password, password):
            return jsonify({"error": "Invalid credentials"}), 401
        
        access_token = create_access_token(
            identity=user.id,
            expires_delta=timedelta(days=1)
        )
        refresh_token = create_refresh_token(identity=user.id)
        
        return jsonify({
            "access_token": access_token,
            "refresh_token": refresh_token, #create way to refresh.... every 30 days?
            "user": {"id": user.id, "email": user.email}
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@auth_bp.route('/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    try:
        current_user_id = get_jwt_identity()
        new_access_token = create_access_token(identity=current_user_id)
        
        return jsonify({
            "access_token": new_access_token
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# this get user function should be called to all frontend premium features
@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def get_user():
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        
        if not user:
            return jsonify({"error": "User not found"}), 404
            
        return jsonify({
            "id": user.id,
            "email": user.email
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Add route to get user's recipes
@auth_bp.route('/my-recipes', methods=['GET'])
@jwt_required()
def get_user_recipes():
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        
        if not user:
            return jsonify({"error": "User not found"}), 404
        
        recipes = [
            {
                "id": recipe.id,
                "title": recipe.title,
                "ingredients": recipe.ingredients,
                "instructions": recipe.instructions,
                "created_at": recipe.created_at.isoformat()
            }
            for recipe in user.recipes
        ]
            
        return jsonify(recipes)
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500