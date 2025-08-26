import { useRouter } from 'vue-router';

/**
 * Composable to provide a function for opening a route in a new browser tab.
 * @returns { openLinkInNewTab }
 */
export function useOpenLinkInNewTab() {
  const router = process.client ? useRouter() : null;

  /**
   * Opens the given path in a new browser tab, preserving the base URL.
   * @param {string} path - The route path to open (e.g. '/services')
   */
  function openLinkInNewTab(path: string) {
    if (process.client) {
      const base = window.location.origin;
      window.open(base + path, '_blank');
    }
  }

  return { openLinkInNewTab };
}
