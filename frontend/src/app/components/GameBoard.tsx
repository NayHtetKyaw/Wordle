"use client";

import React, { useState, useEffect } from "react";
import { Button, Text, Stack, Paper, Flex, Loader, Modal } from "@mantine/core";
import {
  IconBackspace,
  IconSend,
  // IconRefresh,
  // IconChartBar,
} from "@tabler/icons-react";
import { getStats } from "../services/api";

interface GameBoardProps {
  maxAttempts?: number;
  wordLength?: number;
}

interface GameStats {
  played: number;
  won: number;
  current_streak: number;
  max_streak: number;
  guess_distribution: {
    [key: string]: number;
  };
}

export default function GameBoard({
  maxAttempts = 6,
  wordLength = 5,
}: GameBoardProps) {
  const [gameId, setGameId] = useState<string | null>(null);
  const [attempts, setAttempts] = useState<string[][]>([]);
  const [evaluations, setEvaluations] = useState<string[][]>([]);
  const [currentAttempt, setCurrentAttempt] = useState<string[]>(
    Array(wordLength).fill(""),
  );
  const [gameStatus, setGameStatus] = useState<"playing" | "won" | "lost">(
    "playing",
  );
  const [keyboardStatus, setKeyboardStatus] = useState<{
    [key: string]: string;
  }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [solution, setSolution] = useState<string | null>(null);

  // New state for stats
  const [statsOpen, setStatsOpen] = useState(false);
  const [stats, setStats] = useState<GameStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  const startNewGame = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("http://localhost:5000/api/new-game", {
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
        throw new Error("Failed to start new game");
      }

      const data = await response.json();
      setGameId(data.game_id);
      setAttempts([]);
      setEvaluations([]);
      setCurrentAttempt(Array(wordLength).fill(""));
      setGameStatus("playing");
      setKeyboardStatus({});
      setSolution(null);
    } catch (error) {
      setError("Failed to start new game. Please try again.");
      console.error("Error starting new game:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Load game state
  const loadGameState = async (id: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`http://localhost:5000/api/game/${id}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to load game");
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      const formattedAttempts = data.attempts.map((word: string) =>
        word.split(""),
      );

      setAttempts(formattedAttempts);
      setEvaluations(data.evaluations);
      setGameStatus(data.game_status);
      setSolution(data.word);

      const newKeyboardStatus = { ...keyboardStatus };
      data.attempts.forEach((word: string, attemptIndex: number) => {
        const evaluation = data.evaluations[attemptIndex];
        word.split("").forEach((letter: string, letterIndex: number) => {
          const status = evaluation[letterIndex];
          if (
            !newKeyboardStatus[letter] ||
            (newKeyboardStatus[letter] === "absent" && status !== "absent") ||
            (newKeyboardStatus[letter] === "present" && status === "correct")
          ) {
            newKeyboardStatus[letter] = status;
          }
        });
      });
      setKeyboardStatus(newKeyboardStatus);
    } catch (error) {
      setError("Failed to load game. Please try again.");
      console.error("Error loading game:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const submitGuess = async (word: string) => {
    if (!gameId || word.length !== wordLength || gameStatus !== "playing") {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("http://localhost:5000/api/guess", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          game_id: gameId,
          word: word,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to submit guess");
      }

      const data = await response.json();

      if (data.error) {
        setError(data.error);
        return;
      }

      await loadGameState(gameId);

      setCurrentAttempt(Array(wordLength).fill(""));

      if (data.game_status === "won" || data.game_status === "lost") {
        fetchStats();
      }
    } catch (error) {
      setError("Failed to submit guess. Please try again.");
      console.error("Error submitting guess:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStats = async () => {
    setStatsLoading(true);
    try {
      const response = await getStats();
      if (response.success) {
        setStats(response.stats);
      } else {
        console.error("Error fetching stats:", response.error);
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    startNewGame();
    // Fetch stats on initial load
    fetchStats();
  }, []);

  useEffect(() => {
    if (gameId) {
      loadGameState(gameId);
    }
  }, [gameId]);

  const handleKeyPress = (key: string) => {
    if (gameStatus !== "playing" || isLoading) return;

    if (key === "Enter") {
      const word = currentAttempt.join("");
      if (word.length === wordLength) {
        submitGuess(word);
      }
    } else if (key === "Backspace") {
      const index = currentAttempt.findIndex((letter) => letter === "");
      const deleteIndex = index === -1 ? wordLength - 1 : index - 1;
      if (deleteIndex >= 0) {
        const newAttempt = [...currentAttempt];
        newAttempt[deleteIndex] = "";
        setCurrentAttempt(newAttempt);
      }
    } else if (/^[a-zA-Z]$/.test(key)) {
      const index = currentAttempt.findIndex((letter) => letter === "");
      if (index !== -1) {
        const newAttempt = [...currentAttempt];
        newAttempt[index] = key.toUpperCase();
        setCurrentAttempt(newAttempt);
      }
    }
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      handleKeyPress(event.key);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [currentAttempt, gameStatus, isLoading]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "correct":
        return "bg-green-500 text-white";
      case "present":
        return "bg-yellow-500 text-white";
      case "absent":
        return "bg-gray-500 text-white";
      default:
        return "bg-white border-2 border-gray-300";
    }
  };

  return (
    <Stack className="items-center space-y-4 py-4">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white opacity-50 z-10">
          <Loader color="blue" type="dots" />
        </div>
      )}

      {error && <Text className="text-red-500 font-bold">{error}</Text>}

      {/* Game controls - New Game button and Stats button */}
      <Flex className="justify-center gap-4 w-full">
        <Button
          onClick={startNewGame}
          className="bg-blue-500 hover:bg-blue-600 text-white"
          // leftIcon={<IconRefresh size={20} />}
          disabled={isLoading}
        >
          New Game
        </Button>
        <Button
          onClick={() => {
            fetchStats();
            setStatsOpen(true);
          }}
          className="bg-purple-500 hover:bg-purple-600 text-white"
          // leftIcon={<IconChartBar size={20} />}
          disabled={isLoading}
        >
          Stats
        </Button>
      </Flex>

      <Paper className="p-4 rounded">
        {/* Previous attempts */}
        {attempts.map((attempt, attemptIndex) => (
          <Flex key={`attempt-${attemptIndex}`} className="mb-2 justify-center">
            {attempt.map((letter, letterIndex) => (
              <div
                key={`attempt-${attemptIndex}-letter-${letterIndex}`}
                className={`w-14 h-14 m-1 flex items-center justify-center text-2xl font-bold ${getStatusColor(
                  evaluations[attemptIndex]?.[letterIndex] || "",
                )}`}
              >
                {letter}
              </div>
            ))}
          </Flex>
        ))}

        {/* Current attempt (only show if game is still active) */}
        {gameStatus === "playing" && (
          <Flex className="mb-2 justify-center">
            {currentAttempt.map((letter, index) => (
              <div
                key={`current-${index}`}
                className="w-14 h-14 m-1 flex items-center justify-center text-2xl font-bold bg-white border-2 border-gray-300"
              >
                {letter}
              </div>
            ))}
          </Flex>
        )}

        {/* Empty rows for remaining attempts */}
        {gameStatus === "playing" &&
          Array.from({ length: maxAttempts - attempts.length - 1 }).map(
            (_, rowIndex) => (
              <Flex key={`empty-${rowIndex}`} className="mb-2 justify-center">
                {Array.from({ length: wordLength }).map((_, colIndex) => (
                  <div
                    key={`empty-${rowIndex}-${colIndex}`}
                    className="w-14 h-14 m-1 flex items-center justify-center text-2xl font-bold bg-white border-2 border-gray-300 border-dashed"
                  ></div>
                ))}
              </Flex>
            ),
          )}
      </Paper>

      {/* Game status message */}
      {gameStatus === "won" && (
        <Text className="text-green-500 text-2xl font-bold">You won!</Text>
      )}

      {gameStatus === "lost" && (
        <Text className="text-red-500 text-2xl font-bold">
          Game over! The word was: {solution}
        </Text>
      )}

      {/* Virtual keyboard (only show if game is active) */}
      {gameStatus === "playing" ? (
        <VirtualKeyboard
          onKeyPress={handleKeyPress}
          keyboardStatus={keyboardStatus}
          disabled={isLoading}
        />
      ) : (
        <Button
          onClick={startNewGame}
          className="mt-4 bg-blue-500 hover:bg-blue-600 text-white"
          // leftIcon={<IconRefresh size={20} />}
          disabled={isLoading}
        >
          Play Again
        </Button>
      )}

      <Modal
        opened={statsOpen}
        onClose={() => setStatsOpen(false)}
        title="Game Statistics"
        size="lg"
      >
        {statsLoading ? (
          <div className="flex justify-center p-4">
            <Loader color="blue" type="dots" />
          </div>
        ) : stats ? (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="p-3 bg-gray-100 rounded">
                <div className="text-2xl font-bold">{stats.played}</div>
                <div className="text-sm">Played</div>
              </div>
              <div className="p-3 bg-gray-100 rounded">
                <div className="text-2xl font-bold">
                  {stats.played > 0
                    ? Math.round((stats.won / stats.played) * 100)
                    : 0}
                  %
                </div>
                <div className="text-sm">Win %</div>
              </div>
              <div className="p-3 bg-gray-100 rounded">
                <div className="text-2xl font-bold">{stats.current_streak}</div>
                <div className="text-sm">Current Streak</div>
              </div>
              <div className="p-3 bg-gray-100 rounded">
                <div className="text-2xl font-bold">{stats.max_streak}</div>
                <div className="text-sm">Max Streak</div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-bold mb-2">Guess Distribution</h3>
              <div className="space-y-2">
                {Object.entries(stats.guess_distribution)
                  .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
                  .map(([guess, count]) => {
                    const maxCount = Math.max(
                      ...Object.values(stats.guess_distribution),
                    );
                    const percentage =
                      maxCount > 0 ? (count / maxCount) * 100 : 0;

                    return (
                      <div key={guess} className="flex items-center">
                        <div className="w-4 mr-2">{guess}</div>
                        <div
                          className="bg-blue-500 text-white px-2 py-1 rounded text-right"
                          style={{ width: `${Math.max(percentage, 5)}%` }}
                        >
                          {count}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        ) : (
          <Text>No statistics available yet. Play some games first!</Text>
        )}
      </Modal>
    </Stack>
  );
}

interface VirtualKeyboardProps {
  onKeyPress: (key: string) => void;
  keyboardStatus: { [key: string]: string };
  disabled: boolean;
}

function VirtualKeyboard({
  onKeyPress,
  keyboardStatus,
  disabled,
}: VirtualKeyboardProps) {
  const rows = [
    ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
    ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
    ["Enter", "Z", "X", "C", "V", "B", "N", "M", "Backspace"],
  ];

  const getKeyColor = (key: string) => {
    if (key === "Enter" || key === "Backspace") return "bg-gray-200";

    const status = keyboardStatus[key];
    switch (status) {
      case "correct":
        return "bg-green-500 text-white";
      case "present":
        return "bg-yellow-500 text-white";
      case "absent":
        return "bg-gray-500 text-white";
      default:
        return "bg-gray-200";
    }
  };

  return (
    <div className="max-w-lg mx-auto">
      {rows.map((row, rowIndex) => (
        <Flex key={rowIndex} className="mb-2 justify-center">
          {row.map((key) => (
            <Button
              p="xs"
              key={key}
              className={`m-1 ${key === "Enter" || key === "Backspace" ? "px-3" : "px-2"} ${getKeyColor(key)}`}
              onClick={() =>
                onKeyPress(
                  key === "Backspace"
                    ? "Backspace"
                    : key === "Enter"
                      ? "Enter"
                      : key,
                )
              }
              disabled={disabled}
            >
              {key === "Backspace" ? (
                <IconBackspace size={20} />
              ) : key === "Enter" ? (
                <IconSend size={20} />
              ) : (
                key
              )}
            </Button>
          ))}
        </Flex>
      ))}
    </div>
  );
}
