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
    
    def _get_realistic_calorie_distribution(self, total_calories, meals_per_day):
        """Calculate realistic calorie distribution for different meals"""
        if meals_per_day == 1:
            return [total_calories]
        elif meals_per_day == 2:
            # Lunch/Dinner split
            lunch = int(total_calories * 0.45)
            dinner = total_calories - lunch
            return [lunch, dinner]
        elif meals_per_day == 3:
            # Breakfast, Lunch, Dinner
            breakfast = int(total_calories * 0.25)  # 25%
            lunch = int(total_calories * 0.35)      # 35%
            dinner = total_calories - breakfast - lunch  # 40%
            return [breakfast, lunch, dinner]
        elif meals_per_day == 4:
            # Breakfast, Lunch, Dinner, Snack
            breakfast = int(total_calories * 0.25)  # 25%
            lunch = int(total_calories * 0.30)      # 30%
            dinner = int(total_calories * 0.35)     # 35%
            snack = total_calories - breakfast - lunch - dinner  # 10%
            return [breakfast, lunch, dinner, snack]
        else:
            # Default to equal distribution for more than 4 meals
            base_calories = total_calories // meals_per_day
            remainder = total_calories % meals_per_day
            calories = [base_calories] * meals_per_day
            # Distribute remainder
            for i in range(remainder):
                calories[i] += 1
            return calories
            
    def get_recipe_ideas(self, meal_type, healthy, allergies, count=5):
        # If there are allergies, use the original method to generate recipes
        meal_type_valid = ["breakfast","lunch","dinner","snack","dessert"]
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
        
    def _generate_multiple_recipes_from_titles(self, titles, healthy, calorie_targets):
        """Generate multiple recipes with specific calorie targets"""
        if len(titles) != len(calorie_targets):
            raise ValueError("Number of titles must match number of calorie targets")
            
        selected_titles = titles[:len(calorie_targets)]
        titles_and_calories = [(title, cal) for title, cal in zip(selected_titles, calorie_targets)]
        
        system_prompt = f"""You are a culinary expert creating multiple recipes with PRECISE calorie targets. Follow these formatting instructions:

        CRITICAL FORMAT RULES:
        1. Each recipe must have these sections IN THIS ORDER:
           - Title (first line, descriptive and clear)
           - Time/Servings information (in one paragraph)
           - Ingredients (with bullet points •)
           - Instructions (with numbers 1., 2., etc. ALL UNDER ONE "Instructions" HEADER)
           - Nutritional information (MUST be accurate to the EXACT target calories specified)

        2. CALORIE REQUIREMENTS - VERY IMPORTANT:
           - Each recipe MUST hit the EXACT calorie target specified for that recipe
           - Nutritional information must be realistic and mathematically accurate
           - Protein: aim for 20-30% of calories (divide calories by 4 for grams)
           - Carbs: aim for 40-50% of calories (divide calories by 4 for grams) 
           - Fat: aim for 25-35% of calories (divide calories by 9 for grams)
           - Adjust portion sizes and ingredients to hit the exact calorie target

        3. Section spacing:
           - EXACTLY ONE blank line between sections
           - NO extra blank lines within sections
           - NEVER use bullet points (•) except for ingredients

        4. Recipe separation:
           - Separate each recipe with exactly five equals signs: =====
           - Always put a blank line before and after the separator

        FORMAT EXAMPLE:
        Recipe Title Here

        Preparation Time: 15 minutes
        Cooking Time: 30 minutes
        Servings: 1

        • Ingredient amounts calculated for exact calorie target
        • Second ingredient with precise measurements
        • Third ingredient as needed

        Instructions:
        1. First step with specific cooking details.
        2. Second step with timing and techniques.
        3. Final step to complete the dish.

        Calories: [EXACT TARGET CALORIES]
        Protein: [CALCULATED]g
        Carbs: [CALCULATED]g
        Fat: [CALCULATED]g

        =====
        """

        prompt = f"Create {len(selected_titles)} recipes with these EXACT calorie targets:\n"
        for i, (title, calories) in enumerate(titles_and_calories):
            prompt += f"{i+1}. \"{title}\" - MUST be exactly {calories} calories\n"
        
        prompt += f"\nEach recipe must hit its exact calorie target by adjusting portion sizes and ingredients accordingly."
        
        if healthy:
            prompt += " Make all recipes healthy and nutritious while maintaining the exact calorie targets."
        
        try:
            response = self.client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
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
            
            return processed_recipes[:len(calorie_targets)]
                
        except Exception as e:
            print(f"Error generating multiple recipes: {str(e)}")
            # Fall back to individual recipe generation for resilience
            processed_recipes = []
            for title, target_calories in titles_and_calories:
                try:
                    recipe = self._generate_single_recipe_from_title(title, healthy, target_calories)
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
            
            # Use realistic calorie distribution for the requested count
            if hasattr(self, 'calories_per_day') and hasattr(self, 'target_meals_per_day'):
                calorie_distribution = self._get_realistic_calorie_distribution(self.calories_per_day, count)
            else:
                # Default distribution if not set
                default_calories = 500
                calorie_distribution = [default_calories] * count
            
            # Generate recipes in batches with specific calorie targets
            batch_size = min(5, count)
            all_recipes = []
            
            for i in range(0, len(titles), batch_size):
                batch_titles = titles[i:i+batch_size]
                batch_calories = calorie_distribution[i:i+batch_size]
                
                if not batch_titles:
                    break
                    
                # Add rate limiting to avoid API limits
                if i > 0:
                    sleep(1)
                    
                batch_recipes = self._generate_multiple_recipes_from_titles(batch_titles, healthy, batch_calories)
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
    
    def _generate_single_recipe_from_title(self, title, healthy, target_calories=None):
        """Generate a single recipe based on a title with specific calorie target"""
        
        # Use provided target or default
        if target_calories is None:
            target_calories = getattr(self, 'target_calories_per_recipe', 500)
        
        system_prompt = f"""You are a culinary expert that creates detailed recipes based on titles. Format requirements:
        1. Generate a detailed recipe for the given title.
        2. Target calories: {target_calories} per serving - THIS MUST BE EXACT
        3. Adjust ingredient portions and serving size to hit the exact calorie target
        4. Format the recipe EXACTLY as follows:
        - Title on the very first line (clear, descriptive, no word "recipe")
        - Leave a BLANK LINE after the title
        - Time section: Put "Preparation Time: X minutes", "Cooking Time: X minutes", and "Servings: X" together in a SINGLE PARAGRAPH
        - Leave a BLANK LINE after the time section
        - Ingredients section: Each ingredient on its own line, each starting with a bullet point (•)
        - Leave a BLANK LINE after the ingredients section
        - Instructions section: Each instruction on its own line, numbered (1., 2., etc.)
        - Leave a BLANK LINE after the instructions section
        - Nutritional information section: Must be accurate to target calories
        5. CRITICAL: Make sure calories = {target_calories} EXACTLY, and other macros are realistic
        6. CRITICAL: Make sure to have exactly ONE BLANK LINE between major sections
        7. Do not use bold formatting, asterisks, or any special characters except bullet points (•) for ingredients
        8. Never include any separator line (====) in your response
        
        Macro targets for {target_calories} calories:
        - Protein: {int(target_calories * 0.25 / 4)}g (25% of calories)
        - Carbs: {int(target_calories * 0.45 / 4)}g (45% of calories) 
        - Fat: {int(target_calories * 0.30 / 9)}g (30% of calories)"""
        
        prompt = f"Create a detailed recipe for: {title}. Must be exactly {target_calories} calories per serving. Adjust ingredient amounts and serving size to achieve this exact calorie count."
        if healthy:
            prompt += " Make it healthy and nutritious while maintaining the exact target calorie count."
        
        try:
            response = self.client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=1500,
                top_p=0.8
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
        # Get realistic calorie distribution if available
        if hasattr(self, 'calories_per_day') and hasattr(self, 'target_meals_per_day'):
            calorie_distribution = self._get_realistic_calorie_distribution(self.calories_per_day, count)
            calorie_targets_text = "\n".join([f"Recipe {i+1}: {cal} calories" for i, cal in enumerate(calorie_distribution)])
        else:
            calorie_distribution = [500] * count  # Default
            calorie_targets_text = f"Each recipe: 500 calories"
        
        system_prompt = f"""You are a culinary expert that creates diverse recipes quickly. These recipes should be very unique and outside the box for the most part. Format requirements:
        1. Generate exactly {count} different recipes with SPECIFIC calorie targets as provided
        2. Never repeat recipe ideas or cuisines in the batch
        3. Vary cooking methods, ingredients, and cuisine styles
        4. Each recipe must hit its EXACT calorie target by adjusting portions and ingredients
        5. Format each recipe exactly as follows:
        - title far above everything without bolding, or any symbols of any kind (no word "recipe" in title) make it above everything so frontend can put it alone up top
        - Title on first line (no bold, no word "recipe") DO not include the word title... the title should not contain "=" and should be far above everything
        - Preparation Time, Cooking Time, Servings in its OWN LITTLE SECTION....put far below title
        - Ingredients with bullet points (•) on lines far BELOW TITLE(make sure the ingredients are passed below the title)
        - Numbered instructions(specific) specify each step in detail and make sure to include all steps
        - Nutritional information per serving (united states standards... example(calories,protein,fat,carbs)) in OWN BLOCK and make it look modern and seperate by line
        6. Separate each recipe with ===== on its own line and leave space below for each recipe title!
        7. No bold letters or asterisks
        8. Make recipes amazing and think outside the box.
        
        CALORIE TARGETS (MUST BE EXACT):
        {calorie_targets_text}"""

        # Create a single prompt for multiple recipes
        prompt = f"Create {count} unique {meal_type} recipes, each from different cuisines and cooking styles, with the exact calorie targets specified. If the meal type is not something valid or usual in the united states (ex: dog, human meat, etc) ignore it and default to any meal type."
        
        if healthy:
            prompt += " Make them healthy and nutritious while hitting exact calorie targets."
            
        if allergies:
            if "vegan" in allergies:
                prompt += f" Ensure the meal is completely vegan and free these allergens or restrictions: {', '.join(allergies)}."
            prompt += f" Ensure they are completely free of these allergens or restrictions (example: vegan, vegetarian): {', '.join(allergies)}."

        try:
            response = self.client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": system_prompt},
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
                        {"role": "system", "content": system_prompt},
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
    
    def generate_meal_plan(self, days, meals_per_day, healthy=False, allergies=None, preferences=None, calories_per_day=2000):
        """Simple, reliable meal plan generation with realistic calorie distribution"""
        
        # Store calories for use in recipe generation
        self.calories_per_day = calories_per_day
        self.target_meals_per_day = meals_per_day
        
        # Calculate realistic calorie distribution
        daily_calorie_distribution = self._get_realistic_calorie_distribution(calories_per_day, meals_per_day)
        
        print(f"Daily calorie distribution: {daily_calorie_distribution}")
        print(f"Total daily calories: {sum(daily_calorie_distribution)}")
        
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
        
        # For larger plans, generate day by day for reliability
        if days > 3 or (days * meals_per_day) > 9:
            return self._generate_day_by_day_realistic(days, meals_per_day, healthy, allergies, preferences, calories_per_day, daily_calorie_distribution, inspiration)
        
        # For small plans, try full generation with retries
        max_retries = 3
        for attempt in range(max_retries):
            try:
                print(f"Attempt {attempt + 1}/{max_retries} for full plan generation")
                result = self._generate_full_plan_realistic(days, meals_per_day, healthy, allergies, preferences, calories_per_day, daily_calorie_distribution, inspiration)
                
                if self._validate_plan_simple(result, days, meals_per_day):
                    print("✅ Full plan generation successful")
                    return result
                else:
                    print(f"❌ Attempt {attempt + 1} failed validation")
                    if attempt < max_retries - 1:
                        sleep(2)
                        
            except Exception as e:
                print(f"❌ Attempt {attempt + 1} error: {str(e)}")
                if attempt < max_retries - 1:
                    sleep(2)
        
        # If full plan fails, fallback to day-by-day
        print("🔄 Full plan failed, switching to day-by-day generation")
        return self._generate_day_by_day_realistic(days, meals_per_day, healthy, allergies, preferences, calories_per_day, daily_calorie_distribution, inspiration)

    def _generate_full_plan_realistic(self, days, meals_per_day, healthy, allergies, preferences, calories_per_day, daily_calorie_distribution, inspiration):
        """Generate complete meal plan with realistic calorie distribution"""
        
        meal_types = ['Breakfast', 'Lunch', 'Dinner', 'Snack'][:meals_per_day]
        
        # Create calorie targets for each meal across all days
        all_meal_calories = []
        for day in range(days):
            all_meal_calories.extend(daily_calorie_distribution)
        
        system_prompt = f"""You are a meal planning expert. Generate EXACTLY {days} days with EXACTLY {meals_per_day} meals each day.

        CRITICAL REQUIREMENTS:
        - Generate ALL {days * meals_per_day} completely UNIQUE recipes
        - Use these meal types in order: {', '.join(meal_types)}
        - Each recipe MUST hit its EXACT calorie target as specified below
        - NEVER repeat any recipe titles, ingredients combinations, or cooking methods
        - Each recipe MUST be from a different cuisine or cooking style
        - Adjust portion sizes and ingredients to hit exact calorie targets

        EXACT CALORIE TARGETS PER MEAL:
        {self._format_calorie_targets_for_prompt(days, meals_per_day, daily_calorie_distribution)}

        VARIETY REQUIREMENTS:
        - Use different protein sources: chicken, fish, beef, pork, tofu, eggs, beans, etc.
        - Use different cooking methods: grilled, baked, sautéed, steamed, roasted, stir-fried, etc.
        - Use different cuisines: Italian, Mexican, Asian, Mediterranean, Indian, French, etc.
        - Use different main ingredients and flavor profiles

        EXACT FORMAT:
        Day 1

        Breakfast

        Unique Recipe Title Here

        Preparation Time: 15 minutes
        Cooking Time: 20 minutes
        Servings: 1

        • Ingredient 1 (amounts calculated for exact calories)
        • Ingredient 2 (precise measurements)
        • Ingredient 3 (as needed for target)

        Instructions:
        1. Step one with specific details
        2. Step two with timing
        3. Step three to completion

        Nutritional Information:
        Calories: [EXACT TARGET CALORIES]
        Protein: [CALCULATED]g
        Carbs: [CALCULATED]g
        Fat: [CALCULATED]g

        =====

        Lunch

        Completely Different Recipe Title

        (same format...)

        =====

        (Continue for all meals and days)

        RULES:
        - Separate each meal with =====
        - Start each day with "Day X"
        - Recipe titles must be descriptive and UNIQUE
        - Hit EXACT calorie targets by adjusting portions
        - Use • for ingredients only
        - Number instructions 1., 2., 3.
        - Make every single recipe completely different from all others"""

        prompt = f"Create a {days}-day meal plan with {meals_per_day} completely unique meals per day, theme: {inspiration}. Each meal must hit its exact calorie target as specified. Total daily calories: {calories_per_day}."
        
        if healthy:
            prompt += " Make all meals healthy and nutritious while hitting exact calorie targets."
        if allergies:
            allergies_list = ', '.join(allergies) if isinstance(allergies, list) else allergies
            prompt += f" Avoid these allergens: {allergies_list}."
        if preferences:
            preferences_list = ', '.join(preferences) if isinstance(preferences, list) else preferences
            prompt += f" Consider preferences: {preferences_list}."

        try:
            response = self.client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.8,
                max_tokens=4000,
                timeout=120
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            print(f"Full plan generation error: {e}")
            return None

    def _format_calorie_targets_for_prompt(self, days, meals_per_day, daily_calorie_distribution):
        """Format calorie targets in a clear way for the AI prompt"""
        meal_types = ['Breakfast', 'Lunch', 'Dinner', 'Snack'][:meals_per_day]
        
        result = []
        for day in range(1, days + 1):
            result.append(f"Day {day}:")
            for i, meal_type in enumerate(meal_types):
                calories = daily_calorie_distribution[i]
                result.append(f"  {meal_type}: {calories} calories")
        
        return "\n".join(result)

    def _generate_day_by_day_realistic(self, days, meals_per_day, healthy, allergies, preferences, calories_per_day, daily_calorie_distribution, inspiration):
        """Generate meal plan one day at a time with realistic calorie distribution"""
        
        all_days = []
        used_titles = set()
        meal_types = ['Breakfast', 'Lunch', 'Dinner', 'Snack'][:meals_per_day]
        
        for day_num in range(1, days + 1):
            print(f"Generating Day {day_num}...")
            
            for attempt in range(3):
                try:
                    # Create more specific themes for variety
                    themes = [
                        f"Mediterranean flavors", f"Asian fusion", f"Mexican cuisine",
                        f"Italian classics", f"American comfort", f"Indian spices",
                        f"Middle Eastern", f"Thai flavors", f"French bistro", f"Greek healthy"
                    ]
                    theme = random.choice(themes)
                    
                    # Build a stronger exclusion list
                    exclusion_text = ""
                    if used_titles:
                        exclusion_text = f"NEVER use these recipe titles or similar variations: {', '.join(list(used_titles)[:10])}. "
                    
                    # Format calorie targets for this day
                    calorie_targets_text = "\n".join([
                        f"{meal_types[i]}: EXACTLY {daily_calorie_distribution[i]} calories"
                        for i in range(meals_per_day)
                    ])
                    
                    system_prompt = f"""Generate EXACTLY {meals_per_day} completely unique meals for one day.

        REQUIRED MEALS AND EXACT CALORIE TARGETS:
        {calorie_targets_text}
        
        Total day target: {calories_per_day} calories
        Theme: {theme}

        {exclusion_text}

        CRITICAL: Each recipe MUST hit its EXACT calorie target by adjusting portion sizes and ingredients.
        - Use different cooking methods (grilled, baked, sautéed, steamed, roasted, etc.)
        - Use different protein sources (chicken, fish, beef, tofu, eggs, beans, etc.)
        - Use different cuisines (Italian, Mexican, Asian, Mediterranean, etc.)
        - Use different ingredients and flavor profiles

        CALORIE ACCURACY:
        - Each recipe MUST = its exact target calories
        - Protein: 20-30% of calories (divide by 4 for grams)
        - Carbs: 40-50% of calories (divide by 4 for grams)
        - Fat: 25-35% of calories (divide by 9 for grams)

        FORMAT:
        Breakfast

        Unique Recipe Title Here

        Preparation Time: 15 minutes
        Cooking Time: 20 minutes
        Servings: 1

        • Ingredient 1 (calculated for exact calorie target)
        • Ingredient 2 (precise amounts)
        • Ingredient 3 (as needed)

        Instructions:
        1. Step one with details
        2. Step two with timing
        3. Step three to finish

        Nutritional Information:
        Calories: [EXACT TARGET]
        Protein: [CALCULATED]g
        Carbs: [CALCULATED]g
        Fat: [CALCULATED]g

        =====

        (Continue for all {meals_per_day} meals)

        CRITICAL: Generate ALL {meals_per_day} meals completely. Make each recipe title creative and unique. Hit EXACT calorie targets."""

                    prompt = f"Generate {meals_per_day} UNIQUE meals for Day {day_num} with {theme} theme. Each recipe must hit its EXACT calorie target as specified above."
                    
                    if healthy:
                        prompt += " Make all meals healthy and nutritious while maintaining exact calorie targets."
                    if allergies:
                        allergies_list = ', '.join(allergies) if isinstance(allergies, list) else allergies
                        prompt += f" Avoid these allergens: {allergies_list}."
                    if preferences:
                        preferences_list = ', '.join(preferences) if isinstance(preferences, list) else preferences
                        prompt += f" Consider preferences: {preferences_list}."
                    
                    prompt += f" IMPORTANT: Do not repeat any of these recipe concepts: {', '.join(list(used_titles)[:8]) if used_titles else 'None'}"

                    response = self.client.chat.completions.create(
                        model="gpt-3.5-turbo",
                        messages=[
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": prompt}
                        ],
                        temperature=0.8,
                        max_tokens=3000,
                        timeout=90
                    )
                    
                    day_content = response.choices[0].message.content.strip()
                    
                    # Extract and check for duplicate titles before accepting
                    new_titles = self._extract_titles_simple(day_content)
                    duplicate_found = any(title in used_titles for title in new_titles)
                    
                    # Quick validation
                    if self._validate_day_simple(day_content, meal_types) and not duplicate_found:
                        all_days.append(f"Day {day_num}\n\n{day_content}")
                        
                        # Add titles to used set
                        used_titles.update(new_titles)
                        
                        print(f"✅ Day {day_num} generated successfully with realistic calorie distribution")
                        break
                    else:
                        if duplicate_found:
                            print(f"Day {day_num} attempt {attempt + 1} had duplicate recipes")
                        else:
                            print(f"Day {day_num} attempt {attempt + 1} failed validation")
                        if attempt < 2:
                            sleep(1)
                            
                except Exception as e:
                    print(f"Day {day_num} attempt {attempt + 1} error: {e}")
                    if attempt < 2:
                        sleep(1)
            else:
                # Create basic fallback day if all attempts fail
                print(f"⚠️ Creating basic day {day_num} with realistic calories")
                fallback_day = self._create_realistic_basic_day(day_num, meal_types, daily_calorie_distribution, used_titles)
                all_days.append(fallback_day)
                
                # Add fallback titles to used set
                fallback_titles = self._extract_titles_simple(fallback_day)
                used_titles.update(fallback_titles)
        
        return "\n\n".join(all_days)

    def _validate_plan_simple(self, plan_text, days, meals_per_day):
        """Simple validation for full plans"""
        if not plan_text or len(plan_text) < 1000:
            return False
        
        # Count basic elements
        day_count = plan_text.lower().count('day ')
        meal_types = ['breakfast', 'lunch', 'dinner', 'snack']
        total_meals = sum(plan_text.lower().count(meal) for meal in meal_types[:meals_per_day])
        ingredients_count = plan_text.count('•')
        instructions_count = plan_text.count('1.')
        
        expected_total = days * meals_per_day
        
        print(f"Validation: {total_meals}/{expected_total} meals, {ingredients_count} ingredients, {instructions_count} instructions")
        
        return (total_meals >= expected_total * 0.8 and
                ingredients_count >= expected_total * 0.8 and
                instructions_count >= expected_total * 0.8)

    def _validate_day_simple(self, day_content, meal_types):
        """Simple validation for single days"""
        content_lower = day_content.lower()
        
        # Check for meal types
        found_meals = sum(1 for meal in meal_types if meal.lower() in content_lower)
        
        # Check for basic recipe components
        has_ingredients = '•' in day_content
        has_instructions = '1.' in day_content
        has_calories = 'calories:' in content_lower
        
        return (found_meals >= len(meal_types) * 0.8 and
                has_ingredients and has_instructions and has_calories)

    def _extract_titles_simple(self, content):
        """Extract recipe titles to avoid duplicates"""
        lines = content.split('\n')
        titles = []
        meal_types = ['breakfast', 'lunch', 'dinner', 'snack']
        
        for i, line in enumerate(lines):
            line = line.strip()
            if any(meal.lower() in line.lower() for meal in meal_types):
                # Look for title in next few lines
                for j in range(i + 1, min(i + 4, len(lines))):
                    next_line = lines[j].strip()
                    if (next_line and len(next_line) > 3 and
                        not next_line.startswith('Preparation') and
                        not next_line.startswith('•') and ':' not in next_line):
                        titles.append(next_line.lower())
                        break
        
        return titles

    def _create_realistic_basic_day(self, day_num, meal_types, calorie_distribution, used_titles=None):
        """Create a basic fallback day with realistic calorie distribution"""
        
        # Create unique fallback recipes with specific calorie targets
        basic_recipes = {
            'Breakfast': [
                f'Power Protein Scramble #{day_num}',
                f'Morning Energy Bowl #{day_num}',
                f'Sunrise Smoothie Bowl #{day_num}',
                f'Healthy Start Plate #{day_num}'
            ],
            'Lunch': [
                f'Balanced Power Bowl #{day_num}',
                f'Midday Fuel Plate #{day_num}',
                f'Afternoon Energy Salad #{day_num}',
                f'Quick Lunch Fix #{day_num}'
            ],
            'Dinner': [
                f'Evening Comfort Meal #{day_num}',
                f'Dinner Satisfaction #{day_num}',
                f'Night Nourishment #{day_num}',
                f'Sunset Feast #{day_num}'
            ],
            'Snack': [
                f'Energy Boost Bites #{day_num}',
                f'Quick Power Snack #{day_num}',
                f'Healthy Munch #{day_num}',
                f'Fuel Break #{day_num}'
            ]
        }
        
        day_content = f"Day {day_num}\n\n"
        
        for i, meal_type in enumerate(meal_types):
            target_calories = calorie_distribution[i] if i < len(calorie_distribution) else 400
            
            # Pick a unique title for this meal type
            available_titles = basic_recipes.get(meal_type, [f'Healthy {meal_type} #{day_num}'])
            recipe_name = available_titles[0]
            
            # Calculate realistic macros for the target calories
            protein = int(target_calories * 0.25 / 4)
            carbs = int(target_calories * 0.45 / 4)
            fat = int(target_calories * 0.30 / 9)
            
            meal_content = f"""{meal_type}

        {recipe_name}

        Preparation Time: 15 minutes
        Cooking Time: 20 minutes
        Servings: 1

        • High-quality protein source (portioned for {target_calories} calories)
        • Fresh seasonal vegetables
        • Healthy whole grains
        • Nutritious fats and oils

        Instructions:
        1. Prepare all ingredients according to preferences
        2. Cook using healthy cooking methods
        3. Season with herbs and spices
        4. Serve fresh and enjoy

        Nutritional Information:
        Calories: {target_calories}
        Protein: {protein}g
        Carbs: {carbs}g
        Fat: {fat}g

        ====="""
            day_content += meal_content + "\n\n"
        
        return day_content.strip()

    def _create_basic_day(self, day_num, meal_types, calories_per_day, used_titles=None):
        """Legacy method - now redirects to realistic version"""
        calorie_distribution = self._get_realistic_calorie_distribution(calories_per_day, len(meal_types))
        return self._create_realistic_basic_day(day_num, meal_types, calorie_distribution, used_titles)
