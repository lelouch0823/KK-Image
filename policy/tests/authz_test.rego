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

test_admin_role_and_direct_permission_no_conflict if {
  decision := authz.decision with input as {
    "subject": {"role": "admin", "permissions": ["admin:full"]},
    "action": "admin:full",
    "resource": {"type": "api_route"},
    "context": {"method": "GET"}
  }
  decision.allow == true
  decision.reason == "role_wildcard"
}

test_auditor_can_read_audit if {
  authz.allow with input as {
    "subject": {"role": "auditor"},
    "action": "audit:read",
    "resource": {"type": "api_route"},
    "context": {"method": "GET"}
  }
}

test_direct_audit_export_permission if {
  authz.allow with input as {
    "subject": {"role": "viewer", "permissions": ["audit:export"]},
    "action": "audit:export",
    "resource": {"type": "api_route"},
    "context": {"method": "GET"}
  }
}
