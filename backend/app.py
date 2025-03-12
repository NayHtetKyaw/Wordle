from flask import Flask, request, jsonify
from flask_cors import CORS
import random
import string
import os
import uuid
from datetime import datetime, timedelta

# Firebase setup with error handling
try:
    import firebase_admin
    from firebase_admin import credentials, firestore

    if os.path.exists('firebase-key.json'):
        cred = credentials.Certificate('firebase-key.json')
        firebase_admin.initialize_app(cred)
        db = firestore.client()
        use_firebase = True
    else:
        print("Firebase credentials not found. Running without database.")
        use_firebase = False
except ImportError:
    print("Firebase libraries not installed. Running without database.")
    use_firebase = False

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Hardcoded word list for development (would be replaced with a more extensive list)
WORD_LIST = [
    "WORLD", "HELLO", "GAMES", "FLASK", "REACT", "LEARN",
    "HOUSE", "CRATE", "PLATE", "SCALE", "TABLE", "SMART",
    "PHONE", "MUSIC", "VIDEO", "LASER", "PAPER", "WATER",
    "EARTH", "SPACE", "MOUNT", "QUEEN", "NIGHT", "LIGHT"
]

# Store active games in memory (in production, this would be in a database)
active_games = {}


class Game:
    def __init__(self, word=None, max_attempts=6):
        self.game_id = str(uuid.uuid4())
        self.word = word or random.choice(WORD_LIST)
        self.max_attempts = max_attempts
        self.attempts = []
        self.evaluations = []
        self.game_status = 'playing'  # playing, won, lost
        self.created_at = datetime.now()

        print(f"New game created with word: {self.word}")  # For debugging

    def make_guess(self, guess):
        """Process a guess and return the result"""
        if self.game_status != 'playing':
            return {
                'error': 'Game already finished',
                'game_status': self.game_status
            }

        if len(self.attempts) >= self.max_attempts:
            self.game_status = 'lost'
            return {
                'error': 'Maximum attempts reached',
                'game_status': self.game_status,
                'word': self.word
            }

        # Validate guess format
        guess = guess.upper()
        if len(guess) != len(self.word) or not all(c in string.ascii_uppercase for c in guess):
            return {
                'error': 'Invalid word format',
                'game_status': self.game_status
            }

        # Evaluate the guess
        evaluation = self.evaluate_guess(guess)
        self.attempts.append(guess)
        self.evaluations.append(evaluation)

        # Check if the guess is correct
        if guess == self.word:
            self.game_status = 'won'
        elif len(self.attempts) >= self.max_attempts:
            self.game_status = 'lost'

        # Store game in Firestore if available
        if use_firebase:
            try:
                db.collection('games').document(
                    self.game_id).set(self.to_dict())
            except Exception as e:
                print(f"Error saving to Firestore: {e}")

        return {
            'attempt_number': len(self.attempts),
            'evaluation': evaluation,
            'game_status': self.game_status,
            'word': self.word if self.game_status == 'lost' else None
        }

    def evaluate_guess(self, guess):
        """Evaluate a guess against the target word"""
        target = self.word
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

    def to_dict(self):
        """Convert game to dictionary for Firestore storage"""
        return {
            'game_id': self.game_id,
            'word': self.word,
            'max_attempts': self.max_attempts,
            'attempts': self.attempts,
            'evaluations': self.evaluations,
            'game_status': self.game_status,
            'created_at': self.created_at
        }


@app.route("/")
def home():
    return jsonify({"message": "HOME "})


@app.route('/api/new-game', methods=['POST'])
def new_game():
    """Start a new game"""
    data = request.json or {}
    word_length = data.get('word_length', 5)
    max_attempts = data.get('max_attempts', 6)

    filtered_words = [word for word in WORD_LIST if len(word) == word_length]

    if not filtered_words:
        word = random.choice(WORD_LIST)
    else:
        word = random.choice(filtered_words)

    game = Game(word=word, max_attempts=max_attempts)
    active_games[game.game_id] = game

    cleanup_old_games()

    return jsonify({
        'game_id': game.game_id,
        'word_length': len(game.word),
        'max_attempts': game.max_attempts
    })


