import type { ComponentType } from 'react';
import { AiUsagePage, type AiUsagePageProps } from './AiUsagePage.js';

export { AiUsagePage, type AiUsagePageProps };

/**
 * A self-describing page a host app can mount from its nav config: the host's catch-all route
 * matches `path`, renders `Page` inside its own AppShell, and passes its API base + authed fetch.
 */
export interface ReModule {
  id: string;
  path: string;
  label: string;
  /** `@hasnain-a-a/re-ui-kit/icons` icon name. */
  icon: string;
  Page: ComponentType<AiUsagePageProps>;
}

export const aiUsageModule: ReModule = {
  id: 'ai-usage',
  path: '/ai-usage',
  label: 'AI Usage',
  icon: 'sparkles',
  Page: AiUsagePage,
};
