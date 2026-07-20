'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function WhitepaperContent({ content }: { content: string }) {
  return (
    <main className="min-h-screen pt-32 pb-20 bg-white">
      <div className="max-w-4xl mx-auto px-6 lg:px-8">
        <article className="
          prose max-w-none
          prose-headings:font-bold prose-headings:tracking-tight
          prose-h1:text-4xl prose-h1:lg:text-5xl prose-h1:text-gray-900 prose-h1:mb-4
          prose-h2:text-2xl prose-h2:lg:text-3xl prose-h2:text-gray-900 prose-h2:border-b prose-h2:border-gray-200 prose-h2:pb-3 prose-h2:mt-16
          prose-h3:text-lg prose-h3:text-gray-800 prose-h3:mt-8
          prose-p:text-gray-600 prose-p:leading-relaxed
          prose-strong:text-gray-900
          prose-a:text-cyan-700 prose-a:no-underline hover:prose-a:text-cyan-600
          prose-code:text-emerald-700 prose-code:bg-gray-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:font-mono
          prose-pre:bg-gray-900 prose-pre:border prose-pre:border-gray-800 prose-pre:rounded-none prose-pre:corner-cut-sm
          prose-table:border-collapse
          prose-th:text-[10px] prose-th:uppercase prose-th:tracking-widest prose-th:text-gray-400 prose-th:border-b prose-th:border-gray-200 prose-th:pb-2 prose-th:text-left prose-th:font-medium
          prose-td:text-sm prose-td:text-gray-600 prose-td:border-b prose-td:border-gray-100 prose-td:py-2 prose-td:font-mono
          prose-hr:border-gray-200
          prose-li:text-gray-600
          prose-blockquote:border-cyan-600/30 prose-blockquote:text-gray-500
        ">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </article>
      </div>
    </main>
  );
}
