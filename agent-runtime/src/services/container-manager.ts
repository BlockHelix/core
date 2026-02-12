import crypto from 'crypto';
import {
  ECSClient,
  RunTaskCommand,
  StopTaskCommand,
  DescribeTasksCommand,
  RegisterTaskDefinitionCommand,
  DescribeTaskDefinitionCommand,
} from '@aws-sdk/client-ecs';
import {
  EC2Client,
  DescribeNetworkInterfacesCommand,
} from '@aws-sdk/client-ec2';
import {
  EFSClient,
  CreateAccessPointCommand,
  DeleteAccessPointCommand,
  DescribeAccessPointsCommand,
} from '@aws-sdk/client-efs';

interface OpenClawContainer {
  taskArn: string;
  privateIp: string;
  agentId: string;
  startedAt: number;
  accessPointId?: string;
}

interface HeartbeatConfig {
  enabled: boolean;
  interval?: string;
  model?: string;
  activeStart?: string;
  activeEnd?: string;
  timezone?: string;
}

type DeployPhase = 'efs' | 'task_def' | 'launching' | 'networking' | 'health' | 'complete';

interface DeployParams {
  agentId: string;
  agentName?: string;
  systemPrompt: string;
  anthropicApiKey: string;
  model?: string;
  telegramBotToken?: string;
  operatorTelegram?: string;
  heartbeat?: HeartbeatConfig;
  sdkKey?: string;
  runtimeUrl?: string;
  braveApiKey?: string;
  colosseumApiKey?: string;
  kimiApiKey?: string;
  veoApiKey?: string;
  runwayApiKey?: string;
  onProgress?: (phase: DeployPhase) => void;
}

const ECS_CLUSTER = process.env.ECS_CLUSTER_NAME || '';
const TASK_DEFINITION = process.env.OPENCLAW_TASK_DEFINITION || '';
const SECURITY_GROUP = process.env.OPENCLAW_SECURITY_GROUP || '';
const SUBNETS = (process.env.OPENCLAW_SUBNETS || '').split(',').filter(Boolean);
const MAX_CONTAINERS = parseInt(process.env.MAX_OPENCLAW_CONTAINERS || '10', 10);
const AGENT_EFS_ID = process.env.AGENT_EFS_ID || '';

class ContainerManager {
  private containers = new Map<string, OpenClawContainer>();
  private ecs = new ECSClient({});
  private ec2 = new EC2Client({});
  private efs = new EFSClient({});

  private async getOrCreateAccessPoint(agentId: string): Promise<string> {
    if (!AGENT_EFS_ID) {
      console.log('[container] No AGENT_EFS_ID configured, skipping EFS');
      return '';
    }

    const existing = await this.efs.send(new DescribeAccessPointsCommand({
      FileSystemId: AGENT_EFS_ID,
    }));

    const match = existing.AccessPoints?.find(
      ap => ap.RootDirectory?.Path === `/agents/${agentId}`
    );
    if (match?.AccessPointId) {
      console.log(`[container] Reusing access point ${match.AccessPointId} for ${agentId}`);
      return match.AccessPointId;
    }

    const result = await this.efs.send(new CreateAccessPointCommand({
      FileSystemId: AGENT_EFS_ID,
      PosixUser: { Uid: 1000, Gid: 1000 },
      RootDirectory: {
        Path: `/agents/${agentId}`,
        CreationInfo: { OwnerUid: 1000, OwnerGid: 1000, Permissions: '755' },
      },
      Tags: [{ Key: 'AgentId', Value: agentId }],
    }));

    const apId = result.AccessPointId!;
    console.log(`[container] Created access point ${apId} at /agents/${agentId}`);
    return apId;
  }

  private async registerTaskDefWithEfs(accessPointId: string): Promise<string> {
    const desc = await this.ecs.send(new DescribeTaskDefinitionCommand({
      taskDefinition: TASK_DEFINITION,
    }));

    const baseDef = desc.taskDefinition!;
    const containers = baseDef.containerDefinitions!.map(c => ({
      ...c,
      mountPoints: [
        ...(c.mountPoints || []),
        { sourceVolume: 'agent-workspace', containerPath: '/app/data/openclaw', readOnly: false },
      ],
    }));

    const result = await this.ecs.send(new RegisterTaskDefinitionCommand({
      family: baseDef.family!,
      networkMode: baseDef.networkMode,
      requiresCompatibilities: baseDef.requiresCompatibilities as any,
      cpu: baseDef.cpu,
      memory: baseDef.memory,
      executionRoleArn: baseDef.executionRoleArn,
      taskRoleArn: baseDef.taskRoleArn,
      containerDefinitions: containers,
      volumes: [
        ...(baseDef.volumes || []),
        {
          name: 'agent-workspace',
          efsVolumeConfiguration: {
            fileSystemId: AGENT_EFS_ID,
            transitEncryption: 'ENABLED',
            authorizationConfig: {
              accessPointId,
              iam: 'ENABLED',
            },
          },
        },
      ],
    }));

    const arn = result.taskDefinition!.taskDefinitionArn!;
    console.log(`[container] Registered task definition ${arn} with EFS access point ${accessPointId}`);
    return arn;
  }

