from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager
#from backend.config import Config
from dotenv import load_dotenv

jwt = JWTManager()
load_dotenv()

app = Flask(__name__)

from backend.generate_routes import init_recipe_routes
init_recipe_routes(app)
jwt.init_app(app)

CORS(app, resources={
    r"/api/*": {
        "origins": "*",
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})


from backend.extensions import db, migrate
db.init_app(app)
migrate.init_app(app, db)



from backend.auth import auth_bp
app.register_blueprint(auth_bp, url_prefix='/apiauth')

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=5000, debug=True, threaded=True)
