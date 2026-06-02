import type { UserProfile } from './types/db';
import type { Permission } from './permissions';
import { canAccessRoute, hasPermission } from './permissions';

/**
 * Check if a user has access to a resource based on their role
 * Returns { granted: true } if access is allowed, { granted: false, reason: string } otherwise
 */
export function checkAccess(
  profile: UserProfile | null,
  permission: Permission
): { granted: boolean; reason?: string } {
  if (!profile) {
    return { granted: false, reason: 'Not authenticated' };
  }

  if (profile.deactivated_at) {
    return { granted: false, reason: 'Account deactivated' };
  }

  if (!hasPermission(profile.role, permission)) {
    return { granted: false, reason: `Your role (${profile.role}) doesn't have access to this` };
  }

  return { granted: true };
}

/**
 * Check if a user can access a specific route
 */
export function checkRouteAccess(
  profile: UserProfile | null,
  routePath: string
): { granted: boolean; reason?: string } {
  if (!profile) {
    return { granted: false, reason: 'Not authenticated' };
  }

  if (profile.deactivated_at) {
    return { granted: false, reason: 'Account deactivated' };
  }

  if (!canAccessRoute(profile.role, routePath)) {
    return { granted: false, reason: `Your role (${profile.role}) doesn't have access to this page` };
  }

  return { granted: true };
}
