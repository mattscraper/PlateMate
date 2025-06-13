from openai import OpenAI
import os
import sqlite3
import random
from time import sleep
from dotenv import load_dotenv
import re
import random

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
            
    def get_recipe_ideas(self, meal_type, healthy, allergies, count=5):
        # If there are allergies, use the original method to generate recipes
        meal_type_valid = ["breakfast","lunch","dinenr","snack","dessert"]
        if allergies:
            print(f"Using original method due to allergies: {allergies}")
            return self._generate_recipes_with_openai(meal_type, healthy, allergies, count)
        if meal_type not in meal_type_valid:
            print(f"meal type is custom, default to original method: {meal_type}")
            return self._generate_recipes_with_openai(meal_type,healthy,allergies,count)
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

(make sure instructions is in its own little category)
1. First step instruction details.
2. Second step with more details.
3. Third step with final instructions.

(make sure nutrition is in its own little category)
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
                max_tokens=2500,  # Increased to accommodate multiple recipes
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
            
            return processed_recipes[:count]  # Ensure we only return the requested number
                
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
            batch_size = min(5, count)  # Process 5 recipes at a time, or fewer if requested
            all_recipes = []
            
            for i in range(0, len(titles), batch_size):
                batch_titles = titles[i:i+batch_size]
                if not batch_titles:
                    break
                    
                # Add rate limiting to avoid API limits
                if i > 0:
                    sleep(1)  # Sleep between batches
                    
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
                    if current_section:  # If we have content, add it as a section
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
        # This method remains unchanged from the original
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
        prompt = f"Create {count} unique recipes, based on the users available ingridients DO not include extra ingredients (except for spices): {','.join(ingredients)}."
        
            
        if allergies:
            if "vegan" in allergies:
                prompt += f" Ensure the meal is completely vegan and free these allergens or restrictions: {', '.join(allergies)}."
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
    
  
  #we are still having problems with the meal plan generator not generating all of the recipes.... we need to find a catcher for this
  
    #this needs to be changed to handle similiar recipes appearing after many queries
  
    def generate_meal_plan(self, days, meals_per_day, healthy=False, allergies=None, preferences=None, calories_per_day=2000):
        """Generate a complete meal plan with retry logic and validation"""
        
        max_retries = 3
        retry_delay = 2  # seconds
        
        random_themes = [
            "quick and easy", "chef-inspired", "american and italian", "greek and american",
            "mexican and american", "chinese and american", "hearty comfort meals",
            "light and refreshing", "flavor-packed favorites", "one-pot wonders",
            "weeknight go-tos", "global sampler", "modern classics", "family dinner vibes",
            "lazy weekend meals", "bold & spicy", "nostalgic favorites", "street food inspired",
            "elevated homestyle", "rainy day meals", "crowd-pleasers", "no-fuss cooking",
            "Sunday supper style", "grill-inspired dishes", "cozy and warm",
            "fast-casual feel", "fusion experiments", "creative comfort",
            "simple & satisfying", "trendy eats", "classic with a twist",
            "weekend indulgence", "weekday warrior meals", "bistro-style ideas",
            "high-energy meals", "minimal cleanup"
        ]

        inspiration = random.choice(random_themes)
        print(f"Meal Plan Inspiration: {inspiration}")
        
        # Try generating the complete plan multiple times
        for attempt in range(max_retries):
            try:
                print(f"Generation attempt {attempt + 1}/{max_retries}")
                
                result = self._generate_single_meal_plan_attempt(
                    days, meals_per_day, healthy, allergies, preferences,
                    calories_per_day, inspiration
                )
                
                if result and self._validate_meal_plan(result, days, meals_per_day):
                    print("✅ Successfully generated complete meal plan")
                    return result
                else:
                    print(f"❌ Attempt {attempt + 1} failed validation")
                    if attempt < max_retries - 1:
                        print(f"Retrying in {retry_delay} seconds...")
                        time.sleep(retry_delay)
                        
            except Exception as e:
                print(f"❌ Attempt {attempt + 1} failed with error: {str(e)}")
                if attempt < max_retries - 1:
                    print(f"Retrying in {retry_delay} seconds...")
                    time.sleep(retry_delay)
        
        # If all attempts failed with the full plan, try day-by-day generation
        print("🔄 All full-plan attempts failed, trying day-by-day generation...")
        try:
            return self._generate_day_by_day(days, meals_per_day, healthy, allergies, preferences, calories_per_day)
        except Exception as e:
            print(f"❌ Day-by-day generation also failed: {str(e)}")
            # Return None instead of incomplete data - let the frontend handle the error
            return None

    def _generate_single_meal_plan_attempt(self, days, meals_per_day, healthy, allergies, preferences, calories_per_day, inspiration):
        """Single attempt at generating a meal plan"""
        
        # Updated system prompt with stricter requirements
        system_prompt = f"""You are a meal planning expert. You MUST generate EXACTLY {days} complete days with EXACTLY {meals_per_day} meals each day.

    CRITICAL REQUIREMENTS:
    1. Generate EXACTLY {days} days with EXACTLY {meals_per_day} meals each day
    2. NEVER repeat recipes in the plan
    3. Each day MUST have exactly {meals_per_day} complete meals - NO EXCEPTIONS
    4. Target {calories_per_day} calories per day total
    5. EVERY recipe must be fully complete with all sections

    EXACT FORMAT FOR EACH MEAL:
    [MEAL TYPE] (Breakfast/Lunch/Dinner/Snack)

    [RECIPE TITLE - NO ingredients or measurements in title]

    Preparation Time: X minutes
    Cooking Time: X minutes  
    Servings: X

    Ingredients:
    • [Ingredient 1]
    • [Ingredient 2]
    • [Ingredient 3]
    • [Continue with all ingredients]

    Instructions:
    1. [First step]
    2. [Second step]
    3. [Continue with all steps]

    Nutritional Information:
    Calories: X
    Protein: Xg
    Carbs: Xg
    Fat: Xg

    =====

    CRITICAL RULES:
    - You MUST generate ALL {days * meals_per_day} recipes completely
    - Each recipe MUST have all sections: title, times, ingredients, instructions, nutrition
    - Recipe titles CANNOT contain ingredients or measurements
    - Calories must total approximately {calories_per_day} per day
    - Separate each meal with ===== ONLY
    - NO partial recipes or incomplete meals allowed
    - If you cannot fit everything, prioritize completeness over elaborate descriptions

    VALIDATION: Before submitting, count your recipes. You MUST have exactly {days * meals_per_day} complete recipes."""

        # Build the prompt
        prompt = f"Create a COMPLETE {days}-day meal plan with {meals_per_day} meals per day, targeting {calories_per_day} calories per day with the theme '{inspiration}'. You MUST generate ALL {days * meals_per_day} recipes completely."

        if healthy:
            prompt += " Make all meals healthy and nutritious."

        if allergies:
            allergies_list = ', '.join(allergies) if isinstance(allergies, list) else allergies
            prompt += f" Ensure all recipes are completely free of: {allergies_list}."

        if preferences:
            preferences_list = ', '.join(preferences) if isinstance(preferences, list) else preferences
            prompt += f" Consider these preferences: {preferences_list}."

        prompt += f"\n\nRemember: You MUST generate exactly {days * meals_per_day} complete recipes. Count them before submitting."

        # Use GPT-4 if available, otherwise stick with GPT-3.5 but with higher limits
        try:
            # Try GPT-4 first for better reliability
            response = self.client.chat.completions.create(
                model="gpt-4-turbo-preview",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=8000,
                timeout=120
            )
        except Exception as gpt4_error:
            print(f"GPT-4 failed, falling back to GPT-3.5: {gpt4_error}")
            # Fallback to GPT-3.5 with optimized settings
            response = self.client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.5,
                max_tokens=4000,  # Slightly reduced but still high
                timeout=120
            )

        return response.choices[0].message.content.strip()

    def _validate_meal_plan(self, meal_plan_text, expected_days, expected_meals_per_day):
        """Validate that the meal plan contains the expected number of complete recipes"""
        if not meal_plan_text:
            return False
        
        try:
            # Count meal type declarations
            meal_types = ['Breakfast', 'Lunch', 'Dinner', 'Snack']
            total_meals_found = 0
            
            for meal_type in meal_types:
                # Count occurrences of each meal type
                count = meal_plan_text.lower().count(meal_type.lower())
                total_meals_found += count
            
            expected_total = expected_days * expected_meals_per_day
            
            # Also check for recipe completeness indicators
            ingredients_sections = meal_plan_text.count('Ingredients:')
            instructions_sections = meal_plan_text.count('Instructions:')
            nutrition_sections = meal_plan_text.count('Nutritional Information:')
            
            print(f"Validation results:")
            print(f"  Total meals found: {total_meals_found}/{expected_total}")
            print(f"  Ingredients sections: {ingredients_sections}")
            print(f"  Instructions sections: {instructions_sections}")
            print(f"  Nutrition sections: {nutrition_sections}")
            
            # Consider valid if we have at least 90% of expected meals and all key sections
            min_required = int(expected_total * 0.9)
            
            return (total_meals_found >= min_required and
                    ingredients_sections >= min_required and
                    instructions_sections >= min_required and
                    nutrition_sections >= min_required)
                    
        except Exception as e:
            print(f"Validation error: {e}")
            return False

    def _generate_day_by_day(self, days, meals_per_day, healthy, allergies, preferences, calories_per_day):
        """Alternative method: Generate one day at a time for large meal plans"""
        
        random_themes = [
            "quick and easy", "chef-inspired", "american and italian", "greek and american",
            "mexican and american", "chinese and american", "hearty comfort meals",
            "light and refreshing", "flavor-packed favorites", "one-pot wonders"
        ]
        
        all_days = []
        used_recipes = set()  # Track used recipes to avoid duplicates
        max_retries = 3
        
        for day_num in range(1, days + 1):
            print(f"Generating Day {day_num}...")
            
            for attempt in range(max_retries):
                try:
                    inspiration = random.choice(random_themes)
                    day_result = self._generate_single_day(
                        day_num, meals_per_day, healthy, allergies, preferences,
                        calories_per_day, inspiration, used_recipes
                    )
                    
                    if day_result and self._validate_single_day(day_result, meals_per_day):
                        all_days.append(day_result)
                        # Extract recipe titles to avoid duplicates
                        day_recipes = self._extract_recipe_titles(day_result)
                        used_recipes.update(day_recipes)
                        print(f"✅ Day {day_num} generated successfully")
                        break
                    else:
                        print(f"Day {day_num} attempt {attempt + 1} failed validation")
                        if attempt < max_retries - 1:
                            time.sleep(1)
                            
                except Exception as e:
                    print(f"Day {day_num} attempt {attempt + 1} failed: {e}")
                    if attempt < max_retries - 1:
                        time.sleep(1)
            else:
                raise Exception(f"Failed to generate Day {day_num} after all attempts")
        
        # Combine all days
        return "\n\n".join(all_days)

    def _generate_single_day(self, day_num, meals_per_day, healthy, allergies, preferences, calories_per_day, inspiration, used_recipes):
        """Generate a single day's meal plan"""
        
        meal_order = ['Breakfast', 'Lunch', 'Dinner', 'Snack'][:meals_per_day]
        
        system_prompt = f"""Generate EXACTLY {meals_per_day} complete meals for Day {day_num}.

    REQUIREMENTS:
    - Generate exactly {meals_per_day} meals: {', '.join(meal_order)}
    - Target {calories_per_day} total calories for the day
    - Theme: {inspiration}
    - Each meal must have: title, prep/cook times, ingredients list, instructions, nutrition info
    - DO NOT use these recipe titles: {', '.join(list(used_recipes)[:10]) if used_recipes else 'None'}

    FORMAT each meal exactly like this:
    [MEAL TYPE]

    [Recipe Title]

    Preparation Time: X minutes
    Cooking Time: X minutes
    Servings: X

    Ingredients:
    • [ingredient 1]
    • [ingredient 2]

    Instructions:
    1. [step 1]
    2. [step 2]

    Nutritional Information:
    Calories: X
    Protein: Xg
    Carbs: Xg
    Fat: Xg

    ====="""

        prompt = f"Generate Day {day_num} meal plan with {meals_per_day} complete meals."
        
        if healthy:
            prompt += " Make meals healthy and nutritious."
        if allergies:
            allergies_list = ', '.join(allergies) if isinstance(allergies, list) else allergies
            prompt += f" Avoid: {allergies_list}."
        if preferences:
            preferences_list = ', '.join(preferences) if isinstance(preferences, list) else preferences
            prompt += f" Preferences: {preferences_list}."

        try:
            # Try GPT-4 first, fallback to GPT-3.5
            response = self.client.chat.completions.create(
                model="gpt-4-turbo-preview",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=4000,
                timeout=60
            )
        except Exception:
            # Fallback to GPT-3.5
            response = self.client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.5,
                max_tokens=3000,
                timeout=60
            )

        return response.choices[0].message.content.strip()

    def _validate_single_day(self, day_text, expected_meals):
        """Validate a single day has all required meals"""
        meal_types = ['Breakfast', 'Lunch', 'Dinner', 'Snack'][:expected_meals]
        
        for meal_type in meal_types:
            if meal_type.lower() not in day_text.lower():
                return False
                
        return ('Ingredients:' in day_text and
                'Instructions:' in day_text and
                'Nutritional Information:' in day_text)

    def _extract_recipe_titles(self, day_text):
        """Extract recipe titles from a day's meal plan"""
        lines = day_text.split('\n')
        titles = []
        
        meal_types = ['Breakfast', 'Lunch', 'Dinner', 'Snack']
        
        for i, line in enumerate(lines):
            line = line.strip()
            if any(meal_type in line for meal_type in meal_types):
                # Look for the title in the next few lines
                for j in range(i + 1, min(i + 4, len(lines))):
                    next_line = lines[j].strip()
                    if (next_line and
                        not next_line.startswith('Preparation') and
                        not next_line.startswith('Cooking') and
                        not next_line.startswith('Servings') and
                        not next_line.startswith('•') and
                        not next_line.startswith('Ingredients') and
                        len(next_line) > 3):
                        titles.append(next_line.lower())
                        break
        
        return titles
