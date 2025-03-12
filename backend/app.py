from flask import Flask, request, jsonify
from flask_cors import CORS
import random
import firebase_admin
from firebase_admin import credentials, firestore
import os
from datetime import datetime

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Initialize Firebase
if os.path.exists('firebase-key.json'):
    cred = credentials.Certificate('firebase-key.json')
    firebase_admin.initialize_app(cred)
    db = firestore.client()
    use_firebase = True
else:
    print("Firebase credentials not found. Running without database.")
    use_firebase = False

WORD_LIST = [
    "WORLD", "HELLO", "GAMES", "FLASK", "REACT", "LEARN",
    "HOUSE", "CRATE", "PLATE", "SCALE", "TABLE", "SMART",
    "PHONE", "MUSIC", "VIDEO", "LASER", "PAPER", "WATER",
    "EARTH", "SPACE", "MOUNT", "QUEEN", "NIGHT", "LIGHT"
]

# Default word to use if no daily word is set
DEFAULT_WORD = "WORLD"


def get_daily_word():
    """Get the daily word from Firestore or fallback to a random word"""
    if use_firebase:
        try:
            doc_ref = db.collection('game_config').document('daily_word')
            doc = doc_ref.get()
            if doc.exists:
                return doc.to_dict().get('word', DEFAULT_WORD)
        except Exception as e:
            print(f"Error fetching from Firestore: {e}")

    # Fallback: use a random word from the list
    return random.choice(WORD_LIST)


def evaluate_guess(guess, target):
    """Evaluate a guess against the target word"""
    evaluation = ['absent'] * len(target)

    # First pass: check for correct positions
    for i in range(len(target)):
        if i < len(guess) and guess[i] == target[i]:
            evaluation[i] = 'correct'

    # Second pass: check for correct letters in wrong positions
    target_char_count = {}
    for i, char in enumerate(target):
        if evaluation[i] != 'correct':  # Skip letters that were already marked correct
            target_char_count[char] = target_char_count.get(char, 0) + 1

    for i, char in enumerate(guess):
        if evaluation[i] != 'correct' and char in target_char_count and target_char_count[char] > 0:
            evaluation[i] = 'present'
            target_char_count[char] -= 1

    return evaluation


@app.route("/")
def home():
    return jsonify({"message": "Home"})


@app.route('/api/check', methods=['POST'])
def check_word():
    """Check the submitted word against the target word"""
    data = request.json
    if not data:
        return jsonify({
            'error': 'No data provided',
            'correct': False,
            'evaluation': ['absent'] * 5
        }), 400

    guess = data.get('word', '').upper()

    # Validate the guess
    if not guess or len(guess) != 5:
        return jsonify({
            'error': 'Invalid word',
            'correct': False,
            'evaluation': ['absent'] * 5
        }), 400

    # Get the target word
    target = get_daily_word()

    # Evaluate the guess
    evaluation = evaluate_guess(guess, target)

    # Check if the guess is correct
    correct = guess == target

    # Save the guess to Firestore if using Firebase
    if use_firebase:
        try:
            # Get user ID from request, or use a default
            user_id = data.get('userId', 'anonymous')

            # Add the guess to the user's history
            db.collection('users').document(user_id).collection('guesses').add({
                'word': guess,
                'evaluation': evaluation,
                'correct': correct,
                'timestamp': firestore.SERVER_TIMESTAMP if hasattr(firestore, 'SERVER_TIMESTAMP') else datetime.now()
            })
        except Exception as e:
            print(f"Error saving to Firestore: {e}")

    return jsonify({
        'correct': correct,
        'evaluation': evaluation
    })


@app.route('/api/new-game', methods=['POST'])
def new_game():
    """Generate a new word for testing (in production, this would be on a schedule)"""
    if use_firebase:
        try:
            new_word = random.choice(WORD_LIST)
            db.collection('game_config').document('daily_word').set({
                'word': new_word,
                'timestamp': firestore.SERVER_TIMESTAMP if hasattr(firestore, 'SERVER_TIMESTAMP') else datetime.now()
            })
            return jsonify({'success': True, 'message': 'New word generated'})
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)})
    else:
        return jsonify({'success': False, 'message': 'Firebase not configured'})


@app.route('/api/stats', methods=['GET'])
def get_stats():
    """Get game statistics"""
    if use_firebase:
        try:
            # Get user ID from query parameter, or use a default
            user_id = request.args.get('userId', 'anonymous')

            # Get the user's stats
            user_ref = db.collection('users').document(user_id)
            stats_ref = user_ref.collection('stats').document('game_stats')
            stats_doc = stats_ref.get()

            if stats_doc.exists:
                return jsonify({'success': True, 'stats': stats_doc.to_dict()})
            else:
                return jsonify({'success': True, 'stats': {
                    'played': 0,
                    'won': 0,
                    'current_streak': 0,
                    'max_streak': 0,
                    'guess_distribution': {
                        '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0
                    }
                }})
        except Exception as e:
            return jsonify({'success': False, 'error': str(e)})
    else:
        # Return mock stats if Firebase is not configured
        return jsonify({'success': True, 'stats': {
            'played': 10,
            'won': 7,
            'current_streak': 2,
            'max_streak': 4,
            'guess_distribution': {
                '1': 1, '2': 2, '3': 2, '4': 1, '5': 1, '6': 0
            }
        }})


if __name__ == '__main__':
    app.run(debug=True)
