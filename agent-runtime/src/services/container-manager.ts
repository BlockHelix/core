import crypto from 'crypto';
import {
  ECSClient,
  RunTaskCommand,
  StopTaskCommand,
  DescribeTasksCommand,
} from '@aws-sdk/client-ecs';
import {
  EC2Client,
  DescribeNetworkInterfacesCommand,
} from '@aws-sdk/client-ec2';

interface OpenClawContainer {
  taskArn: string;
  privateIp: string;
  agentId: string;
  startedAt: number;
}

interface DeployParams {
  agentId: string;
  systemPrompt: string;
  anthropicApiKey: string;
  model?: string;
  telegramBotToken?: string;
}

const ECS_CLUSTER = process.env.ECS_CLUSTER_NAME || '';
const TASK_DEFINITION = process.env.OPENCLAW_TASK_DEFINITION || '';
const SECURITY_GROUP = process.env.OPENCLAW_SECURITY_GROUP || '';
const SUBNETS = (process.env.OPENCLAW_SUBNETS || '').split(',').filter(Boolean);

class ContainerManager {
  private containers = new Map<string, OpenClawContainer>();
  private ecs = new ECSClient({});
  private ec2 = new EC2Client({});

  async deployAgent(params: DeployParams): Promise<OpenClawContainer> {
    if (this.containers.has(params.agentId)) {
      throw new Error(`Agent ${params.agentId} already has a running container`);
    }

    const result = await this.ecs.send(new RunTaskCommand({
      cluster: ECS_CLUSTER,
      taskDefinition: TASK_DEFINITION,
      launchType: 'FARGATE',
      count: 1,
      networkConfiguration: {
        awsvpcConfiguration: {
          subnets: SUBNETS,
          securityGroups: [SECURITY_GROUP],
          assignPublicIp: 'DISABLED',
        },
      },
      overrides: {
        containerOverrides: [{
          name: 'openclaw',
          environment: [
            { name: 'AGENT_ID', value: params.agentId },
            { name: 'SYSTEM_PROMPT', value: params.systemPrompt },
            { name: 'ANTHROPIC_API_KEY', value: params.anthropicApiKey },
            { name: 'MODEL', value: params.model || 'claude-sonnet-4-20250514' },
            { name: 'GATEWAY_AUTH_TOKEN', value: crypto.randomBytes(32).toString('hex') },
            ...(params.telegramBotToken ? [{ name: 'TELEGRAM_BOT_TOKEN', value: params.telegramBotToken }] : []),
          ],
        }],
      },
    }));

    const taskArn = result.tasks?.[0]?.taskArn;
    if (!taskArn) {
      throw new Error('Failed to start ECS task');
    }

    console.log(`[container] Started task ${taskArn} for agent ${params.agentId}`);

    const privateIp = await this.waitForPrivateIp(taskArn);
    await this.waitForHealth(privateIp);

    const container: OpenClawContainer = {
      taskArn,
      privateIp,
      agentId: params.agentId,
      startedAt: Date.now(),
    };

    this.containers.set(params.agentId, container);
    console.log(`[container] Agent ${params.agentId} running at ${privateIp}:3001`);
    return container;
  }

  private async waitForPrivateIp(taskArn: string, maxWait = 120_000): Promise<string> {
    const start = Date.now();

    while (Date.now() - start < maxWait) {
      const desc = await this.ecs.send(new DescribeTasksCommand({
        cluster: ECS_CLUSTER,
        tasks: [taskArn],
      }));

      const task = desc.tasks?.[0];
      if (!task) throw new Error('Task not found');

      if (task.lastStatus === 'STOPPED') {
        throw new Error(`Task stopped unexpectedly: ${task.stoppedReason || 'unknown'}`);
      }

      const eni = task.attachments?.find(a => a.type === 'ElasticNetworkInterface');
      const eniId = eni?.details?.find(d => d.name === 'networkInterfaceId')?.value;

      if (eniId) {
        const niDesc = await this.ec2.send(new DescribeNetworkInterfacesCommand({
          NetworkInterfaceIds: [eniId],
        }));
        const ip = niDesc.NetworkInterfaces?.[0]?.PrivateIpAddress;
        if (ip) return ip;
      }

      await new Promise(r => setTimeout(r, 2000));
    }

    throw new Error(`Timed out waiting for private IP (task: ${taskArn})`);
  }

  private async waitForHealth(privateIp: string, maxWait = 300_000): Promise<void> {
    const start = Date.now();
    const url = `http://${privateIp}:3001/health`;
    while (Date.now() - start < maxWait) {
      try {
        const resp = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(5000) });
        if (resp.ok) return;
      } catch {
        // ignore until ready
      }
      await new Promise(r => setTimeout(r, 2000));
    }
    throw new Error(`Timed out waiting for OpenClaw health at ${url}`);
  }

  async proxyRequest(agentId: string, body: { input: string; context?: Record<string, unknown> }, fallbackIp?: string): Promise<{ output: string }> {
    const container = this.containers.get(agentId);
    const ip = container?.privateIp || fallbackIp;
    if (!ip) {
      throw new Error(`No running container for agent ${agentId}`);
    }

    const resp = await fetch(`http://${ip}:3001/v1/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const err = await resp.text().catch(() => 'unknown error');
      throw new Error(`Container returned ${resp.status}: ${err}`);
    }

    return resp.json() as Promise<{ output: string }>;
  }

  async stopAgent(agentId: string): Promise<void> {
    const container = this.containers.get(agentId);
    if (!container) {
      throw new Error(`No running container for agent ${agentId}`);
    }

    await this.ecs.send(new StopTaskCommand({
      cluster: ECS_CLUSTER,
      task: container.taskArn,
      reason: 'Agent stopped via admin API',
    }));

    this.containers.delete(agentId);
    console.log(`[container] Stopped agent ${agentId}`);
  }

  getContainer(agentId: string): OpenClawContainer | undefined {
    return this.containers.get(agentId);
  }

  listContainers(): OpenClawContainer[] {
    return Array.from(this.containers.values());
  }
}

export const containerManager = new ContainerManager();
