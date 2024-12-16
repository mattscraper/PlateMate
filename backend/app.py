from flask import Flask
from flask_cors import CORS

from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True) 

from routes import *

if __name__ == "__main__":
    app.run( host= '0.0.0.0', port=5000,debug=True)
