import { useEffect } from 'react';

/**
 * Sets the document title when a page mounts.
 * Usage: usePageTitle('Dashboard') → tab shows "Dashboard | Coko"
 */
export function usePageTitle(title: string, portal: string = 'Coko') {
    useEffect(() => {
        const prev = document.title;
        document.title = `${title} | ${portal}`;
        return () => { document.title = prev; };
    }, [title, portal]);
}
