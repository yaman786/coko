import { useEffect } from 'react';

/**
 * Sets the document title when a page mounts.
 * Usage: usePageTitle('Dashboard') → tab shows "Dashboard | Coko"
 */
export function usePageTitle(title: string) {
    useEffect(() => {
        const prev = document.title;
        document.title = `${title} | Coko`;
        return () => { document.title = prev; };
    }, [title]);
}
