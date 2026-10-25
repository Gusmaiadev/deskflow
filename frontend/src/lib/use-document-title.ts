import { useEffect } from 'react';

/** Muda o título da aba do navegador: "Chamados · DeskFlow". */
export function useDocumentTitle(title: string): void {
  useEffect(() => {
    document.title = `${title} · DeskFlow`;
  }, [title]);
}
