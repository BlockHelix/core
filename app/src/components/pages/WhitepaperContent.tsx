'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function WhitepaperContent({ content }: { content: string }) {
  return (
    <main className="min-h-screen pt-32 pb-20">
      <div className="max-w-4xl mx-auto px-6 lg:px-8">
        <article className="
          prose prose-invert max-w-none
          prose-headings:font-bold prose-headings:tracking-tight
          prose-h1:text-4xl prose-h1:lg:text-5xl prose-h1:text-cyan-400 prose-h1:mb-4
          prose-h2:text-2xl prose-h2:lg:text-3xl prose-h2:text-white prose-h2:border-b prose-h2:border-white/10 prose-h2:pb-3 prose-h2:mt-16
          prose-h3:text-lg prose-h3:text-white/90 prose-h3:mt-8
          prose-p:text-white/60 prose-p:leading-relaxed
          prose-strong:text-white/80
          prose-a:text-cyan-400 prose-a:no-underline hover:prose-a:text-cyan-300
          prose-code:text-emerald-400 prose-code:bg-white/5 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:font-mono
          prose-pre:bg-white/[0.03] prose-pre:border prose-pre:border-white/10 prose-pre:rounded-none prose-pre:corner-cut-sm
          prose-table:border-collapse
          prose-th:text-[10px] prose-th:uppercase prose-th:tracking-widest prose-th:text-white/40 prose-th:border-b prose-th:border-white/10 prose-th:pb-2 prose-th:text-left prose-th:font-medium
          prose-td:text-sm prose-td:text-white/50 prose-td:border-b prose-td:border-white/5 prose-td:py-2 prose-td:font-mono
          prose-hr:border-white/10
          prose-li:text-white/60
          prose-blockquote:border-cyan-400/30 prose-blockquote:text-white/50
        ">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </article>
      </div>
    </main>
  );
}
