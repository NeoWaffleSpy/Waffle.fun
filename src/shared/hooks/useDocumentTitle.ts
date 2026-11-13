import { useEffect } from 'react';

const SITE = 'Waffle.fun';

export function useDocumentTitle(title?: string): void {
  useEffect(() => {
    document.title = title ? `${title} · ${SITE}` : SITE;
  }, [title]);
}
