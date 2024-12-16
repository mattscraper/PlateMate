from openai import OpenAI
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