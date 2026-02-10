import { Connection, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { getKmsPublicKey, isKmsEnabled } from './kms-signer';
import { RPC_URL } from '../config';

const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const LOW_BALANCE_THRESHOLD = 0.5; // SOL
const ALERT_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

const SNS_TOPIC_ARN = process.env.ALERT_SNS_TOPIC_ARN;
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';

let snsClient: SNSClient | null = null;
let lastAlertTime = 0;
let intervalHandle: ReturnType<typeof setInterval> | null = null;

async function checkBalance(): Promise<void> {
  if (!isKmsEnabled()) return;

  const pubkey = getKmsPublicKey();
  if (!pubkey) return;

  try {
    const connection = new Connection(RPC_URL, 'confirmed');
    const lamports = await connection.getBalance(pubkey);
    const sol = lamports / LAMPORTS_PER_SOL;

    console.log(`[balance] KMS wallet ${pubkey.toBase58().slice(0, 8)}...: ${sol.toFixed(4)} SOL`);

    if (sol < LOW_BALANCE_THRESHOLD) {
      console.warn(`[balance] WARNING: KMS wallet below ${LOW_BALANCE_THRESHOLD} SOL (${sol.toFixed(4)} SOL)`);
      await sendAlert(pubkey.toBase58(), sol);
    }
  } catch (err) {
    console.error('[balance] Check failed:', err instanceof Error ? err.message : err);
  }
}

async function sendAlert(wallet: string, balance: number): Promise<void> {
  if (!SNS_TOPIC_ARN) {
    console.warn('[balance] ALERT_SNS_TOPIC_ARN not set, skipping SNS alert');
    return;
  }

  const now = Date.now();
  if (now - lastAlertTime < ALERT_COOLDOWN_MS) {
    console.log('[balance] Alert cooldown active, skipping SNS publish');
    return;
  }

  try {
    if (!snsClient) {
      snsClient = new SNSClient({ region: AWS_REGION });
    }

    await snsClient.send(new PublishCommand({
      TopicArn: SNS_TOPIC_ARN,
      Subject: `BlockHelix: KMS wallet low on SOL (${balance.toFixed(4)})`,
      Message: `KMS wallet ${wallet} has ${balance.toFixed(4)} SOL remaining.\n\nThreshold: ${LOW_BALANCE_THRESHOLD} SOL\nAction: Send SOL to this wallet to keep revenue routing and job recording working.\n\nThis alert fires at most once per hour.`,
    }));

    lastAlertTime = now;
    console.log('[balance] SNS alert published');
  } catch (err) {
    console.error('[balance] SNS publish failed:', err instanceof Error ? err.message : err);
  }
}

export const balanceMonitor = {
  async init(): Promise<void> {
    if (!isKmsEnabled()) {
      console.log('[balance] KMS not enabled, balance monitor disabled');
      return;
    }

    await checkBalance();

    intervalHandle = setInterval(checkBalance, CHECK_INTERVAL_MS);
    console.log('[balance] Monitor started (checking every 5 min)');
  },

  stop(): void {
    if (intervalHandle) {
      clearInterval(intervalHandle);
      intervalHandle = null;
    }
  },
};
