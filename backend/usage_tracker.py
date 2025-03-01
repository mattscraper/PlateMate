from datetime import datetime, timedelta
from functools import wraps
from flask import jsonify, request, g
import jwt
#from models import User, UsageLog
from app import db


# we might not need this file if we atre handling the authentication with apple!!!
def track_usage(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Get device ID from request headers
        device_id = request.headers.get('X-Device-ID')
        
        if not device_id:
            return jsonify({'error': 'Device ID required'}), 400

        # Check if user is premium
        user = None
        auth_token = request.headers.get('Authorization')
        if auth_token:
            try:
                # Verify JWT token and get user
                token = auth_token.split(' ')[1]
                payload = jwt.decode(token, 'your-secret-key', algorithms=['HS256'])
                user = User.query.get(payload['user_id'])
                if user and user.is_premium:
                    # Premium users have unlimited access
                    return f(*args, **kwargs)
            except:
                pass

        # Check usage for free tier
        current_week_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0) - \
                           timedelta(days=datetime.now().weekday())
        
        usage_count = UsageLog.query.filter(
            UsageLog.device_id == device_id,
            UsageLog.timestamp >= current_week_start
        ).count()

        if usage_count >= 5:
            return jsonify({
                'error': 'Weekly free tier limit reached',
                'upgrade_url': '/subscribe',
                'remaining_generations': 0,
                'reset_date': (current_week_start + timedelta(days=7)).isoformat()
            }), 403

        # Log the usage
        log = UsageLog(device_id=device_id)
        db.session.add(log)
        db.session.commit()

        # Add remaining generations to response
        g.remaining_generations = 5 - (usage_count + 1)
        g.reset_date = (current_week_start + timedelta(days=7)).isoformat()
        
        return f(*args, **kwargs)
    return decorated_function