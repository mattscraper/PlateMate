from openai import OpenAI
import os
from time import sleep
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class RecipeGenerator:
    def __init__(self, api_key=None):
        
        self.api_key = api_key or os.getenv('OPENAI_API_KEY')
        
        if not self.api_key:
            raise ValueError("OpenAI API key not found. Please set OPENAI_API_KEY environment variable or pass the key directly.")
            
        self.client = OpenAI(api_key=self.api_key)
        
    def get_recipe_ideas(self, meal_type, healthy, allergies, count=5):
        
        
        system_prompt = """You are a culinary expert that creates diverse recipes quickly. These recipes should be very unique and outside the box for the most part. Format requirements:
        1. Generate exactly {count} different recipes.. some should be harder than others to make.
        2. Never repeat recipe ideas or cuisines in the batch
        3. Vary cooking methods, ingredients, and cuisine styles
        4. Format each recipe exactly as follows:
        - title far above everything without bolding, or any symbols of any kind (no word "recipe" in title) make it above everything so frontend can put it alone up top
        - Title on first line (no bold, no word "recipe") DO not include the word title... the title should not contain "=" and should be far above everything
        - Preparation Time, Cooking Time, Servings in its OWN LITTLE SECTION....put far below title
        - Ingredients with bullet points (•) on lines far BELOW TITLE(make sure the ingredients are passed below the titile)
        - Numbered instructions(specific) specify each step in detail and make sure to include all steps
        - Nutritional information per serving (united states standards... example(calories,protein,fat,carbs)) in OWN BLOCK and make it look modern and seperate by line
        5. Separate each recipe with ===== on its own line and leave space below for each recipe title!
        6. No bold letters or asterisks
        7. Make recipes amazing and think outside the box."""

        # Create a single prompt for multiple recipes
        prompt = f"Create {count} unique {meal_type} recipes, each from different cuisines and cooking styles."
        
        if healthy:
            prompt += " Make them healthy and nutritious."
            
        if allergies:
            if "vegan" in allergies:
                prompt += f"Ensure the meal is completely vegan and free these allergens or restrictions: {', '.join(allergies)}."
            prompt += f" Ensure they are completely free of these allergens or restrctions(example:vegan, vegitarian): {', '.join(allergies)}."

        try:
            response = self.client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": system_prompt.format(count=count)},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.95,
                max_tokens=2500,
                top_p=0.85
            )
            
            # Split response into individual recipes
            recipe_text = response.choices[0].message.content.strip()
            recipes = recipe_text.split("=====")
            recipes = [r.strip() for r in recipes if r.strip()]
            
            # If we didn't get enough recipes, make a second call for the remainder
            if len(recipes) < count:
                remaining = count - len(recipes)
                recipes_list = ', '.join([r.split('\n')[0] for r in recipes])
                second_prompt = f"Create {remaining} more unique {meal_type} recipes, different from: {recipes_list}"
                
                second_response = self.client.chat.completions.create(
                    model="gpt-3.5-turbo",
                    messages=[
                        {"role": "system", "content": system_prompt.format(count=remaining)},
                        {"role": "user", "content": second_prompt}
                    ],
                    temperature=0.95,
                    max_tokens=2000,
                    top_p=0.85
                )
                
                additional_recipes = second_response.choices[0].message.content.strip().split("=====")
                recipes.extend([r.strip() for r in additional_recipes if r.strip()])

            return recipes[:count]  
            
        except Exception as e:
            print(f"Error generating recipes: {str(e)}")
            return []
        


        
    def get_recipe_ingredients(self, ingredients, allergies, count=5):
        
        
        system_prompt = """You are a culinary expert that creates diverse recipes quickly. Format requirements:
        1. Generate exactly {count} different recipes
        . only generate recipes based on users available ingredients
        2. Never repeat recipe ideas or cuisines in the batch
        3. Vary cooking methods, ingredients, and cuisine styles
        4. Format each recipe exactly as follows:
        - Make sure the title is far above everything without bolding, or any symbols of any kind (no word "recipe" in title) make it above everything so frontend can put it alone up top
        - Title on first line (no bold, no word "recipe") DO not include the word title... the title should not contain "="
        - Ingredients with bullet points (•) on lines far BELOW TITLE(make sure the ingredients are passed below the titile)
        - Numbered instructions(specific)
        - Nutritional information per serving (united states standards... example(calories not kc)) in OWN BLOCK 
        - Preparation Time, Cooking Time, Servings  in its own little section below nutrition
        5. Separate each recipe with ===== on its own line and leave space below for title!
        6. No bold letters or asterisks
        7. Make recipes amazing and creative
        8. Be very specific with instructions and do not leave anything out... even if you have to add more instructions to achieve this."""
        

        # Create a single prompt for multiple recipes
        prompt = f"Create {count} unique recipes, based on the users available ingridients DO not include extra ingredients (except for spices): {','.join(ingredients)}."
        
            
        if allergies:
            if "vegan" in allergies:
                prompt += f"Ensure the meal is completely vegan and free these allergens or restrictions: {', '.join(allergies)}."
            prompt += f" Ensure they are completely free of these allergens or restrctions(example:vegan, vegitarian): {', '.join(allergies)}."

        try:
            response = self.client.chat.completions.create(
                model="gpt-3.5-turbo",  
                messages=[
                    {"role": "system", "content": system_prompt.format(count=count)},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.95,
                max_tokens=2500,
                top_p = 0.85
            )
            
            # Split response into individual recipes
            recipe_text = response.choices[0].message.content.strip()
            recipes = recipe_text.split("=====")
            recipes = [r.strip() for r in recipes if r.strip()]
            
            # If we didn't get enough recipes, make a second call for the remainder
            if len(recipes) < count:
                remaining = count - len(recipes)
                recipes_list = ', '.join([r.split('\n')[0] for r in recipes])
                second_prompt = f"Create {remaining} more unique  recipes, based on available {ingredients} different from: {recipes_list}"
                
                second_response = self.client.chat.completions.create(
                    model="gpt-3.5-turbo",
                    messages=[
                        {"role": "system", "content": system_prompt.format(count=remaining)},
                        {"role": "user", "content": second_prompt}
                    ],
                    temperature=0.95,
                    max_tokens=2000,
                    top_p = 0.85
                )
                
                additional_recipes = second_response.choices[0].message.content.strip().split("=====")
                recipes.extend([r.strip() for r in additional_recipes if r.strip()])

            return recipes[:count]  
            
        except Exception as e:
            print(f"Error generating recipes: {str(e)}")
            return []

    def generate_meal_plan(self, days, meals_per_day, healthy=False, allergies=None, preferences=None, calories_per_day=2000):

        system_prompt = f"""You are a meal planning expert. Format requirements:
        1. Generate a {days}-day meal plan with {meals_per_day} meals per day
        2. Never repeat recipes in the plan
        do not skip any days at all! double check that you have exactly {days} worth of meals is finished before responding.
        you should have a total of {days} multiplied by {meals_per_day} recipes by the end
        EACH DAY NEEDS TO HAVE {meals_per_day} no matter what. do not skip days.
        3. Ensure daily calorie total is approximately {calories_per_day} calories
        4. Format each day EXACTLY as follows:
        -the days have to be correctly in order! the user can only choose meal plans for 1-14 days.
            - MUST start each day with "Day X" where X is a sequential number from 1 to {days}. Make sure the days increment by one! ex, day1 then day2 then day3.
            - Each meal MUST be labeled as one of: Breakfast, Lunch, Dinner, or Snack... only one of each per day unless meals per day is less than 3
            - Recipe for each meal formatted exactly like:
                - Title (do not include the word title)
                - Preparation Time, Cooking Time, Servings
                - Ingredients with bullet points (•)
                - Numbered instructions
                - Nutritional information (including calories per serving, protein, carbs, and fat)
        5. Days MUST be numbered sequentially from 1 to {days} with no skipped or incorrect numbers
        6. Separate each day with ===== on its own line expect for each title! make sure the title does not come out as =====!
        7. Ensure variety in cuisines and cooking methods
        8. No bold letters or asterisks
        9. Distribute the {calories_per_day} calories appropriately across the {meals_per_day} meals
        10. do not leave any additional comments, just the meal plans"""

        # Initialize prompt
        prompt = f"Create a {days}-day meal plan with {meals_per_day} meals per day, targeting {calories_per_day} calories per day."

        # Handle optional parameters safely
        if healthy:
            prompt += " Make all meals healthy and nutritious."

        if allergies:
            allergies_list = ', '.join(allergies) if isinstance(allergies, list) else allergies
            prompt += f" Ensure all recipes are free of: {allergies_list}."

        if preferences:
            preferences_list = ', '.join(preferences) if isinstance(preferences, list) else preferences
            prompt += f" Consider these preferences: {preferences_list}."

        try:
            response = self.client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.95,
                max_tokens=4050,
                top_p = 0.85,
                timeout = 80
            )

            return response.choices[0].message.content.strip()

        except Exception as e:
            print(f"Error generating meal plan: {str(e)}")
            return None
def format_recipe_for_display(self, recipe):
    """Format recipe text for display. Return as is since OpenAI already formats it well."""
    return recipe