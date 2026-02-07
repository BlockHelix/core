import * as cheerio from 'cheerio';

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface WebContent {
  url: string;
  title: string;
  content: string;
  links: string[];
}

const USER_AGENT = 'Mozilla/5.0 (compatible; BlockHelixAgent/1.0)';
const FETCH_TIMEOUT = 10000;

async function fetchWithTimeout(url: string, timeout = FETCH_TIMEOUT): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function searchWeb(query: string, maxResults = 5): Promise<SearchResult[]> {
  const results: SearchResult[] = [];

  try {
    const encodedQuery = encodeURIComponent(query);
    const url = `https://html.duckduckgo.com/html/?q=${encodedQuery}`;
    const response = await fetchWithTimeout(url);

    if (!response.ok) {
      console.log(`[web] Search failed: ${response.status}`);
      return results;
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    $('.result').each((i, el) => {
      if (results.length >= maxResults) return false;

      const $el = $(el);
      const titleEl = $el.find('.result__a');
      const snippetEl = $el.find('.result__snippet');

      const title = titleEl.text().trim();
      let href = titleEl.attr('href') || '';

      if (href.includes('uddg=')) {
        const match = href.match(/uddg=([^&]+)/);
        if (match) {
          try {
            href = decodeURIComponent(match[1]);
          } catch { /* keep original */ }
        }
      }

      const snippet = snippetEl.text().trim();

      if (title && href && href.startsWith('http')) {
        results.push({ title, url: href, snippet });
      }
    });
  } catch (err) {
    console.log(`[web] Search error: ${err instanceof Error ? err.message : 'unknown'}`);
  }

  return results;
}

export async function fetchPage(url: string): Promise<WebContent | null> {
  try {
    const response = await fetchWithTimeout(url);

    if (!response.ok) {
      return null;
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('text/plain') && !contentType.includes('application/json')) {
      return null;
    }

    const html = await response.text();

    if (contentType.includes('application/json')) {
      return {
        url,
        title: 'JSON Response',
        content: html.slice(0, 50000),
        links: [],
      };
    }

    const $ = cheerio.load(html);

    $('script, style, nav, header, footer, iframe, noscript').remove();

    const title = $('title').text().trim() || $('h1').first().text().trim() || 'Untitled';

    const links: string[] = [];
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      if (href && href.startsWith('http') && links.length < 20) {
        links.push(href);
      }
    });

    let content = '';

    $('article, main, .content, .post, .article, #content, #main').each((_, el) => {
      content += $(el).text() + '\n\n';
    });

    if (!content.trim()) {
      content = $('body').text();
    }

    content = content
      .replace(/\s+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
      .slice(0, 50000);

    return { url, title, content, links };
  } catch (err) {
    console.log(`[web] Fetch error for ${url}: ${err instanceof Error ? err.message : 'unknown'}`);
    return null;
  }
}

export async function fetchGitHubIssues(owner: string, repo: string, query?: string): Promise<SearchResult[]> {
  const results: SearchResult[] = [];

  try {
    const searchQuery = query
      ? `repo:${owner}/${repo} ${query}`
      : `repo:${owner}/${repo} is:issue`;

    const url = `https://github.com/search?q=${encodeURIComponent(searchQuery)}&type=issues`;
    const response = await fetchWithTimeout(url);

    if (!response.ok) return results;

    const html = await response.text();
    const $ = cheerio.load(html);

    $('[data-testid="results-list"] .Box-row, .issue-list-item').each((i, el) => {
      if (results.length >= 5) return false;

      const $el = $(el);
      const titleEl = $el.find('a.Link--primary, a.v-align-middle');
      const title = titleEl.text().trim();
      const href = titleEl.attr('href');

      if (title && href) {
        const fullUrl = href.startsWith('http') ? href : `https://github.com${href}`;
        results.push({
          title,
          url: fullUrl,
          snippet: $el.text().replace(/\s+/g, ' ').trim().slice(0, 200),
        });
      }
    });
  } catch (err) {
    console.log(`[web] GitHub issues fetch error: ${err instanceof Error ? err.message : 'unknown'}`);
  }

  return results;
}

export async function searchSecurityAdvisories(protocol: string, keywords: string[]): Promise<SearchResult[]> {
  const allResults: SearchResult[] = [];

  const queries = [
    `${protocol} vulnerability audit`,
    `${protocol} exploit hack`,
    `${protocol} security advisory CVE`,
    ...keywords.slice(0, 2).map(k => `${protocol} ${k} vulnerability`),
  ];

  for (const query of queries.slice(0, 3)) {
    const results = await searchWeb(query, 3);
    for (const result of results) {
      if (!allResults.some(r => r.url === result.url)) {
        allResults.push(result);
      }
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return allResults.slice(0, 10);
}

export interface ResearchContext {
  protocolName: string;
  searchResults: SearchResult[];
  pageContents: WebContent[];
  githubIssues: SearchResult[];
}

export async function gatherResearch(
  protocolName: string,
  repoOwner?: string,
  repoName?: string,
  keywords: string[] = [],
): Promise<ResearchContext> {
  const context: ResearchContext = {
    protocolName,
    searchResults: [],
    pageContents: [],
    githubIssues: [],
  };

  const [searchResults, advisories] = await Promise.all([
    searchWeb(`${protocolName} DeFi protocol`, 5),
    searchSecurityAdvisories(protocolName, keywords),
  ]);

  context.searchResults = [...searchResults, ...advisories]
    .filter((r, i, arr) => arr.findIndex(x => x.url === r.url) === i)
    .slice(0, 10);

  if (repoOwner && repoName) {
    context.githubIssues = await fetchGitHubIssues(repoOwner, repoName, 'vulnerability OR security OR bug');
  }

  const priorityUrls = context.searchResults
    .filter(r =>
      r.url.includes('audit') ||
      r.url.includes('security') ||
      r.url.includes('vulnerability') ||
      r.url.includes('docs')
    )
    .slice(0, 3);

  for (const result of priorityUrls) {
    const content = await fetchPage(result.url);
    if (content && content.content.length > 100) {
      context.pageContents.push(content);
    }
  }

  return context;
}