@app.route('/api/guess', methods=['POST'])
def make_guess():
    """Process a guess in a game"""
    data = request.json

    if not data:
        return jsonify({'error': 'No data provided'}), 400

    game_id = data.get('game_id')
    guess = data.get('word', '')

    if not game_id or not guess:
        return jsonify({'error': 'Game ID and word are required'}), 400

    game = active_games.get(game_id)

    if not game:
        if use_firebase:
            try:
                doc_ref = db.collection('games').document(game_id)
                doc = doc_ref.get()
                if doc.exists:
                    game_data = doc.to_dict()
                    game = Game(
                        word=game_data.get('word'),
                        max_attempts=game_data.get('max_attempts', 6)
                    )
                    game.game_id = game_id
                    game.attempts = game_data.get('attempts', [])
                    game.evaluations = game_data.get('evaluations', [])
                    game.game_status = game_data.get('game_status', 'playing')
                    active_games[game_id] = game
            except Exception as e:
                print(f"Error loading game from Firestore: {e}")

    if not game:
        return jsonify({'error': 'Game not found'}), 404

    result = game.make_guess(guess)
    return jsonify(result)


@app.route('/api/game/<game_id>', methods=['GET'])
def get_game(game_id):
    """Get game information"""
    game = active_games.get(game_id)

    if not game and use_firebase:
        try:
            doc_ref = db.collection('games').document(game_id)
            doc = doc_ref.get()
            if doc.exists:
                game_data = doc.to_dict()
                return jsonify({
                    'game_id': game_id,
                    'attempts': game_data.get('attempts', []),
                    'evaluations': game_data.get('evaluations', []),
                    'game_status': game_data.get('game_status', 'playing'),
                    'max_attempts': game_data.get('max_attempts', 6),
                    'word_length': len(game_data.get('word', '')),
                    'word': game_data.get('word') if game_data.get('game_status') != 'playing' else None
                })
        except Exception as e:
            print(f"Error loading game from Firestore: {e}")

    if not game:
        return jsonify({'error': 'Game not found'}), 404

    return jsonify({
        'game_id': game.game_id,
        'attempts': game.attempts,
        'evaluations': game.evaluations,
        'game_status': game.game_status,
        'max_attempts': game.max_attempts,
        'word_length': len(game.word),
        'word': game.word if game.game_status != 'playing' else None
    })


def cleanup_old_games():
    """Remove games older than 24 hours from memory"""
    now = datetime.now()
    expired_games = []

    for game_id, game in active_games.items():
        if now - game.created_at > timedelta(hours=24):
            expired_games.append(game_id)

    for game_id in expired_games:
        del active_games[game_id]


@app.route('/api/stats', methods=['GET'])
def get_stats():
    """Get game statistics"""
    if use_firebase:
        try:
            user_id = request.args.get('user_id', 'anonymous')

            user_ref = db.collection('users').document(user_id)
            stats_doc = user_ref.collection(
                'stats').document('game_stats').get()

            if stats_doc.exists:
                return jsonify({
                    'success': True,
                    'stats': stats_doc.to_dict()
                })
            else:
                return jsonify({
                    'success': True,
                    'stats': {
                        'played': 0,
                        'won': 0,
                        'current_streak': 0,
                        'max_streak': 0,
                        'guess_distribution': {
                            '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0
                        }
                    }
                })
        except Exception as e:
            print(f"Error fetching stats: {e}")

    # Return mock stats if Firebase is not configured or there was an error
    return jsonify({
        'success': True,
        'stats': {
            'played': 10,
            'won': 7,
            'current_streak': 2,
            'max_streak': 4,
            'guess_distribution': {
                '1': 1, '2': 2, '3': 2, '4': 1, '5': 1, '6': 0
            }
        }
    })


if __name__ == '__main__':
    app.run(debug=True)
