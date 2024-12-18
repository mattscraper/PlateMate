from flask import Blueprint,request,jsonify
from flask_jwt_extended import create_access_token
from models import User
from app import db

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json()
    device_id = request.headers.get('X-Device-ID')
    
    if not device_id:
        return jsonify({'error': 'Device ID required'}), 400
        
    try:
        # Find or create user based on device ID
        user = User.query.filter_by(device_id=device_id).first()
        
        if not user:
            # Create new user for device
            user = User(
                device_id=device_id,
                is_premium=False
            )
            db.session.add(user)
            db.session.commit()
        
        # Create access token
        access_token = create_access_token(identity=user.id)
        
        return jsonify({
            'access_token': access_token,
            'user': {
                'id': user.id,
                'is_premium': user.is_premium,
                'premium_expiry': user.premium_expiry.isoformat() if user.premium_expiry else None
            }
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 400
