from app import db
from datetime import datetime

class User(db.Model):
    id = db.Column(db.Integer, primary_key= True)
    email = db.Column(db.String(200), unique = True, nullable = False )
    is_premium = db.Column(db.Boolean,default=False)
    premium_expiry = db.Column(db.DateTime)

    recipes = db.relationship('Recipe', backref = "owner", lazy=True)

    def __init__(self,username,email,is_premium):
        self.username = username
        self.email = email
        self.is_premium = is_premium

class UsageLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    device_id = db.Column(db.String(120),nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)


    
class Recipe(db.Model):
    id = db.Column(db.Integer, primary_key = True)
    user_id = db.Column(db.Integer,db.ForeignKey('user.id'), nullable = False)
    title = db.Column(db.String(200),nullable = False)
    ingridients = db.Column(db.Text,nullable = False)
    instructions = db.Column(db.Text,nullable = False)
    nutrition = db.Column(db.Text,nullable = False)
    created_at = db.Column(db.DateTime, default = datetime.utcnow)

    def __init__(self,user_id,title,ingridients, instructions, nutrition):
        self.user_id = user_id
        self.title = title
        self.ingridients = ingridients
        self.instructions = instructions
        self.nutrition = nutrition


