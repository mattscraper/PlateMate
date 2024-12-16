from app import app
from openai_handler import get_recipe_ideas
from flask import request, jsonify
from flask_cors import cross_origin

@app.route('/get_recipes', methods=["POST"])
@cross_origin()
def get_recipes():
    try:
        # Parse JSON from request body
        data = request.json
        meal_type = data.get("meal_type")
        healthy = data.get('healthy')
        allergies = data.get('allergies')

        # Call the function to get recipes
        recipes = get_recipe_ideas(meal_type, healthy, allergies)

        return jsonify({'fetchRecipes': recipes})
    except Exception as e:
        return jsonify({"error": str(e)}),500

        