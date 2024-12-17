from flask import Flask
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy

from routes import init_recipe_routes
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

init_recipe_routes(app)

CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True) 

#app.config.from_pyfile('config.py')
#db = SQLAlchemy(app)


if __name__ == "__main__":
    app.run( host= '0.0.0.0', port=5000,debug=True)
