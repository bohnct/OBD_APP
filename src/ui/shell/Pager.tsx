import { useEffect, useRef, useState, type ReactNode } from 'react';

const DOTS_VISIBLE_MS = 1200;

interface PagerProps {
  readonly pages: readonly { readonly key: string; readonly content: ReactNode }[];
  readonly dotColor: string;
  readonly onPageChange: (index: number) => void;
}

/** Full-screen pages, swiped left and right. A dot strip shows briefly after each change. */
export function Pager({ pages, dotColor, onPageChange }: PagerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [showDots, setShowDots] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let current = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onScroll = () => {
      const next = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
      if (next === current) return;
      current = next;
      setIndex(next);
      onPageChange(next);
      setShowDots(true);
      clearTimeout(timer);
      timer = setTimeout(() => {
        setShowDots(false);
      }, DOTS_VISIBLE_MS);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      clearTimeout(timer);
      el.removeEventListener('scroll', onScroll);
    };
  }, [onPageChange]);

  return (
    <>
      <div className="pager" ref={ref}>
        {pages.map((page) => (
          <section className="page" key={page.key}>
            {page.content}
          </section>
        ))}
      </div>
      <div className={`page-dots${showDots ? ' visible' : ''}`} aria-hidden="true">
        {pages.map((page, i) => (
          <span key={page.key} style={{ background: dotColor, opacity: i === index ? 1 : 0.3 }} />
        ))}
      </div>
    </>
  );
}
