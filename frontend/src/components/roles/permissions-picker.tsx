'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface Props {
  selectedPerms: string[];
  onToggle: (perm: string) => void;
  token: string;
}

const EXCLUDED_GROUPS = new Set(['product', 'sell', 'purchase']);

// Permissions in the same set are mutually exclusive — picking one
// automatically deselects the other.
const EXCLUSIVE_PAIRS: Record<string, string> = {
  'case.view_own': 'case.view_all',
  'case.view_all': 'case.view_own',
  'expense.view_own': 'expense.view_all',
  'expense.view_all': 'expense.view_own',
};

const groupPalette: Record<string, { bg: string; dot: string; label: string }> = {
  user:              { bg: 'bg-cyan-50', dot: 'bg-cyan-500', label: 'text-cyan-700' },
  case:              { bg: 'bg-violet-50', dot: 'bg-violet-500', label: 'text-violet-700' },
  client:            { bg: 'bg-emerald-50', dot: 'bg-emerald-500', label: 'text-emerald-700' },
  expense:           { bg: 'bg-amber-50', dot: 'bg-amber-500', label: 'text-amber-700' },
  expense_report:    { bg: 'bg-orange-50', dot: 'bg-orange-500', label: 'text-orange-700' },
  business_settings: { bg: 'bg-primary/5', dot: 'bg-primary', label: 'text-primary' },
  general:           { bg: 'bg-background', dot: 'bg-muted', label: 'text-muted' },
};

const permLabels: Record<string, string> = {
  view: 'View',
  create: 'Create',
  edit: 'Edit',
  update: 'Update',
  delete: 'Delete',
  manage: 'Manage',
  print: 'Print',
  export: 'Export',
  import: 'Import',
  access: 'Access',
  configure: 'Configure',
  assign: 'Assign',
  reassign: 'Reassign',
  approve: 'Approve',
};

// Per-permission display label overrides. Falls back to permLabels[action] then
// to the raw action string.
const permActionLabels: Record<string, string> = {
  'business_settings.access': 'Roles & Email OAuth',
  'business_settings.general': 'General Settings',
  'business_settings.firm_branches': 'Firm Branches',
  'business_settings.case_settings': 'Case Settings',
};

// Per-group display label overrides. Falls back to a Title Case of the group key.
const groupLabels: Record<string, string> = {
  business_settings: 'Settings',
};

const permDescriptions: Record<string, string> = {
  'user.view': 'View user accounts and profiles',
  'user.create': 'Invite and add new users',
  'user.update': 'Modify user roles and details',
  'user.delete': 'Remove users from the system',
  'case.view_own': 'See only cases assigned to this user (and their events on the calendar)',
  'case.view_all': 'See every case in the business — overrides view_own',
  'case.create': 'Create new cases',
  'case.update': 'Edit case details and status',
  'case.delete': 'Soft-delete cases',
  'case.reassign': 'Reassign cases to another counsel',
  'client.create': 'Add new clients',
  'client.update': 'Edit client details and toggle active status',
  'client.delete': 'Delete clients',
  'expense.view_own': 'See only own expenses',
  'expense.view_all': 'See all expenses — overrides view_own',
  'expense.create': 'Create new expenses',
  'expense.update': 'Edit expense details',
  'expense.delete': 'Delete expenses',
  'expense.approve': 'Approve or reject expenses',
  'expense_report.view': 'View expense reports',
  'business_settings.access': 'Manage roles and email OAuth credentials',
  'business_settings.general': 'Access the General Settings module',
  'business_settings.firm_branches': 'Access the Firm Branches module',
  'business_settings.case_settings': 'Access the Case Settings module',
};

export default function PermissionsPicker({ selectedPerms, onToggle, token }: Props) {
  const [allPermissions, setAllPermissions] = useState<string[]>([]);

  useEffect(() => {
    api.get<{ permissions: string[] }>('/permissions', token)
      .then((res) => setAllPermissions(res.permissions));
  }, [token]);

  const permGroups: Record<string, string[]> = {};
  allPermissions.forEach((p) => {
    const group = p.split('.')[0] || 'general';
    if (EXCLUDED_GROUPS.has(group)) return;
    if (!permGroups[group]) permGroups[group] = [];
    permGroups[group].push(p);
  });

  const selectedSet = new Set(selectedPerms);
  const formatGroupName = (g: string) => g.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());

  const handleToggle = (perm: string) => {
    const conflict = EXCLUSIVE_PAIRS[perm];
    // If we're about to enable `perm` and its mutually-exclusive sibling is
    // currently selected, deselect the sibling first.
    if (conflict && !selectedSet.has(perm) && selectedSet.has(conflict)) {
      onToggle(conflict);
    }
    onToggle(perm);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {Object.entries(permGroups).map(([group, perms]) => {
        const palette = groupPalette[group] || groupPalette.general;
        const selectedCount = perms.filter((p) => selectedSet.has(p)).length;
        return (
          <div key={group} className={`${palette.bg} rounded-xl border border-border/60 p-4`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${palette.dot}`} />
                <span className={`text-sm font-semibold ${palette.label}`}>{groupLabels[group] || formatGroupName(group)}</span>
              </div>
              <span className="text-xs text-muted">{selectedCount}/{perms.length}</span>
            </div>
            <div className="space-y-1.5">
              {perms.map((p) => {
                const checked = selectedSet.has(p);
                const action = p.split('.').pop() || '';
                return (
                  <label
                    key={p}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all ${
                      checked
                        ? 'bg-card-bg shadow-sm border border-border/80'
                        : 'hover:bg-card-bg/60'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all shrink-0 ${
                      checked
                        ? 'bg-primary border-primary'
                        : 'border-border bg-card-bg'
                    }`}>
                      {checked && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => handleToggle(p)}
                        className="absolute opacity-0"
                      />
                    </div>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`text-sm ${checked ? 'font-medium text-foreground' : 'text-foreground/60'}`}>
                        {permActionLabels[p] || permLabels[action] || action}
                      </span>
                      <div className="relative group/icon ml-auto">
                        <svg className="w-3.5 h-3.5 text-muted/40 hover:text-muted transition-colors cursor-help" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div className="absolute bottom-full right-0 mb-2 w-56 px-3 py-2 bg-primary text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover/icon:opacity-100 group-hover/icon:visible transition-all duration-200 z-10 pointer-events-none">
                          {permDescriptions[p] || `Allows ${action} access for ${group}`}
                          <div className="absolute top-full right-3 -translate-y-1/2 border-4 border-transparent border-t-primary" />
                        </div>
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
