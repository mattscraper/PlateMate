from flask import Flask
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_jwt_extended import JWTManager
from config import Config


from generate_routes import init_recipe_routes
from dotenv import load_dotenv

jwt = JWTManager()
load_dotenv()

app = Flask(__name__)

init_recipe_routes(app)
jwt.init_app(app)

CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True) 

app.config.from_pyfile('config.py')
app.config.from_object(Config)
db = SQLAlchemy(app)
migrate = Migrate(app,db)


if __name__ == "__main__":
    app.run( host= '0.0.0.0', port=5000,debug=True)
