import { ConvexReactClient } from 'convex/react';

const convexUrl =
  process.env.EXPO_PUBLIC_CONVEX_URL || 'https://savory-ram-12.convex.cloud';

export const convex = new ConvexReactClient(convexUrl, {
  unsavedChangesWarning: false,
});
