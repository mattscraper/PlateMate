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
 def generate_meal_plan(self, days, meals_per_day, healthy=False, allergies=None, preferences=None, calories_per_day=2000, retry=False):
    
    random_themes = [
        "quick and easy",
        "chef-inspired",
        "american and italian",
        "greek and american",
        "mexican and american",
        "chinese and american",
        "hearty comfort meals",
        "light and refreshing",
        "flavor-packed favorites",
        "one-pot wonders",
        "weeknight go-tos",
        "global sampler",
        "modern classics",
        "family dinner vibes",
        "lazy weekend meals",
        "bold & spicy",
        "nostalgic favorites",
        "street food inspired",
        "elevated homestyle",
        "rainy day meals",
        "crowd-pleasers",
        "no-fuss cooking",
        "Sunday supper style",
        "grill-inspired dishes",
        "cozy and warm",
        "fast-casual feel",
        "fusion experiments",
        "creative comfort",
        "simple & satisfying",
        "trendy eats",
        "classic with a twist",
        "weekend indulgence",
        "weekday warrior meals",
        "bistro-style ideas",
        "high-energy meals",
        "minimal cleanup"
    ]

    inspiration = random.choice(random_themes)
    print(f"Meal Plan Inspiration: {inspiration}")
    
    # Calculate per-meal calories more intelligently
    calories_per_meal = calories_per_day // meals_per_day
    calories_remainder = calories_per_day % meals_per_day
    
    # Distribute calories smartly based on meal types
    if meals_per_day == 3:
        breakfast_cal = calories_per_meal + (calories_remainder if calories_remainder > 0 else 0)
        lunch_cal = calories_per_meal + (calories_remainder - 1 if calories_remainder > 1 else 0)
        dinner_cal = calories_per_meal + (calories_remainder - 2 if calories_remainder > 2 else 0)
        calorie_breakdown = f"Breakfast: ~{breakfast_cal} cal, Lunch: ~{lunch_cal} cal, Dinner: ~{dinner_cal} cal"
    elif meals_per_day == 4:
        snack_cal = calories_per_meal // 2  # Snacks should be smaller
        main_meal_cal = (calories_per_day - snack_cal) // 3
        calorie_breakdown = f"Breakfast: ~{main_meal_cal} cal, Lunch: ~{main_meal_cal} cal, Dinner: ~{main_meal_cal} cal, Snack: ~{snack_cal} cal"
    else:
        calorie_breakdown = f"Each meal: ~{calories_per_meal} calories"

    # Enhanced system prompt with stricter validation
    system_prompt = f"""You are a professional meal planning expert. Your task is CRITICAL and must be executed PERFECTLY.

ABSOLUTE REQUIREMENTS:
1. Generate EXACTLY {days} days with EXACTLY {meals_per_day} meals each day
2. Each day's meals MUST total {calories_per_day} calories (±25 calories maximum deviation)
3. {calorie_breakdown}
4. NEVER repeat any recipe across the entire plan
5. Every recipe MUST be complete with all sections

MANDATORY FORMAT FOR EACH MEAL:
[Meal Type] (Breakfast/Lunch/Dinner/Snack)

[Recipe Title - Be Creative, Avoid Theme Words in Every Title]

Preparation Time: X minutes
Cooking Time: X minutes
Servings: X

• [Ingredient with amount]
• [Ingredient with amount]
• [Ingredient with amount]
(Include 5-8 ingredients minimum)

Instructions:
1. [Detailed cooking step]
2. [Detailed cooking step] 
3. [Detailed cooking step]
(Include 4-6 steps minimum)

Nutritional Information:
Calories: X
Protein: Xg
Carbs: Xg
Fat: Xg

=====

CRITICAL FORMATTING RULES:
- Recipe titles must be CREATIVE and VARIED - don't overuse theme words
- If theme is "bistro-style", only 1-2 recipes should mention "bistro", others should be creative
- Calories MUST add up to {calories_per_day} per day (this is CRITICAL)
- Each recipe title must be on its own line after meal type
- NO special formatting (**, *, etc.)
- Ingredients MUST have • bullet points with specific amounts
- Instructions MUST be numbered 1., 2., 3., etc.
- Separate days with ===== ONLY
- Include realistic prep/cook times
- Nutritional info must be accurate for the ingredients listed

CALORIE ACCURACY IS MANDATORY - Double-check that daily totals equal {calories_per_day}."""

    # Build prompt based on retry status
    if retry:
        prompt = f"""RETRY REQUEST: The previous meal plan had quality issues. Please generate a HIGH-QUALITY {days}-day meal plan with {meals_per_day} meals per day.

CRITICAL REQUIREMENTS:
- EXACTLY {calories_per_day} calories per day (this is MANDATORY)
- Detailed, complete recipes with specific ingredients and amounts
- Creative recipe titles that don't overuse the theme "{inspiration}"
- {calorie_breakdown}
- All {days * meals_per_day} recipes must be fully detailed and unique

This is a retry, so please take extra care with accuracy and completeness."""
    else:
        prompt = f"""Create a {days}-day meal plan with {meals_per_day} meals per day, targeting EXACTLY {calories_per_day} calories per day.

Theme inspiration: {inspiration} (use this as general inspiration, but don't put theme words in every recipe title)

MANDATORY: Each day must total {calories_per_day} calories. {calorie_breakdown}"""

    # Handle optional parameters
    if healthy:
        prompt += "\n\nMake all meals healthy and nutritious with fresh ingredients, lean proteins, and vegetables."

    if allergies:
        allergies_list = ', '.join(allergies) if isinstance(allergies, list) else allergies
        prompt += f"\n\nEnsure ALL recipes are completely free of these allergens: {allergies_list}. Double-check every ingredient."

    if preferences:
        preferences_list = ', '.join(preferences) if isinstance(preferences, list) else preferences
        prompt += f"\n\nConsider these dietary preferences: {preferences_list}."

    prompt += f"\n\nRemember: Generate ALL {days * meals_per_day} complete recipes. Every day must total {calories_per_day} calories."

    max_retries = 3
    for attempt in range(max_retries):
        try:
            print(f"Generating meal plan (attempt {attempt + 1}/{max_retries})...")
            
            # Adjust parameters based on attempt
            if attempt == 0:
                temperature = 0.3
                max_tokens = 4000
            elif attempt == 1:
                temperature = 0.2
                max_tokens = 4000
            else:  # Final attempt
                temperature = 0.1
                max_tokens = 4000
                prompt += "\n\nFINAL ATTEMPT: This must be perfect. Include every required section for every meal."

            response = self.client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt}
                ],
                temperature=temperature,
                max_tokens=max_tokens,
                timeout=120
            )

            meal_plan = response.choices[0].message.content.strip()
            
            # Validate the response
            if self._validate_meal_plan(meal_plan, days, meals_per_day, calories_per_day):
                print(f"✅ Meal plan generated successfully on attempt {attempt + 1}")
                return meal_plan
            else:
                print(f"❌ Attempt {attempt + 1} failed validation")
                if attempt < max_retries - 1:
                    print("Retrying with adjusted parameters...")
                    continue

        except Exception as e:
            print(f"❌ Error on attempt {attempt + 1}: {str(e)}")
            if attempt < max_retries - 1:
                print("Retrying...")
                continue

    # If all attempts failed, return a more detailed error
    print("❌ All attempts failed to generate a valid meal plan")
    return None

