from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager
#from config import Config
from dotenv import load_dotenv
import os
from datetime import timedelta

jwt = JWTManager()
load_dotenv()

app = Flask(__name__)

from generate_routes import init_recipe_routes
init_recipe_routes(app)
jwt.init_app(app)

CORS(app, resources={
    r"/api/*": {
        "origins": "*",
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})
class Config:
    # Database configuration
    SQLALCHEMY_DATABASE_URI = os.getenv("DATABASE_URL")
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # JWT Configuration
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(days=1)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=30)

app.config.from_pyfile('config.py')
app.config.from_object(Config)

from extensions import db, migrate
db.init_app(app)
migrate.init_app(app, db)



from auth import auth_bp
app.register_blueprint(auth_bp, url_prefix='/apiauth')

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=5000, debug=True, threaded=True)
