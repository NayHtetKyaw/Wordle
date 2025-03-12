"use client";

import React, { useState, useEffect } from 'react';
import { Paper, Text, Group, Stack, Progress, Loader } from '@mantine/core';

interface GameStatsProps {
  userId?: string;
}

interface StatsData {
  played: number;
  won: number;
  current_streak: number;
  max_streak: number;
  guess_distribution: {
    [key: string]: number;
  };
}

export default function GameStats({ userId = 'anonymous' }: GameStatsProps) {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStats();
  }, [userId]);

  const loadStats = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`http://localhost:5000/api/stats?userId=${userId}`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to load statistics');
      }

      const data = await response.json();
      
      if (data.success) {
        setStats(data.stats);
      } else {
        throw new Error(data.error || 'Unknown error occurred');
      }
    } catch (error) {
      console.error('Error loading stats:', error);
      setError('Failed to load statistics. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Stack className="items-center justify-center h-64">
        <Loader size="md" />
        <Text>Loading statistics...</Text>
      </Stack>
    );
  }

  if (error) {
    return (
      <Paper className="p-4 bg-red-50">
        <Text className="text-red-500">{error}</Text>
      </Paper>
    );
  }

  if (!stats) {
    return (
      <Paper className="p-4">
        <Text>No statistics available.</Text>
      </Paper>
    );
  }

  // Calculate win percentage
  const winPercentage = stats.played > 0 
    ? Math.round((stats.won / stats.played) * 100) 
    : 0;

  // Get max value in guess distribution for scaling
  const maxDistributionValue = Math.max(
    ...Object.values(stats.guess_distribution),
    1 // Ensure we don't divide by zero
  );

  return (
    <Paper className="p-6 bg-white shadow-md rounded-lg">
      <Text className="text-2xl font-bold mb-4">Statistics</Text>
      
      <Group className="justify-around mb-6">
        <Stack className="items-center">
          <Text className="text-3xl font-bold">{stats.played}</Text>
          <Text className="text-sm">Played</Text>
        </Stack>
        
        <Stack className="items-center">
          <Text className="text-3xl font-bold">{winPercentage}%</Text>
          <Text className="text-sm">Win %</Text>
        </Stack>
        
        <Stack className="items-center">
          <Text className="text-3xl font-bold">{stats.current_streak}</Text>
          <Text className="text-sm">Current Streak</Text>
        </Stack>
        
        <Stack className="items-center">
          <Text className="text-3xl font-bold">{stats.max_streak}</Text>
          <Text className="text-sm">Max Streak</Text>
        </Stack>
      </Group>
      
      <Text className="text-lg font-bold mb-2">Guess Distribution</Text>
      
      {Object.keys(stats.guess_distribution)
        .sort((a, b) =>
