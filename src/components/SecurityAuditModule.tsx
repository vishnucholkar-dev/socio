import React, { useState, useEffect } from 'react';
import { LoginAuditRecord, LoginAuditResponse, fetchSecurityAuditLogs, clearSecurityAuditLogs } from '../services/audit';
import { Shield, AlertCircle, CheckCircle2, Search, ArrowRight, Calendar, Users, Phone } from './Icons';

interface SecurityAuditModuleProps {
  onClose?: () => void;
}

export const SecurityAuditModule: React.FC<SecurityAuditModuleProps> = ({ onClose }) => {
  const [data, setData] = useState<LoginAuditResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [roleFilter, setRoleFilter] = useState('all');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    let isCurrent = true;
    setLoading(true);
    fetchSecurityAuditLogs({
      page,
      limit,
      search,
      status: statusFilter,
      role: roleFilter
    }).then(res => {
      if (isCurrent) {
        setData(res);
        setLoading(false);
      }
    });

    return () => { isCurrent = false; };
  }, [page, limit, search, statusFilter, roleFilter, refreshTrigger]);

  const handleExportCsv = () => {
    if (!data || !data.items || data.items.length === 0) return;

    const headers = ['ID', 'Timestamp (UTC)', 'IP Address', 'Role', 'Flat Number', 'Username', 'Status', 'Failure Reason', 'Device Type', 'OS', 'Browser', 'Resolution', 'Timezone'];
    const rows = data.items.map(i => [
      i.id,
      i.timestamp,
      i.ip,
      i.role,
      i.flatNumber || '',
      `"${(i.username || '').replace(/"/g, '""')}"`,
      i.status,
      `"${(i.reason || '').replace(/"/g, '""')}"`,
      i.device,
      i.os,
      i.browser,
      i.screenResolution,
      i.timezone
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `rockcliff_login_audit_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleClearLogs = async () => {
    if (window.confirm('Are you sure you want to clear all historical security access logs?')) {
      const ok = await clearSecurityAuditLogs();
      if (ok) {
        setPage(1);
        setRefreshTrigger(prev => prev + 1);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-50 text-rose-800 border border-rose-200">
              🛡️ Admin Security Portal
            </span>
            <span className="text-xs text-slate-400 font-mono">Live Telemetry</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Security Access & Login Audit Trail
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time IP tracking, device telemetry, and access verification for all resident and admin logins.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={!data || data.items.length === 0}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all flex items-center space-x-1.5 disabled:opacity-40"
          >
            <span>📥</span>
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={handleClearLogs}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-all"
          >
            <span>🗑️</span>
            <span>Clear Logs</span>
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white"
            >
              Close
            </button>
          )}
        </div>
      </div>

      {/* Security Telemetry Stats Strip */}
      {data?.stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Total Logins Tracked</span>
            <p className="text-2xl font-black text-slate-900 font-mono mt-1">{data.stats.totalLogins}</p>
            <span className="text-[10px] text-slate-400">All historical sessions</span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-rose-200 bg-rose-50/30 shadow-2xs">
            <span className="text-[10px] uppercase font-bold text-rose-700 block">Failed Login Attempts</span>
            <p className="text-2xl font-black text-rose-600 font-mono mt-1">{data.stats.failedAttempts}</p>
            <span className="text-[10px] text-rose-600 font-bold">Invalid credentials</span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-blue-200 bg-blue-50/30 shadow-2xs">
            <span className="text-[10px] uppercase font-bold text-blue-700 block">Unique Visitor IPs</span>
            <p className="text-2xl font-black text-blue-700 font-mono mt-1">{data.stats.uniqueIps}</p>
            <span className="text-[10px] text-blue-600 font-bold">Distinct network endpoints</span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-purple-200 bg-purple-50/30 shadow-2xs">
            <span className="text-[10px] uppercase font-bold text-purple-700 block">Mobile Devices</span>
            <p className="text-2xl font-black text-purple-700 font-mono mt-1">{data.stats.mobilePercent}%</p>
            <span className="text-[10px] text-purple-600 font-bold">Smartphones / Tablets</span>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search size={15} className="absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by Flat #, IP address, device..."
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 bg-slate-50 focus:outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="SUCCESS">✓ Successful Logins</option>
            <option value="FAILED">✕ Failed Attempts</option>
          </select>

          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 bg-slate-50 focus:outline-none"
          >
            <option value="all">All Roles</option>
            <option value="user">Residents (Flats)</option>
            <option value="admin">Administrators</option>
            <option value="watchman">Watchmen</option>
          </select>

          {/* Rows Per Page (Server-Side Pagination) */}
          <div className="flex items-center space-x-1 pl-2 border-l border-slate-200">
            <span className="text-[11px] font-bold text-slate-500">Rows:</span>
            <select
              value={limit}
              onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
              className="px-2 py-1.5 rounded-lg border border-slate-300 text-xs font-bold text-slate-800 bg-white focus:outline-none"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>
      </div>

      {/* Paginated Telemetry Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 text-slate-700 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200">
                <th className="py-3 px-4">Time (IST)</th>
                <th className="py-3 px-4">User / Flat</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4">Client IP Address</th>
                <th className="py-3 px-4">Device & OS</th>
                <th className="py-3 px-4">Browser</th>
                <th className="py-3 px-4">Screen / Viewport</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <span className="animate-spin inline-block mr-2">⏳</span> Loading server audit logs...
                  </td>
                </tr>
              ) : !data || data.items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No login records match your filter criteria.
                  </td>
                </tr>
              ) : (
                data.items.map(log => {
                  const dateObj = new Date(log.timestamp);
                  const formattedTime = dateObj.toLocaleString('en-IN', {
                    timeZone: 'Asia/Kolkata',
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                  });

                  return (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Time */}
                      <td className="py-3 px-4 font-mono text-slate-700 whitespace-nowrap">
                        <span className="font-bold text-slate-900 block">{formattedTime}</span>
                        <span className="text-[10px] text-slate-400 block">{log.timezone}</span>
                      </td>

                      {/* Identity */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <span className={`w-2 h-2 rounded-full ${
                            log.role === 'admin' ? 'bg-blue-600' : log.role === 'watchman' ? 'bg-purple-600' : 'bg-emerald-500'
                          }`}></span>
                          <span className="font-bold text-slate-900">
                            {log.role === 'user' ? `Flat ${log.flatNumber}` : log.username}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 uppercase font-semibold block mt-0.5">
                          {log.role}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black tracking-wider uppercase inline-flex items-center space-x-1 ${
                          log.status === 'SUCCESS'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-rose-100 text-rose-800 border border-rose-200'
                        }`}>
                          <span>{log.status === 'SUCCESS' ? '✓' : '✕'}</span>
                          <span>{log.status}</span>
                        </span>
                        {log.reason && (
                          <span className="text-[10px] text-rose-600 block mt-0.5 truncate max-w-[120px]">
                            {log.reason}
                          </span>
                        )}
                      </td>

                      {/* IP Address */}
                      <td className="py-3 px-4 font-mono font-bold text-slate-800 whitespace-nowrap">
                        <div className="flex items-center space-x-1.5">
                          <span>{log.ip}</span>
                          {log.isProxyOrCloudflare && (
                            <span className="text-[9px] bg-orange-100 text-orange-800 font-bold px-1.5 py-0.2 rounded">CF</span>
                          )}
                        </div>
                      </td>

                      {/* Device & OS */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="font-bold text-slate-900 block">{log.device}</span>
                        <span className="text-[10px] text-slate-500 block">{log.os}</span>
                      </td>

                      {/* Browser */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="font-semibold text-slate-800 block">{log.browser}</span>
                        <span className="text-[10px] text-slate-400 block truncate max-w-[140px]" title={log.userAgent}>
                          {log.userAgent}
                        </span>
                      </td>

                      {/* Screen Resolution */}
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                        <span>{log.screenResolution}</span>
                        <span className="text-[10px] text-slate-400 block">Viewport: {log.viewport}</span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Server-Side Pagination Bar */}
        {data && data.total > 0 && (
          <div className="p-4 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <span className="text-slate-500 font-medium">
              Showing <strong className="text-slate-900">{(page - 1) * limit + 1}</strong> to{' '}
              <strong className="text-slate-900">{Math.min(page * limit, data.total)}</strong> of{' '}
              <strong className="text-slate-900">{data.total}</strong> log entries
            </span>

            <div className="flex items-center space-x-1">
              <button
                type="button"
                onClick={() => setPage(1)}
                disabled={page <= 1}
                className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 font-bold"
              >
                « First
              </button>
              <button
                type="button"
                onClick={() => setPage(prev => Math.max(1, prev - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 font-bold"
              >
                ← Prev
              </button>

              <span className="px-3 py-1.5 font-bold text-slate-800 bg-white border border-slate-300 rounded-lg">
                Page {page} of {data.totalPages}
              </span>

              <button
                type="button"
                onClick={() => setPage(prev => Math.min(data.totalPages, prev + 1))}
                disabled={page >= data.totalPages}
                className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 font-bold"
              >
                Next →
              </button>
              <button
                type="button"
                onClick={() => setPage(data.totalPages)}
                disabled={page >= data.totalPages}
                className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 font-bold"
              >
                Last »
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
