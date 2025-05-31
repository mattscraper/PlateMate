from openai import OpenAI
import os
import sqlite3
import random
from time import sleep
from dotenv import load_dotenv
import re
import hashlib
from datetime import datetime

# Load environment variables
load_dotenv()

class RecipeGenerator:
    def __init__(self, api_key=None, db_path=None):
        self.api_key = api_key or os.getenv('OPENAI_API_KEY')
        
        if not self.api_key:
            raise ValueError("OpenAI API key not found. Please set OPENAI_API_KEY environment variable or pass the key directly.")
            
        self.client = OpenAI(api_key=self.api_key)
        
        # Try to find the database file in several possible locations
        if db_path is None:
            # Try several possible locations
            possible_paths = [
                'recipes.db',              # Current directory
                'data/recipes.db',         # Data subdirectory
                'backend/data/recipes.db', # Backend/data subdirectory
                '../data/recipes.db',      # Parent's data subdirectory
            ]
            
            for path in possible_paths:
                if os.path.exists(path):
                    db_path = path
                    break
            else:
                # Default if none found
                db_path = 'recipes.db'
        
        self.db_path = db_path
        print(f"Using database at: {os.path.abspath(db_path)}")
        
        # Test database connection
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Get recipe count
            cursor.execute("SELECT COUNT(*) FROM recipes")
            count = cursor.fetchone()[0]
            
            cursor.execute("SELECT category, COUNT(*) FROM recipes GROUP BY category")
            categories = cursor.fetchall()
            conn.close()
            
            print(f"Connected to database with {count} recipes")
            for category, cat_count in categories:
                print(f"  - {category}: {cat_count} recipes")
                
        except Exception as e:
            print(f"Database error: {str(e)}")

    def _get_diet_specific_constraints(self, diet_type):
        """Get diet-specific ingredient and protein constraints"""
        
        diet_constraints = {
            "keto": {
                "proteins": ["salmon", "chicken thighs", "beef", "eggs", "cheese", "avocado", "nuts"],
                "carb_sources": ["cauliflower", "zucchini", "spinach", "broccoli", "asparagus"],
                "fats": ["olive oil", "coconut oil", "butter", "heavy cream", "MCT oil"],
                "forbidden": ["rice", "pasta", "bread", "potatoes", "beans", "quinoa", "oats"]
            },
            "low carb": {
                "proteins": ["chicken", "turkey", "fish", "lean beef", "eggs", "Greek yogurt"],
                "carb_sources": ["leafy greens", "bell peppers", "cucumber", "tomatoes", "berries"],
                "allowed_carbs": ["sweet potato (small)", "quinoa (small portions)"],
                "forbidden": ["white rice", "pasta", "bread", "regular potatoes"]
            },
            "vegan": {
                "proteins": ["tofu", "tempeh", "lentils", "chickpeas", "black beans", "quinoa", "nuts", "seeds"],
                "bases": ["brown rice", "whole wheat pasta", "sweet potatoes", "oats"],
                "vegetables": ["kale", "spinach", "broccoli", "bell peppers", "mushrooms"],
                "forbidden": ["meat", "fish", "dairy", "eggs", "honey"]
            },
            "vegetarian": {
                "proteins": ["eggs", "cheese", "Greek yogurt", "tofu", "lentils", "beans", "quinoa"],
                "bases": ["brown rice", "whole grain pasta", "potatoes", "oats"],
                "vegetables": ["seasonal vegetables", "leafy greens", "root vegetables"],
                "forbidden": ["meat", "fish", "poultry"]
            },
            "paleo": {
                "proteins": ["grass-fed beef", "free-range chicken", "wild salmon", "eggs"],
                "vegetables": ["sweet potatoes", "broccoli", "spinach", "bell peppers"],
                "fats": ["coconut oil", "olive oil", "avocado", "nuts"],
                "forbidden": ["grains", "legumes", "dairy", "processed foods", "sugar"]
            },
            "mediterranean": {
                "proteins": ["fish", "seafood", "chicken", "eggs", "legumes"],
                "bases": ["whole grains", "brown rice", "quinoa", "farro"],
                "fats": ["olive oil", "nuts", "olives", "avocado"],
                "vegetables": ["tomatoes", "cucumbers", "peppers", "leafy greens"]
            },
            "whole30": {
                "proteins": ["compliant meat", "fish", "eggs"],
                "vegetables": ["all vegetables except corn"],
                "fats": ["olive oil", "coconut oil", "avocado"],
                "forbidden": ["grains", "legumes", "dairy", "sugar", "alcohol", "processed foods"]
            },
            "gluten free": {
                "grains": ["rice", "quinoa", "corn", "oats (certified GF)"],
                "proteins": ["any naturally gluten-free proteins"],
                "forbidden": ["wheat", "barley", "rye", "standard pasta", "regular bread"]
            }
        }
        
        return diet_constraints.get(diet_type.lower(), {})

    def _generate_diversity_constraints(self, days, meals_per_day, diet_type=None, allergies=None):
        """Generate randomized constraints to ensure meal plan diversity, adapted for diet types"""
        
        # Get diet-specific constraints first
        diet_constraints = {}
        if diet_type and diet_type.lower() != "none":
            diet_constraints = self._get_diet_specific_constraints(diet_type)
        
        # Base cuisine pools (can be adapted for any diet)
        cuisine_pools = [
            ["Italian", "Mediterranean", "Mexican", "Thai", "Indian"],
            ["Japanese", "Korean", "Chinese", "Vietnamese", "French"],
            ["American", "British", "German", "Greek", "Spanish"],
            ["Middle Eastern", "Moroccan", "Brazilian", "Caribbean", "Turkish"],
            ["Fusion", "Modern", "Comfort Food", "Southern", "Cajun"]
        ]
        
        # Diet-specific protein pools or default
        if diet_constraints.get("proteins"):
            protein_pools = [diet_constraints["proteins"]]
        else:
            protein_pools = [
                ["chicken", "salmon", "beef", "turkey", "shrimp"],
                ["tofu", "tempeh", "lentils", "chickpeas", "black beans"],
                ["pork", "lamb", "cod", "tuna", "eggs"],
                ["quinoa", "nuts", "cheese", "yogurt", "cottage cheese"]
            ]
        
        # Cooking method pools (universal)
        cooking_pools = [
            ["grilled", "roasted", "sautéed", "baked", "steamed"],
            ["stir-fried", "braised", "poached", "broiled", "pan-seared"],
            ["slow-cooked", "pressure-cooked", "air-fried", "smoked", "raw/fresh"]
        ]
        
        # Generate time-based seed for consistency within same request
        time_seed = int(datetime.now().timestamp()) // 3600  # Changes every hour
        random.seed(time_seed)
        
        # Select random pools
        selected_cuisines = random.choice(cuisine_pools)
        selected_proteins = random.choice(protein_pools) if protein_pools else []
        selected_cooking = random.choice(cooking_pools)
        
        # Add randomization factor that changes with each request
        randomization_key = random.randint(10000, 99999)
        
        constraints = {
            "cuisines": selected_cuisines,
            "proteins": selected_proteins,
            "cooking_methods": selected_cooking,
            "randomization_key": randomization_key,
            "total_meals": days * meals_per_day,
            "diet_type": diet_type,
            "diet_constraints": diet_constraints
        }
        
        # Add allergy constraints
        if allergies:
            constraints["allergies"] = allergies
            
        return constraints

    def _create_diversity_prompt_section(self, constraints):
        """Create the diversity constraint section for the AI prompt"""
        
        diet_type = constraints.get("diet_type")
        diet_constraints = constraints.get("diet_constraints", {})
        
        # Start with base diversity rules - make them more flexible
        diversity_rules = f"""
DIVERSITY GUIDELINES (Randomization Key: {constraints['randomization_key']}):

1. CUISINE VARIETY: Try to use different cuisines like: {', '.join(constraints['cuisines'])}
   - Vary cuisines when possible across the meal plan

2. PROTEIN VARIETY: Include proteins such as: {', '.join(constraints['proteins'])}
   - Use different proteins throughout the meal plan

3. COOKING METHOD VARIETY: Use different cooking methods like: {', '.join(constraints['cooking_methods'])}
   - Vary preparation styles when possible"""

        # Add diet-specific constraints - make them guidelines not absolute rules
        if diet_type and diet_type.lower() != "none":
            diversity_rules += f"\n\n4. DIET REQUIREMENTS ({diet_type.upper()}):"
            
            if diet_constraints.get("forbidden"):
                diversity_rules += f"\n   - AVOID: {', '.join(diet_constraints['forbidden'])}"
            
            if diet_constraints.get("carb_sources"):
                diversity_rules += f"\n   - PREFER CARBS: {', '.join(diet_constraints['carb_sources'])}"
            
            if diet_constraints.get("fats"):
                diversity_rules += f"\n   - INCLUDE FATS: {', '.join(diet_constraints['fats'])}"
            
            if diet_constraints.get("bases"):
                diversity_rules += f"\n   - GOOD BASES: {', '.join(diet_constraints['bases'])}"
        
        # Add allergy constraints - keep these strict
        if constraints.get("allergies"):
            diversity_rules += f"\n\n5. ALLERGY RESTRICTIONS:"
            diversity_rules += f"\n   - NEVER USE: {', '.join(constraints['allergies'])}"
        
        # Add general diversity rules - make them suggestions
        diversity_rules += f"""

{6 if diet_type or constraints.get("allergies") else 4}. GENERAL VARIETY:
   - Try to vary ingredients and cooking styles
   - Include different textures and flavors
   - Make each recipe feel unique and interesting

IMPORTANT: Generate ALL requested recipes even if some variety guidelines can't be perfectly followed. Completeness is more important than perfect diversity.
"""
        
        return diversity_rules
    
    def get_recipe_ideas(self, meal_type, healthy, allergies, count=5):
        # If there are allergies, use the original method to generate recipes
        meal_type_valid = ["breakfast", "lunch", "dinner", "snack", "dessert"]
        if allergies:
            print(f"Using original method due to allergies: {allergies}")
            return self._generate_recipes_with_openai(meal_type, healthy, allergies, count)
        if meal_type not in meal_type_valid:
            print(f"meal type is custom, default to original method: {meal_type}")
            return self._generate_recipes_with_openai(meal_type, healthy, allergies, count)
        # Otherwise, use recipes from the database
        print(f"Using titles from database for meal type: {meal_type}")
        return self._generate_recipes_from_database(meal_type, healthy, count)
    
    def _ensure_recipe_formatting(self, recipe_text):
        """Process a recipe to ensure consistent formatting, especially for instructions"""
        lines = recipe_text.split('\n')
        sections = []
        current_section = []
        in_instructions = False
        has_instruction_header = False
        
        for i, line in enumerate(lines):
            stripped = line.strip()
            
            # Skip empty lines between sections
            if not stripped:
                if current_section:
                    sections.append('\n'.join(current_section))
                    current_section = []
                continue
            
            # Check if this is an instruction header
            if stripped.lower() == "instructions:" or stripped.lower() == "instructions":
                has_instruction_header = True
                in_instructions = True
                if i > 0 and current_section:
                    sections.append('\n'.join(current_section))
                    current_section = []
                current_section.append(stripped)
                continue
            
            # Check if this is a numbered instruction
            if re.match(r'^\d+\.', stripped):
                in_instructions = True
                # If this is the first instruction and we don't have a header, add one
                if not has_instruction_header and (not current_section or
                                                not any(s.lower().startswith("instruction") for s in current_section)):
                    if current_section:
                        sections.append('\n'.join(current_section))
                    current_section = ["Instructions:"]
                    has_instruction_header = True
                current_section.append(stripped)
                continue
                
            # Handle other lines
            if in_instructions:
                # If this line doesn't look like a new section header, keep it with instructions
                if not re.match(r'^[A-Za-z]+(\s+[A-Za-z]+)*:', stripped) and not stripped.lower() == "nutritional information":
                    current_section.append(stripped)
                else:
                    # This appears to be a new section
                    in_instructions = False
                    if current_section:
                        sections.append('\n'.join(current_section))
                    current_section = [stripped]
            else:
                current_section.append(stripped)
        
        # Add the last section
        if current_section:
            sections.append('\n'.join(current_section))
        
        # Join sections with proper spacing
        result = '\n\n'.join(sections)
        
        # Final cleanup to ensure one blank line between sections
        return re.sub(r'\n{3,}', '\n\n', result)
        
    def _generate_multiple_recipes_from_titles(self, titles, healthy, count=5):
        """Generate multiple recipes in a single API call to save tokens and ensure consistent formatting"""
        # Get only the number of titles we need
        selected_titles = titles[:count]
        titles_str = ", ".join([f'"{title}"' for title in selected_titles])
        
        system_prompt = """You are a culinary expert creating multiple recipes. Follow these formatting instructions precisely:

CRITICAL FORMAT RULES:
1. Each recipe must have these sections IN THIS ORDER:
   - Title (first line)
   - Time/Servings information (in one paragraph)
   - Ingredients (with bullet points •)
   - Instructions (with numbers 1., 2., etc. ALL UNDER ONE "Instructions" HEADER)
   - Nutritional information

2. Section spacing:
   - EXACTLY ONE blank line between sections
   - NO extra blank lines within sections
   - NEVER use bullet points (•) except for ingredients

3. Recipe separation:
   - Separate each recipe with exactly five equals signs: =====
   - Always put a blank line before and after the separator

FORMAT EXAMPLE:
Delicious Recipe Title

Preparation Time: 15 minutes
Cooking Time: 30 minutes
Servings: 4

• 1 cup ingredient one
• 2 tablespoons ingredient two
• 3 teaspoons ingredient three

Instructions:
1. First step instruction details.
2. Second step with more details.
3. Third step with final instructions.

Nutritional Information:
Calories: 350
Protein: 15g
Fat: 12g
Carbohydrates: 45g

=====

Next Recipe Title
...and so on.
"""

        prompt = f"Create {len(selected_titles)} detailed recipes for these titles: {titles_str}. Each recipe must strictly follow my format requirements."
        if healthy:
            prompt += " Make all recipes healthy and nutritious while maintaining the essence of each dish, you can change the name of the dish and come up with your own recipe if the title is obviously not healthy."
        
        try:
            response = self.client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.85,
                max_tokens=2500,
                top_p=0.8
            )
            
            # Get the full response and split by recipe separator
            all_recipes_text = response.choices[0].message.content.strip()
            raw_recipes = all_recipes_text.split("=====")
            processed_recipes = []
            
            for recipe in raw_recipes:
                # Clean up each recipe
                cleaned = recipe.strip()
                if cleaned:
                    # Process recipe to ensure proper formatting
                    processed = self._ensure_recipe_formatting(cleaned)
                    processed_recipes.append(processed)
            
            # If we didn't get enough recipes, make an additional call for the remaining
            if len(processed_recipes) < len(selected_titles):
                missing_count = len(selected_titles) - len(processed_recipes)
                missing_titles = selected_titles[len(processed_recipes):]
                
                # Recursive call to get the remaining recipes
                remaining_recipes = self._generate_multiple_recipes_from_titles(
                    missing_titles,
                    healthy,
                    missing_count
                )
                processed_recipes.extend(remaining_recipes)
            
            return processed_recipes[:count]
                
        except Exception as e:
            print(f"Error generating multiple recipes: {str(e)}")
            # Fall back to individual recipe generation for resilience
            processed_recipes = []
            for title in selected_titles:
                try:
                    recipe = self._generate_single_recipe_from_title(title, healthy)
                    if recipe:
                        processed_recipes.append(recipe)
                except Exception as inner_e:
                    print(f"Error in fallback generation for '{title}': {str(inner_e)}")
            
            return processed_recipes
        
    def _generate_recipes_from_database(self, meal_type, healthy, count=10):
        """Generate recipes based on titles from the database using batch processing"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Query the database for recipe titles
            if meal_type.lower() == "any":
                cursor.execute("SELECT title FROM recipes ORDER BY RANDOM() LIMIT ?", (count*3,))
            else:
                cursor.execute(
                    "SELECT title FROM recipes WHERE category = ? ORDER BY RANDOM() LIMIT ?",
                    (meal_type.lower(), count*3)
                )
                
            # Fetch all matching titles
            titles = [row[0] for row in cursor.fetchall()]
            conn.close()
            
            print(f"Found {len(titles)} titles for {meal_type}")
            
            # If we don't have enough titles, query again for more from any category
            if len(titles) < count and meal_type.lower() != "any":
                conn = sqlite3.connect(self.db_path)
                cursor = conn.cursor()
                
                # Get more random titles to make up the difference
                cursor.execute(
                    "SELECT title FROM recipes ORDER BY RANDOM() LIMIT ?",
                    (count*2 - len(titles),)
                )
                additional_titles = [row[0] for row in cursor.fetchall()]
                titles.extend(additional_titles)
                conn.close()
            
            # We get more titles than needed to account for potential failures
            random.shuffle(titles)
            
            # Generate recipes in batches to save tokens
            batch_size = min(5, count)
            all_recipes = []
            
            for i in range(0, len(titles), batch_size):
                batch_titles = titles[i:i+batch_size]
                if not batch_titles:
                    break
                    
                # Add rate limiting to avoid API limits
                if i > 0:
                    sleep(1)
                    
                batch_recipes = self._generate_multiple_recipes_from_titles(batch_titles, healthy, len(batch_titles))
                all_recipes.extend(batch_recipes)
                
                # If we have enough recipes, stop
                if len(all_recipes) >= count:
                    break
            
            # If we couldn't generate enough recipes from titles, fall back to the original method
            if len(all_recipes) < count:
                print(f"Only generated {len(all_recipes)} recipes from titles, falling back to OpenAI for the remaining {count - len(all_recipes)}")
                remaining_recipes = self._generate_recipes_with_openai(meal_type, healthy, None, count - len(all_recipes))
                all_recipes.extend(remaining_recipes)
            
            return all_recipes[:count]
            
        except Exception as e:
            print(f"Database error in batch processing: {str(e)}")
            # Fall back to OpenAI if database access fails
            return self._generate_recipes_with_openai(meal_type, healthy, None, count)
    
    def _generate_single_recipe_from_title(self, title, healthy):
        """Generate a single recipe based on a title with proper formatting to match frontend expectations"""
        system_prompt = """You are a culinary expert that creates detailed recipes based on titles. Format requirements:
        1. Generate a detailed recipe for the given title.
        2. Format the recipe EXACTLY as follows:
        - Title on the very first line (no word "recipe" in title)
        - Leave a BLANK LINE after the title
        - Time section: Put "Preparation Time: X minutes", "Cooking Time: X minutes", and "Servings: X" together in a SINGLE PARAGRAPH with NO BULLET POINTS
        - Leave a BLANK LINE after the time section
        - Ingredients section: Each ingredient on its own line, each starting with a bullet point (•)
        - Leave a BLANK LINE after the ingredients section
        - Instructions section: Each instruction on its own line, numbered (1., 2., etc.)
        - Leave a BLANK LINE after the instructions section
        - Nutritional information section: Put on its own lines with no blank lines in between
        3. CRITICAL: Make sure to have exactly ONE BLANK LINE between major sections, not multiple blank lines
        4. CRITICAL: DO NOT use bullet points for anything except ingredients
        5. Do not use bold formatting, asterisks, or any special characters except bullet points (•) for ingredients
        6. Never include any separator line (====) in your response
        7. Format example:
        
        Recipe Title
        
        Preparation Time: 15 minutes, Cooking Time: 30 minutes, Servings: 4
        
        • Ingredient 1
        • Ingredient 2
        • Ingredient 3
        
        Instructions:
        1. Instruction step one
        2. Instruction step two
        3. Instruction step three
        
        Nutritional Information (per serving):
        Calories: 350
        Protein: 15g
        Fat: 12g
        Carbohydrates: 45g"""
        
        prompt = f"Create a detailed recipe for: {title}"
        if healthy:
            prompt += " Make it healthy and nutritious while maintaining the essence of the dish."
        
        try:
            response = self.client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.9,
                max_tokens=1500,
                top_p=0.85
            )
            
            recipe_text = response.choices[0].message.content.strip()
            
            # Clean up any residual separators or formatting issues
            recipe_text = recipe_text.replace("===", "").strip()
            
            # Ensure proper section separation with exactly one blank line between sections
            sections = []
            current_section = []
            lines = recipe_text.split("\n")
            
            for i, line in enumerate(lines):
                if not line.strip():
                    # We've hit a blank line
                    if current_section:
                        sections.append("\n".join(current_section))
                        current_section = []
                else:
                    current_section.append(line)
                    
            # Add the last section if there's content
            if current_section:
                sections.append("\n".join(current_section))
            
            # Join sections with a double newline
            final_recipe = "\n\n".join(sections)
            
            return final_recipe
                
        except Exception as e:
            print(f"Error generating recipe for '{title}': {str(e)}")
            return None
    
    def _generate_recipes_with_openai(self, meal_type, healthy, allergies, count=5):
        """Original method to generate recipes using OpenAI without predefined titles"""
        system_prompt = """You are a culinary expert that creates diverse recipes quickly. These recipes should be very unique and outside the box for the most part. Format requirements:
        1. Generate exactly {count} different recipes.. some should be harder than others to make.
        2. Never repeat recipe ideas or cuisines in the batch
        3. Vary cooking methods, ingredients, and cuisine styles
        4. Format each recipe exactly as follows:
        - title far above everything without bolding, or any symbols of any kind (no word "recipe" in title) make it above everything so frontend can put it alone up top
        - Title on first line (no bold, no word "recipe") DO not include the word title... the title should not contain "=" and should be far above everything
        - Preparation Time, Cooking Time, Servings in its OWN LITTLE SECTION....put far below title
        - Ingredients with bullet points (•) on lines far BELOW TITLE(make sure the ingredients are passed below the title)
        - Numbered instructions(specific) specify each step in detail and make sure to include all steps
        - Nutritional information per serving (united states standards... example(calories,protein,fat,carbs)) in OWN BLOCK and make it look modern and seperate by line
        5. Separate each recipe with ===== on its own line and leave space below for each recipe title!
        6. No bold letters or asterisks
        7. Make recipes amazing and think outside the box."""

        # Create a single prompt for multiple recipes
        prompt = f"Create {count} unique {meal_type} recipes, each from different cuisines and cooking styles. If the meal type is not something valid or usual in the united states (ex: dog, human meat, etc) ignore it and default to any meal type."
        
        if healthy:
            prompt += " Make them healthy and nutritious."
            
        if allergies:
            if "vegan" in allergies:
                prompt += f" Ensure the meal is completely vegan and free these allergens or restrictions: {', '.join(allergies)}."
            prompt += f" Ensure they are completely free of these allergens or restrictions (example: vegan, vegetarian): {', '.join(allergies)}."

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
        """Generate recipes based on available ingredients"""
        system_prompt = """You are a culinary expert that creates diverse recipes quickly. Format requirements:
        1. Generate exactly {count} different recipes
        . only generate recipes based on users available ingredients
        IMPORTANT: if a user enters something that is not normal to eat in the United States, ingore it! (ex: dog meat, human meat) or anything that is not usual. Do not give weird recipes that would not be normal
        2. Never repeat recipe ideas or cuisines in the batch
        3. Vary cooking methods, ingredients, and cuisine styles
        4. Format each recipe exactly as follows:
        - Make sure the title is far above everything without bolding, or any symbols of any kind (no word "recipe" in title) make it above everything so frontend can put it alone up top
        - Title on first line (no bold, no word "recipe") DO not include the word title... the title should not contain "="
        - Ingredients with bullet points (•) on lines far BELOW TITLE(make sure the ingredients are passed below the titile)
        - Numbered instructions(specific)
        - Nutritional information per serving (united states standards... example(calories not kc)) in OWN BLOCK make sure this is accurate!
        - Preparation Time, Cooking Time, Servings  in its own little section below nutrition
        5. Separate each recipe with ===== on its own line and leave space below for title!
        6. No bold letters or asterisks
        7. Make recipes amazing and creative
        8. Be very specific with instructions and do not leave anything out... even if you have to add more instructions to achieve this."""
        
        # Create a single prompt for multiple recipes
        prompt = f"Create {count} unique recipes, based on the users available ingredients DO not include extra ingredients (except for spices): {','.join(ingredients)}."
        
        if allergies:
            if "vegan" in allergies:
                prompt += f" Ensure the meal is completely vegan and free these allergens or restrictions: {', '.join(allergies)}."
            prompt += f" Ensure they are completely free of these allergens or restrictions(example:vegan, vegetarian): {', '.join(allergies)}."

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
                second_prompt = f"Create {remaining} more unique recipes, based on available {ingredients} different from: {recipes_list}"
                
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

    def generate_meal_plan(self, days, meals_per_day, healthy=False, allergies=None, preferences=None, calories_per_day=2000, diet_type=None):
        """Generate meal plan with built-in diversity constraints to prevent repetition"""
        
        # Generate diversity constraints with diet considerations
        constraints = self._generate_diversity_constraints(days, meals_per_day, diet_type, allergies)
        diversity_section = self._create_diversity_prompt_section(constraints)
        
        # Simplified system prompt focused on completion
        system_prompt = f"""You are a meal planning expert. Your PRIMARY GOAL is to generate COMPLETE meal plans with ALL requested recipes.

        {diversity_section}

        CRITICAL COMPLETION REQUIREMENTS:
        - You MUST generate exactly {days} days with {meals_per_day} meals each day
        - NEVER skip meals or days - completeness is essential
        - If you can't follow all diversity guidelines perfectly, still generate all recipes
        - Each recipe must be complete with title, timing, ingredients, instructions, and nutrition
        - add the amounts for ingredients (United states standards)

        EXACT FORMAT FOR EACH DAY:
        Day X (where X is 1, 2, 3, etc.)
        
        [MEAL TYPE: Breakfast/Lunch/Dinner/Snack]
        [RECIPE TITLE]
        
        Preparation Time: X minutes
        Cooking Time: X minutes  
        Servings: X
        
        • [Ingredient 1]
        • [Ingredient 2]
        • [Ingredient 3]
        
        Instructions:
        1. [First step]
        2. [Second step]
        3. [Third step]
        
        Nutritional Information:
        Calories: X
        Protein: Xg
        Carbs: Xg
        Fat: Xg
        
        =====
        
        FORMATTING RULES:
        - Recipe title MUST be descriptive (e.g., "Grilled Chicken with Herbs")
        - Separate days with ===== ONLY
        - NO bold text or special formatting
        - Ingredients MUST start with • symbol
        - Instructions MUST be numbered 1., 2., 3., etc.
        """

        # Simplified prompt focused on completion
        prompt = f"""Create a complete {days}-day meal plan with {meals_per_day} meals per day.

