import { Octokit } from '@octokit/rest';

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

interface RepoInfo {
  owner: string;
  repo: string;
}

function parseRepoUrl(repoUrl: string): RepoInfo {
  const match = repoUrl.match(/github\.com\/([^/]+)\/([^/.]+)/);
  if (!match) {
    throw new Error(`Invalid GitHub URL: ${repoUrl}`);
  }
  return { owner: match[1], repo: match[2] };
}

export interface PullRequestParams {
  repoUrl: string;
  patch: string;
  filePath: string;
  title: string;
  body: string;
}

export interface PullRequestResult {
  prUrl: string;
  prNumber: number;
  branchName: string;
}

export async function createPullRequest(params: PullRequestParams): Promise<PullRequestResult> {
  const { owner, repo } = parseRepoUrl(params.repoUrl);

  const { data: repoData } = await octokit.repos.get({ owner, repo });
  const defaultBranch = repoData.default_branch;

  const { data: refData } = await octokit.git.getRef({
    owner,
    repo,
    ref: `heads/${defaultBranch}`,
  });
  const baseSha = refData.object.sha;

  const branchName = `blockhelix/patch-${Date.now()}`;
  await octokit.git.createRef({
    owner,
    repo,
    ref: `refs/heads/${branchName}`,
    sha: baseSha,
  });

  let existingContent = '';
  let existingSha: string | undefined;
  try {
    const { data: fileData } = await octokit.repos.getContent({
      owner,
      repo,
      path: params.filePath,
      ref: branchName,
    });
    if ('content' in fileData && typeof fileData.content === 'string') {
      existingContent = Buffer.from(fileData.content, 'base64').toString('utf-8');
      existingSha = fileData.sha;
    }
  } catch {
    existingContent = '';
  }

  const newContent = applyPatch(existingContent, params.patch);

  await octokit.repos.createOrUpdateFileContents({
    owner,
    repo,
    path: params.filePath,
    message: `fix: ${params.title}`,
    content: Buffer.from(newContent).toString('base64'),
    branch: branchName,
    sha: existingSha,
  });

  const { data: pr } = await octokit.pulls.create({
    owner,
    repo,
    title: params.title,
    body: params.body,
    head: branchName,
    base: defaultBranch,
  });

  return {
    prUrl: pr.html_url,
    prNumber: pr.number,
    branchName,
  };
}

function applyPatch(original: string, patch: string): string {
  if (!patch.includes('@@') && !patch.startsWith('---') && !patch.startsWith('diff')) {
    return patch;
  }

  const lines = original.split('\n');
  const patchLines = patch.split('\n');
  const result = [...lines];

  let offset = 0;

  for (let i = 0; i < patchLines.length; i++) {
    const hunkMatch = patchLines[i].match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
    if (!hunkMatch) continue;

    const origStart = parseInt(hunkMatch[1], 10) - 1;
    const removals: number[] = [];
    const additions: string[] = [];
    let pos = origStart;

    for (let j = i + 1; j < patchLines.length; j++) {
      const line = patchLines[j];
      if (line.startsWith('@@') || line.startsWith('diff') || line.startsWith('---') || line.startsWith('+++')) {
        break;
      }
      if (line.startsWith('-')) {
        removals.push(pos + offset);
        pos++;
      } else if (line.startsWith('+')) {
        additions.push(line.substring(1));
      } else if (line.startsWith(' ') || line === '') {
        pos++;
      }
    }

    for (let r = removals.length - 1; r >= 0; r--) {
      result.splice(removals[r], 1);
    }

    const insertAt = removals.length > 0 ? removals[0] : origStart + offset;
    result.splice(insertAt, 0, ...additions);
    offset += additions.length - removals.length;
  }

  return result.join('\n');
}
