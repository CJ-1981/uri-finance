# GitHub Issue Template

## Issue Information

**Title**: [SPEC-REPORT-001] Chart Dashboard Reporting with Summary Table and Export
**Description**: Add comprehensive summary table component and export functionality to the chart dashboard
**Labels**: `enhancement`, `reporting`, `finance`
**Priority**: High
**Assignees**: @CJ-1981

---

## Summary

Add a spreadsheet-like summary table at the top of the chart dashboard that displays income/expense breakdown by category with category codes. The summary table should:
- Display category code (from `Category.code`)
- Show category name with emoji
- Show total income, expense, and net balance per category
- Calculate percentage of total per currency
- Support period and category filtering
- Use glass-morphism styling consistent with dashboard
- Be fully responsive across desktop, tablet, and mobile
- Support internationalization via existing `useI18n` hook

---

## Acceptance Criteria

### Summary Table
- [ ] Summary table displays with all required columns
- [ ] Table respects period and category filters
- [ ] Multi-currency grouping works correctly
- [ ] Empty state displays appropriate message
- [ ] Horizontal scroll with sticky first column on mobile

### Export Functionality
- [ ] Export modal with format selection (PDF, Markdown) and chart selection
- [ ] PDF generation with jsPDF and jspdf-autotable
- [ ] Markdown generation with structured format
- [ ] Chart capture with fallback chain (html2canvas → canvg → placeholder)
- [ ] File downloads with appropriate filename
- [ ] Generation completes within 5 seconds
- [ ] Memory cleanup verified

- [ ] Accessibility features (ARIA, WCAG 2.1 AA)
- [ ] Performance optimized with caching
- [ ] Bundle size maintained at ~230KB
- [ ] No regressions in existing functionality

