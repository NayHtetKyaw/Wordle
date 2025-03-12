import React from "react";
import GameBoard from "./components/GameBoard";
import { Container, Title } from "@mantine/core";

export default function Home() {
  return (
    <Container my="md">
      <Title order={1} className="text-center">
        Wordle Game
      </Title>
      <GameBoard maxAttempts={6} wordLength={5} />
    </Container>
  );
}
