from flask_sqlalchemy import SQLAlchemy
db = SQLAlchemy()


# if we switch to mongodb we can delete this file!
from flask_migrate import Migrate
migrate = Migrate()