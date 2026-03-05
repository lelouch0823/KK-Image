import { ref } from 'vue';
import { API } from '@/utils/constants';
import { useAuth } from './useAuth';

const permissions = ref([]);
const permissionsLoaded = ref(false);
const permissionsLoading = ref(false);
let inflightLoad = null;

function normalizePermissions(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.filter((item) => typeof item === 'string' && item.length > 0);
}

function hasPermissionSync(permission) {
  if (!permission) return true;
  return permissions.value.includes('admin:full') || permissions.value.includes(permission);
}

async function loadPermissions({ force = false } = {}) {
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

  const run = async () => {
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

async function can(permission) {
  if (!permission) return true;
  await loadPermissions();
  return hasPermissionSync(permission);
}

function clearPermissions() {
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
