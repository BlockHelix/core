'use client';

import { useState, useEffect, useRef } from 'react';
import { RUNTIME_URL } from '@/lib/network-config';

export interface APIAgentStats {
  tvl: number;
  totalRevenue: number;
  totalJobs: number;
  apiCalls: number;
  paused: boolean;
  slashEvents: number;
  totalSlashed: number;
  operatorBond: number;
  jobsRecorded: number;
}

export interface APIAgent {
  id: string;
  agentId: string;
  name: string;
  operator: string | null;
  vault: string | null;
  registry: string | null;
  priceUsdcMicro: number;
  model: string;
  isActive: boolean;
  stats: APIAgentStats | null;
}

export interface APIJobReceipt {
  jobId: number;
  client: string;
  paymentAmount: number;
  createdAt: number;
  status: string;
  txSignature: string;
}

export interface APIAgentDetail extends APIAgent {
  id: string;
  deployStatus?: string | null;
  deployPhase?: string | null;
  revenueHistory: { date: string; revenue: number }[];
  recentJobs: APIJobReceipt[];
}

let cachedAgents: APIAgent[] | null = null;
let cacheTime = 0;
const CACHE_TTL = 30_000;

export function useAgentListAPI(initialData?: APIAgent[] | null) {
  const hasInitial = !!(initialData && initialData.length > 0);
  const [agents, setAgents] = useState<APIAgent[]>(initialData ?? cachedAgents ?? []);
  const [isLoading, setIsLoading] = useState(!hasInitial && !cachedAgents);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef(hasInitial);

  useEffect(() => {
    if (initialData && initialData.length > 0 && !cachedAgents) {
      cachedAgents = initialData;
      cacheTime = Date.now();
    }
  }, [initialData]);

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

export function useAgentDetailAPI(agentId: string, initialData?: APIAgentDetail | null) {
  const [agent, setAgent] = useState<APIAgentDetail | null>(initialData ?? null);
  const [isLoading, setIsLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef<string | null>(initialData ? agentId : null);

  useEffect(() => {
    if (!agentId || fetchedRef.current === agentId) return;
    fetchedRef.current = agentId;

    fetch(`${RUNTIME_URL}/v1/agent/${agentId}`)
      .then(res => {
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        return res.json();
      })
      .then(data => setAgent(data))
      .catch(err => setError(err.message))
      .finally(() => setIsLoading(false));
  }, [agentId]);

  return { agent, isLoading, error };
}
