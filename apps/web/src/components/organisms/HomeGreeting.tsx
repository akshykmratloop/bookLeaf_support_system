import { ArrowUp, Sparkles } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { authorPaths } from '../../lib/paths';

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

/** "Hi Priya" with a question box: typing here opens Ask with the question already sent. */
export function HomeGreeting({ name, canAsk }: { name: string; canAsk: boolean }) {
  const navigate = useNavigate();
  const [text, setText] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const question = text.trim();
    if (question) navigate(authorPaths.ask, { state: { question } });
  };
  return (
    <section className="relative animate-fade-up overflow-hidden rounded-card bg-gradient-to-br from-brand to-brand-deep p-5 text-white shadow-lift lg:p-7">
      <Sparkles aria-hidden size={120} className="absolute -top-4 -right-6 opacity-10" />
      <h1 className="text-[24px] leading-tight font-light tracking-tight lg:text-[32px]">
        Hi {firstName(name)}, how can we help?
      </h1>
      <p className="mt-1 text-[13.5px] text-white/85">
        Answers come straight from your own book and royalty records.
      </p>
      {canAsk ? (
        <form
          onSubmit={submit}
          className="mt-4 flex gap-2 rounded-full bg-white p-1.5 shadow-lift focus-within:ring-4 focus-within:ring-white/40"
        >
          <label htmlFor="home-ask" className="sr-only">
            Your question
          </label>
          <input
            id="home-ask"
            value={text}
            maxLength={1000}
            onChange={(e) => setText(e.target.value)}
            placeholder="Ask about royalties, payouts, your book's status…"
            className="min-w-0 flex-1 bg-transparent px-3 text-[14px] text-ink placeholder:text-ink-3 focus:outline-none"
          />
          <button
            type="submit"
            aria-label="Ask"
            disabled={!text.trim()}
            className="grid h-10 w-10 place-items-center rounded-full bg-brand text-white transition-opacity disabled:opacity-40"
          >
            <ArrowUp size={18} aria-hidden />
          </button>
        </form>
      ) : null}
    </section>
  );
}
