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
        
    def get_recipe_ideas(self, meal_type, healthy, allergies, count=10):
        
        
        system_prompt = """You are a culinary expert that creates diverse recipes quickly. Format requirements:
        1. Generate exactly {count} different recipes
        2. Never repeat recipe ideas or cuisines in the batch
        3. Vary cooking methods, ingredients, and cuisine styles
        4. Format each recipe exactly as follows:
        - Title on first line (no bold, no word "recipe") DO not include the word title... the title should not be "==="
        - Ingredients with bullet points (•) BELOW TITLE
        - Numbered instructions(specific)
        - Nutritional information per serving (united states standards... example(calories not kc)) in OWN BLOCK 
        - Preparation Time, Cooking Time, Servings  in its own little section below nutrition
        5. Separate each recipe with ===== on its own line
        6. No bold letters or asterisks
        7. Make recipes completely distinct and unique from each other"""

        # Create a single prompt for multiple recipes
        prompt = f"Create {count} unique {meal_type} recipes, each from different cuisines and cooking styles."
        
        if healthy:
            prompt += " Make them healthy and nutritious."
            
        if allergies:
            prompt += f" Ensure they are completely free of these allergens or restrctions(example:vegan, vegitarian): {', '.join(allergies)}."

        try:
            response = self.client.chat.completions.create(
                model="gpt-3.5-turbo",  
                messages=[
                    {"role": "system", "content": system_prompt.format(count=count)},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.9,
                max_tokens=4000,
            )
            
            # Split response into individual recipes
            recipe_text = response.choices[0].message.content.strip()
            recipes = recipe_text.split("=====")
            recipes = [r.strip() for r in recipes if r.strip()]
            
            # If we didn't get enough recipes, make a second call for the remainder
            if len(recipes) < count:
                remaining = count - len(recipes)
                second_prompt = f"Create {remaining} more unique {meal_type} recipes, different from: {', '.join([r.split('\n')[0] for r in recipes])}"
                
                second_response = self.client.chat.completions.create(
                    model="gpt-3.5-turbo",
                    messages=[
                        {"role": "system", "content": system_prompt.format(count=remaining)},
                        {"role": "user", "content": second_prompt}
                    ],
                    temperature=0.9,
                    max_tokens=2000,
                )
                
                additional_recipes = second_response.choices[0].message.content.strip().split("=====")
                recipes.extend([r.strip() for r in additional_recipes if r.strip()])

            return recipes[:count]  
            
        except Exception as e:
            print(f"Error generating recipes: {str(e)}")
            return []

    def format_recipe_for_display(self, recipe):
        """Format recipe text for display. Return as is since OpenAI already formats it well."""
        return recipefrom openai import OpenAI
import os

client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))

def get_recipe_ideas(meal_type, healthy, allergies):
    try:
        # Construct the prompt
        prompt = f"Generate a {meal_type} recipe"
        if healthy:
            prompt += " that is healthy"
        
        if allergies:
            prompt += f" and completely free of the following ingredients (serious allergy): {', '.join(allergies)}."
        else:
            prompt += "."
        
        # Call OpenAI API
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are a culinary assistant. Respond with a detailed recipe that includes a clear title, ingredients list, and step-by-step cooking instructions. add the calories, protein and other nutrient information at the end for Whole recipe per serving"},
                {"role": "user", "content": prompt},
            ]
        )
        
        # Explicitly extract recipe content
        if response.choices and len(response.choices) > 0:
            recipe_content = response.choices[0].message.content
            return [recipe_content.strip()]  # Return as a list with a single recipe
        else:
            return []  # Return an empty list if no recipe found

    except Exception as e:
        # Return an empty list if an exception occurs
        print(f"Error fetching recipes: {str(e)}")
        return []