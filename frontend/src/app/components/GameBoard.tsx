"use client";

import React, { useState, useEffect } from "react";
import { Button, Text, Stack, Paper, Flex } from "@mantine/core";
import { IconBackspace, IconSend } from "@tabler/icons-react";

interface GameBoardProps {
  maxAttempts: number;
  wordLength: number;
}

export default function GameBoard({
  maxAttempts = 6,
  wordLength = 5,
}: GameBoardProps) {
  const [attempts, setAttempts] = useState<string[][]>(
    Array(maxAttempts)
      .fill([])
      .map(() => Array(wordLength).fill("")),
  );
  const [currentAttempt, setCurrentAttempt] = useState(0);
  const [currentPosition, setCurrentPosition] = useState(0);
  const [gameStatus, setGameStatus] = useState<"playing" | "won" | "lost">(
    "playing",
  );
  const [evaluation, setEvaluation] = useState<string[][]>(
    Array(maxAttempts)
      .fill([])
      .map(() => Array(wordLength).fill("")),
  );
  const [keyboardStatus, setKeyboardStatus] = useState<{
    [key: string]: string;
  }>({});

  // Mock function - will be replaced with actual API call
  const checkWord = async (word: string) => {
    try {
      const response = await fetch("http://localhost:5000/api/check", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ word }),
      });

      if (!response.ok) {
        throw new Error("Network response was not ok");
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error checking word:", error);
      // Fallback mock response for development
      return {
        correct: false,
        evaluation: Array(wordLength)
          .fill("absent")
          .map((_, i) =>
            i === 0 ? "correct" : i === 1 ? "present" : "absent",
          ),
      };
    }
  };

  const handleKeyPress = (key: string) => {
    if (gameStatus !== "playing") return;

    if (key === "Enter") {
      handleSubmit();
    } else if (key === "Backspace") {
      handleBackspace();
    } else if (/^[a-zA-Z]$/.test(key) && currentPosition < wordLength) {
      const newAttempts = [...attempts];
      newAttempts[currentAttempt][currentPosition] = key.toUpperCase();
      setAttempts(newAttempts);
      setCurrentPosition(currentPosition + 1);
    }
  };

  const handleBackspace = () => {
    if (currentPosition > 0) {
      const newAttempts = [...attempts];
      newAttempts[currentAttempt][currentPosition - 1] = "";
      setAttempts(newAttempts);
      setCurrentPosition(currentPosition - 1);
    }
  };

  const handleSubmit = async () => {
    if (currentPosition !== wordLength) return;

    const word = attempts[currentAttempt].join("");
    const result = await checkWord(word);

    // Update evaluation for the current attempt
    const newEvaluation = [...evaluation];
    newEvaluation[currentAttempt] = result.evaluation;
    setEvaluation(newEvaluation);

    // Update keyboard status
    const newKeyboardStatus = { ...keyboardStatus };
    attempts[currentAttempt].forEach((letter, index) => {
      const status = result.evaluation[index];
      // Only upgrade key status (absent -> present -> correct)
      if (
        !newKeyboardStatus[letter] ||
        (newKeyboardStatus[letter] === "absent" && status !== "absent") ||
        (newKeyboardStatus[letter] === "present" && status === "correct")
      ) {
        newKeyboardStatus[letter] = status;
      }
    });
    setKeyboardStatus(newKeyboardStatus);

    if (result.correct) {
      setGameStatus("won");
    } else if (currentAttempt === maxAttempts - 1) {
      setGameStatus("lost");
    } else {
      setCurrentAttempt(currentAttempt + 1);
      setCurrentPosition(0);
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
  }, [currentAttempt, currentPosition, attempts, gameStatus]);

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
      <Paper className="p-4 rounded">
        {attempts.map((row, rowIndex) => (
          <Flex key={rowIndex} className="mb-2 justify-center">
            {row.map((letter, colIndex) => (
              <div
                key={colIndex}
                className={`w-14 h-14 m-1 flex items-center justify-center text-2xl font-bold ${
                  rowIndex < currentAttempt || gameStatus !== "playing"
                    ? getStatusColor(evaluation[rowIndex][colIndex])
                    : "bg-white border-2 border-gray-300"
                }`}
              >
                {letter}
              </div>
            ))}
          </Flex>
        ))}
      </Paper>

      {gameStatus === "won" && (
        <Text className="text-green-500 text-2xl font-bold">You won!</Text>
      )}

      {gameStatus === "lost" && (
        <Text className="text-red-500 text-2xl font-bold">Game over!</Text>
      )}

      <VirtualKeyboard
        onKeyPress={handleKeyPress}
        keyboardStatus={keyboardStatus}
        disabled={gameStatus !== "playing"}
      />
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
        <Flex key={rowIndex} className="m-2 justify-center">
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
