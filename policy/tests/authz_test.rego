package kk.authz_test

import data.kk.authz

test_admin_allow_any if {
  authz.allow with input as {
    "subject": {"role": "admin"},
    "action": "files:delete",
    "resource": {"type": "api_route"},
    "context": {"method": "DELETE"}
  }
}

test_manager_allow_files_read if {
  authz.allow with input as {
    "subject": {"role": "manager"},
    "action": "files:read",
    "resource": {"type": "api_route"},
    "context": {"method": "GET"}
  }
}

test_viewer_deny_files_delete if {
  not authz.allow with input as {
    "subject": {"role": "viewer"},
    "action": "files:delete",
    "resource": {"type": "api_route"},
    "context": {"method": "DELETE"}
  }
}