  async deployAgent(params: DeployParams): Promise<OpenClawContainer> {
    if (this.containers.has(params.agentId)) {
      throw new Error(`Agent ${params.agentId} already has a running container`);
    }

    if (this.containers.size >= MAX_CONTAINERS) {
      throw new Error(`Container limit reached (${MAX_CONTAINERS}). Stop an existing agent before deploying a new one.`);
    }

    const progress = params.onProgress || (() => {});
    let taskDef = TASK_DEFINITION;
    let accessPointId = '';

    if (AGENT_EFS_ID) {
      progress('efs');
      accessPointId = await this.getOrCreateAccessPoint(params.agentId);
      if (accessPointId) {
        progress('task_def');
        taskDef = await this.registerTaskDefWithEfs(accessPointId);
      }
    }

    progress('launching');
    const result = await this.ecs.send(new RunTaskCommand({
      cluster: ECS_CLUSTER,
      taskDefinition: taskDef,
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
            { name: 'AGENT_NAME', value: params.agentName || 'BlockHelix Agent' },
            { name: 'SYSTEM_PROMPT', value: params.systemPrompt },
            { name: 'ANTHROPIC_API_KEY', value: params.anthropicApiKey },
            { name: 'MODEL', value: params.model || 'claude-sonnet-4-20250514' },
            { name: 'GATEWAY_AUTH_TOKEN', value: crypto.randomBytes(32).toString('hex') },
            ...(params.sdkKey ? [{ name: 'BH_SDK_KEY', value: params.sdkKey }] : []),
            ...(params.runtimeUrl ? [{ name: 'BH_RUNTIME_URL', value: params.runtimeUrl }] : []),
            ...(params.braveApiKey ? [{ name: 'BRAVE_API_KEY', value: params.braveApiKey }] : []),
            ...(params.telegramBotToken ? [{ name: 'TELEGRAM_BOT_TOKEN', value: params.telegramBotToken }] : []),
            ...(params.operatorTelegram ? [{ name: 'OPERATOR_TELEGRAM', value: params.operatorTelegram }] : []),
            ...(params.colosseumApiKey ? [{ name: 'COLOSSEUM_API_KEY', value: params.colosseumApiKey }] : []),
            ...(params.kimiApiKey ? [{ name: 'KIMI_API_KEY', value: params.kimiApiKey }] : []),
            ...(params.veoApiKey ? [{ name: 'VEO_API_KEY', value: params.veoApiKey }] : []),
            ...(params.runwayApiKey ? [{ name: 'RUNWAY_API_KEY', value: params.runwayApiKey }] : []),
            ...(params.heartbeat?.enabled ? [
              { name: 'HEARTBEAT_ENABLED', value: 'true' },
              ...(params.heartbeat.interval ? [{ name: 'HEARTBEAT_INTERVAL', value: params.heartbeat.interval }] : []),
              ...(params.heartbeat.model ? [{ name: 'HEARTBEAT_MODEL', value: params.heartbeat.model }] : []),
              ...(params.heartbeat.activeStart ? [{ name: 'HEARTBEAT_ACTIVE_START', value: params.heartbeat.activeStart }] : []),
              ...(params.heartbeat.activeEnd ? [{ name: 'HEARTBEAT_ACTIVE_END', value: params.heartbeat.activeEnd }] : []),
              ...(params.heartbeat.timezone ? [{ name: 'HEARTBEAT_TIMEZONE', value: params.heartbeat.timezone }] : []),
            ] : []),
          ],
        }],
      },
    }));

    const taskArn = result.tasks?.[0]?.taskArn;
    if (!taskArn) {
      throw new Error('Failed to start ECS task');
    }

    console.log(`[container] Started task ${taskArn} for agent ${params.agentId}`);

    progress('networking');
    const privateIp = await this.waitForPrivateIp(taskArn);
    progress('health');
    await this.waitForHealth(privateIp);

    const container: OpenClawContainer = {
      taskArn,
      privateIp,
      agentId: params.agentId,
      startedAt: Date.now(),
      accessPointId: accessPointId || undefined,
    };

    this.containers.set(params.agentId, container);
    progress('complete');
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

  async proxyRequest(agentId: string, body: { input: string; context?: Record<string, unknown>; systemPrompt?: string }, fallbackIp?: string): Promise<{ output: string }> {
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

  async proxyRequestStream(agentId: string, body: { input: string; stream: true; context?: Record<string, unknown>; systemPrompt?: string }, fallbackIp?: string): Promise<globalThis.Response> {
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

    return resp;
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
    console.log(`[container] Stopped agent ${agentId} (access point preserved for restart)`);
  }

  getContainer(agentId: string): OpenClawContainer | undefined {
    return this.containers.get(agentId);
  }

  listContainers(): OpenClawContainer[] {
    return Array.from(this.containers.values());
  }
}

export const containerManager = new ContainerManager();
