# Patterns

## Current Page Patterns

- `DashboardShell`
- `ManagementListShell`
- `WorkflowDetailShell`
- `PublicViewerShell`
- `MobileSalesShell`

## Intended Use

### DashboardShell

Use for overview, analytics, and KPI-heavy pages.

### ManagementListShell

Use for list, filters, summary, and table/grid workflows.

### WorkflowDetailShell

Use for detail-oriented operational pages with a main content area and optional side column.

### PublicViewerShell

Use for gallery, public space, and viewer-style pages.

### MobileSalesShell

Use for mobile-first sales workflows.

## Rule

If two pages share the same high-level structure, they should converge into one shell instead of re-implementing layout.

## Pattern Ownership

- Patterns own page frame structure only.
- Patterns do not own local card systems, chart palettes, bespoke callouts, local drawers, or page-local icon families.
- Pages should fill pattern slots with foundation and composed components, not with new visual primitives.

## Required Usage

- KPI, analytics, and dashboard-style pages must use `DashboardShell`.
- Management pages with filters, summary, and list/table workflows must use `ManagementListShell`.
- Detail-heavy operational flows must use `WorkflowDetailShell` unless a more specific shared pattern exists.
- Public gallery and viewer experiences must use `PublicViewerShell`.
- Mobile sales experiences must use `MobileSalesShell`.

## Forbidden at the Page Layer

- Rebuilding shell-level spacing, headers, and action bars inside one page when a pattern already exists
- Local glass-card systems, background blob systems, or page-specific status surfaces that should be shared
- Page-local sticky CTA, gate, or viewer patterns when an existing public-viewer shell or shared overlay scaffold can own the structure

## Escalation Rule

- If a page needs structure that no current pattern covers, add or extend a pattern instead of encoding it in the page.