Target: {calories_per_day} calories per day total.

MOST IMPORTANT: Generate ALL {days * meals_per_day} recipes. Do not stop early or skip any meals."""

        # Add diet-specific emphasis
        if diet_type and diet_type.lower() != "none":
            prompt += f" Follow {diet_type.upper()} diet guidelines when possible."
        
        if healthy:
            prompt += " Make meals healthy and nutritious."

        if allergies:
            allergies_list = ', '.join(allergies) if isinstance(allergies, list) else allergies
            prompt += f" CRITICAL: Avoid these allergens completely: {allergies_list}."

        if preferences:
            preferences_list = ', '.join(preferences) if isinstance(preferences, list) else preferences
            prompt += f" Consider these preferences: {preferences_list}."

        prompt += f"\n\nRandomization Seed: {constraints['randomization_key']}"

        try:
            response = self.client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,  # Lower temperature for more reliable completion
                max_tokens=4050,
                top_p=0.8,
                timeout=80
            )

            result = response.choices[0].message.content.strip()
            
            # Check if we got a complete response - count the number of recipes
            recipe_count = result.count('=====') + 1 if result else 0
            expected_count = days * meals_per_day
            
            # If we didn't get enough recipes, try a simpler approach
            if recipe_count < expected_count * 0.8:  # If we got less than 80% of expected recipes
                print(f"Got {recipe_count} recipes, expected {expected_count}. Trying fallback approach...")
                return self._generate_simple_meal_plan(days, meals_per_day, healthy, allergies, preferences, calories_per_day, diet_type)
            
            return result

        except Exception as e:
            print(f"Error generating meal plan: {str(e)}")
            # Fallback to simple approach
            return self._generate_simple_meal_plan(days, meals_per_day, healthy, allergies, preferences, calories_per_day, diet_type)

    def _generate_simple_meal_plan(self, days, meals_per_day, healthy=False, allergies=None, preferences=None, calories_per_day=2000, diet_type=None):
        """Fallback method with minimal constraints to ensure completion"""
        
        system_prompt = f"""You are a meal planning expert. Generate a complete {days}-day meal plan with {meals_per_day} meals per day.

        CRITICAL: You MUST generate exactly {days * meals_per_day} complete recipes. Do not stop early.

        FORMAT:
        Day X
        
        [Meal Type]
        [Recipe Title]
        
        Preparation Time: X minutes
        Cooking Time: X minutes
        Servings: X
        
        • Ingredient 1
        • Ingredient 2
        • Ingredient 3
        
        Instructions:
        1. Step one
        2. Step two
        3. Step three
        
        Nutritional Information:
        Calories: X
        Protein: Xg
        Carbs: Xg
        Fat: Xg
        
        ====="""

        prompt = f"Create a complete {days}-day meal plan with {meals_per_day} meals per day. Target {calories_per_day} calories per day."
        
        if diet_type and diet_type.lower() != "none":
            prompt += f" Follow {diet_type} diet."
        
        if allergies:
            prompt += f" Avoid: {', '.join(allergies)}."

        try:
            response = self.client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.5,  # Very low temperature for reliability
                max_tokens=4050,
                top_p=0.7
            )

            return response.choices[0].message.content.strip()

        except Exception as e:
            print(f"Error in fallback meal plan generation: {str(e)}")
            return None
