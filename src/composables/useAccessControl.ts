import { ref, type Ref } from 'vue';
import { API } from '@/utils/constants';
import { useAuth } from './useAuth';

const permissions: Ref<string[]> = ref([]);
const permissionsLoaded: Ref<boolean> = ref(false);
const permissionsLoading: Ref<boolean> = ref(false);
let inflightLoad: Promise<string[]> | null = null;

function normalizePermissions(raw: any): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((item: any) => typeof item === 'string' && item.length > 0 && item !== '*');
}

function hasPermissionSync(permission: string): boolean {
  if (!permission) return true;
  return permissions.value.includes('admin:full') || permissions.value.includes(permission);
}

async function loadPermissions({ force = false } = {}): Promise<string[]> {
  const { isAuthenticated, authFetch } = useAuth();

  if (!isAuthenticated.value) {
    permissions.value = [];
    permissionsLoaded.value = false;
    return [];
  }

  if (permissionsLoaded.value && !force) {
    return permissions.value;
  }

  if (inflightLoad && !force) {
    return inflightLoad;
  }

  const run = async (): Promise<string[]> => {
    permissionsLoading.value = true;
    try {
      const response = await authFetch(API.PERMISSIONS_USER);
      const result = await response.json();
      if (!result?.success) {
        permissions.value = [];
        permissionsLoaded.value = false;
        return [];
      }
      const nextPermissions = normalizePermissions(result?.data?.permissions);
      permissions.value = nextPermissions;
      permissionsLoaded.value = true;
      return nextPermissions;
    } catch (_err) {
      permissions.value = [];
      permissionsLoaded.value = false;
      return [];
    } finally {
      permissionsLoading.value = false;
    }
  };

  inflightLoad = run();
  try {
    return await inflightLoad;
  } finally {
    inflightLoad = null;
  }
}

async function can(permission: string): Promise<boolean> {
  if (!permission) return true;
  await loadPermissions();
  return hasPermissionSync(permission);
}

function clearPermissions(): void {
  permissions.value = [];
  permissionsLoaded.value = false;
}

export function useAccessControl() {
  return {
    permissions,
    permissionsLoaded,
    permissionsLoading,
    loadPermissions,
    can,
    hasPermission: hasPermissionSync,
    clearPermissions,
  };
}
