'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function PostBody({ content }: { content: string }) {
  return (
    <div
      className="
        prose prose-lg max-w-none
        prose-headings:font-bold prose-headings:tracking-tight
        prose-h2:text-2xl prose-h2:lg:text-3xl prose-h2:text-gray-900 prose-h2:mt-16 prose-h2:mb-4
        prose-h3:text-lg prose-h3:text-gray-800 prose-h3:mt-8
        prose-p:text-gray-700 prose-p:leading-relaxed
        prose-strong:text-gray-900
        prose-a:text-[#10c689] prose-a:no-underline hover:prose-a:underline
        prose-code:text-[#10c689] prose-code:bg-gray-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:font-mono
        prose-pre:bg-gray-900 prose-pre:border prose-pre:border-gray-800 prose-pre:rounded-none
        prose-blockquote:border-[#10c689]/30 prose-blockquote:text-gray-500
        prose-hr:border-gray-200
        prose-li:text-gray-700
      "
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
