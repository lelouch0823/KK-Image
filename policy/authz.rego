package kk.authz

default allow := false

role_permissions := {
  "admin": {"*"},
  "manager": {
    "read", "write", "delete", "share",
    "files:read", "files:write", "files:delete",
    "folders:read", "folders:write", "folders:delete",
    "settings:read",
    "spaces:manage",
    "products:manage",
    "orders:manage",
    "users:read",
    "stats:read"
  },
  "sales": {
    "read", "write",
    "files:read", "files:write",
    "spaces:read", "spaces:manage",
    "orders:manage",
    "products:read",
    "users:read"
  },
  "viewer": {
    "read",
    "files:read",
    "spaces:read",
    "products:read",
    "users:read",
    "stats:read"
  },
  "user": {
    "read",
    "files:read",
    "spaces:read",
    "products:read"
  }
}

has_role_wildcard if {
  perms := role_permissions[input.subject.role]
  perms["*"]
}

has_role_permission if {
  perms := role_permissions[input.subject.role]
  perms[input.action]
}

has_direct_permission if {
  some perm in object.get(input.subject, "permissions", [])
  perm == input.action
}

allow if has_role_wildcard
allow if has_role_permission
allow if has_direct_permission

decision := {"allow": allow, "reason": reason}

reason := "role_wildcard" if {
  has_role_wildcard
} else := "role_permission" if {
  has_role_permission
} else := "direct_permission" if {
  has_direct_permission
} else := "deny"
