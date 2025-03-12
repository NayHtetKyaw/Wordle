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
    const response = await fetch(`${API_BASE_URL}/stats?user_id=${userId}`, {
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
    console.error("Error getting stats:", error);
    throw error;
  }
};
