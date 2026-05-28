package kk.authz_test

import rego.v1
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

# Manager 角色可以读取 webhooks
test_manager_allow_webhooks_read if {
  authz.allow with input as {
    "subject": {"role": "manager"},
    "action": "webhooks:read",
    "resource": {"type": "api_route"},
    "context": {"method": "GET"}
  }
}

# Manager 角色不能写入 webhooks（高危操作仅限 admin）
test_manager_deny_webhooks_write if {
  not authz.allow with input as {
    "subject": {"role": "manager"},
    "action": "webhooks:write",
    "resource": {"type": "api_route"},
    "context": {"method": "POST"}
  }
}

# Sales 角色不能读取 webhooks
test_sales_deny_webhooks_read if {
  not authz.allow with input as {
    "subject": {"role": "sales"},
    "action": "webhooks:read",
    "resource": {"type": "api_route"},
    "context": {"method": "GET"}
  }
}

# Sales 角色不能写入 webhooks
test_sales_deny_webhooks_write if {
  not authz.allow with input as {
    "subject": {"role": "sales"},
    "action": "webhooks:write",
    "resource": {"type": "api_route"},
    "context": {"method": "POST"}
  }
}

# Sales 角色可以管理订单
test_sales_allow_orders_manage if {
  authz.allow with input as {
    "subject": {"role": "sales"},
    "action": "orders:manage",
    "resource": {"type": "api_route"},
    "context": {"method": "GET"}
  }
}

# Sales 角色不能删除文件（仅有 read 和 write）
test_sales_deny_files_delete if {
  not authz.allow with input as {
    "subject": {"role": "sales"},
    "action": "files:delete",
    "resource": {"type": "api_route"},
    "context": {"method": "DELETE"}
  }
}
