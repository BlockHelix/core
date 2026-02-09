'use client';

import { useState, useEffect, useRef } from 'react';
import { RUNTIME_URL } from '@/lib/network-config';

export interface APIAgent {
  agentId: string;
  name: string;
  operator: string | null;
  vault: string | null;
  registry: string | null;
  priceUsdcMicro: number;
  model: string;
  isActive: boolean;
  vaultStats: { tvl: number; revenue: number; jobs: number; calls: number } | null;
}

let cachedAgents: APIAgent[] | null = null;
let cacheTime = 0;
const CACHE_TTL = 30_000;

export function useAgentListAPI() {
  const [agents, setAgents] = useState<APIAgent[]>(cachedAgents || []);
  const [isLoading, setIsLoading] = useState(!cachedAgents);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    if (cachedAgents && Date.now() - cacheTime < CACHE_TTL) {
      setAgents(cachedAgents);
      setIsLoading(false);
      return;
    }

    fetchedRef.current = true;
    fetch(`${RUNTIME_URL}/v1/agents`)
      .then(res => {
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        return res.json();
      })
      .then(data => {
        cachedAgents = data.agents;
        cacheTime = Date.now();
        setAgents(data.agents);
      })
      .catch(err => setError(err.message))
      .finally(() => setIsLoading(false));
  }, []);

  return { agents, isLoading, error };
}