def _validate_meal_plan(self, meal_plan, expected_days, expected_meals_per_day, expected_calories):
    """Validate that the meal plan meets basic requirements"""
    if not meal_plan or len(meal_plan.strip()) < 500:
        print("❌ Validation failed: Meal plan too short")
        return False
    
    # Check for required number of days
    day_markers = len([line for line in meal_plan.split('\n') if line.strip().startswith('Day ')])
    if day_markers < expected_days:
        print(f"❌ Validation failed: Found {day_markers} days, expected {expected_days}")
        return False
    
    # Check for meal types
    meal_types = ['Breakfast', 'Lunch', 'Dinner', 'Snack']
    meal_count = 0
    for meal_type in meal_types[:expected_meals_per_day]:
        meal_count += len([line for line in meal_plan.split('\n') if line.strip() == meal_type])
    
    expected_total_meals = expected_days * expected_meals_per_day
    if meal_count < expected_total_meals * 0.8:  # Allow some flexibility
        print(f"❌ Validation failed: Found {meal_count} meals, expected ~{expected_total_meals}")
        return False
    
    # Check for required sections
    required_sections = ['Preparation Time:', 'Cooking Time:', 'Servings:', 'Instructions:', 'Nutritional Information:']
    for section in required_sections:
        if meal_plan.count(section) < expected_total_meals * 0.7:  # Allow some missing
            print(f"❌ Validation failed: Missing section '{section}'")
            return False
    
    # Check for calorie information
    calorie_lines = [line for line in meal_plan.split('\n') if 'Calories:' in line]
    if len(calorie_lines) < expected_total_meals * 0.7:
        print(f"❌ Validation failed: Missing calorie information")
        return False
    
    print("✅ Meal plan passed basic validation")
    return True
