import { db } from "../utils/firebase";
import { collection, doc, getDoc, setDoc } from "firebase/firestore";

const API_BASE_URL = "http://localhost:5000/api";

export interface GameResponse {
  game_id: string;
  word_length: number;
  max_attempts: number;
  attempts?: string[];
  evaluations?: string[][];
  game_status?: "playing" | "won" | "lost";
  word?: string | null;
  error?: string;
}

export interface GuessResponse {
  attempt_number: number;
  evaluation: string[];
  game_status: "playing" | "won" | "lost";
  word?: string | null;
  error?: string;
}

export interface StatsResponse {
  success: boolean;
  stats: {
    played: number;
    won: number;
    current_streak: number;
    max_streak: number;
    guess_distribution: {
      [key: string]: number;
    };
    last_updated?: string;
  };
  error?: string;
}

export const startNewGame = async (
  wordLength = 5,
  maxAttempts = 6,
): Promise<GameResponse> => {
  try {
    const response = await fetch(`${API_BASE_URL}/new-game`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        word_length: wordLength,
        max_attempts: maxAttempts,
      }),
    });

    if (!response.ok) {
      throw new Error("Network response was not ok");
    }

    return await response.json();
  } catch (error) {
    console.error("Error starting new game:", error);
    throw error;
  }
};

export const getGameState = async (gameId: string): Promise<GameResponse> => {
  try {
    const response = await fetch(`${API_BASE_URL}/game/${gameId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error("Network response was not ok");
    }

    return await response.json();
  } catch (error) {
    console.error("Error getting game state:", error);
    throw error;
  }
};

export const submitGuess = async (
  gameId: string,
  word: string,
): Promise<GuessResponse> => {
  try {
    const response = await fetch(`${API_BASE_URL}/guess`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ game_id: gameId, word }),
    });

    if (!response.ok) {
      throw new Error("Network response was not ok");
    }

    return await response.json();
  } catch (error) {
    console.error("Error submitting guess:", error);
    throw error;
  }
};

export const getStats = async (
  userId = "anonymous",
): Promise<StatsResponse> => {
  try {
    try {
      const userDoc = doc(db, "users", userId);
      const statsDoc = doc(collection(userDoc, "stats"), "game_stats");
      const statsSnapshot = await getDoc(statsDoc);

      if (statsSnapshot.exists()) {
        const firestoreStats = statsSnapshot.data();
        return {
          success: true,
          stats: firestoreStats as StatsResponse["stats"],
        };
      }
    } catch (firestoreError) {
      console.log(
        "Could not fetch from Firestore, falling back to API",
        firestoreError,
      );
    }

    const response = await fetch(`${API_BASE_URL}/stats?user_id=${userId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error("Network response was not ok");
    }

    const data = await response.json();

    try {
      const userDoc = doc(db, "users", userId);
      const statsDoc = doc(collection(userDoc, "stats"), "game_stats");
      await setDoc(statsDoc, data.stats, { merge: true });
    } catch (saveError) {
      console.warn("Could not save stats to Firestore", saveError);
    }

    return data;
  } catch (error) {
    console.error("Error getting stats:", error);

    return {
      success: true,
      stats: {
        played: 0,
        won: 0,
        current_streak: 0,
        max_streak: 0,
        guess_distribution: {
          "1": 0,
          "2": 0,
          "3": 0,
          "4": 0,
          "5": 0,
          "6": 0,
        },
      },
    };
  }
};
