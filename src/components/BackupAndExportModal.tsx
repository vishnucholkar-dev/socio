import React, { useState } from 'react';
import { ApartmentData } from '../types/apartment';
import { exportApartmentDataBackup, importApartmentDataBackup } from '../services/storage';
import { exportAnnualExcelClient } from '../services/excelExport';

interface BackupAndExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: ApartmentData;
  onDataImported: (updated: ApartmentData) => void;
}

export const BackupAndExportModal: React.FC<BackupAndExportModalProps> = ({
  isOpen,
  onClose,
  data,
  onDataImported
}) => {
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleJsonExport = () => {
    const jsonStr = exportApartmentDataBackup();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rockcliff-society-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExcelExport = () => {
    exportAnnualExcelClient(data, selectedYear);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center space-x-2.5">
            <span className="p-2.5 rounded-2xl bg-emerald-100 text-emerald-800 text-lg font-bold">💾</span>
            <div>
              <h2 className="text-lg font-black text-slate-900">Backup, Restore & Excel Exports</h2>
              <p className="text-xs text-slate-500">Cross-browser backups and multi-sheet annual Excel exports</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-xl font-bold"
          >
            ✕
          </button>
        </div>

        <div className="mt-6 space-y-6">
          {/* Section 1: Multi-Sheet Annual Excel Export */}
          <div className="p-5 rounded-2xl bg-emerald-50/50 border border-emerald-200">
            <div className="flex items-center space-x-1.5 mb-2">
              <span className="text-base">📊</span>
              <h3 className="text-xs font-bold text-emerald-950 uppercase tracking-wider">
                Annual Multi-Sheet Excel Export (.xlsx)
              </h3>
            </div>
            <p className="text-xs text-slate-600 mb-3">
              Export complete annual records for the chosen year with distinct sheets for:
              <br />
              • <strong>Expenses & Inflows</strong> (itemized outflows, categories, and payment channels)
              <br />
              • <strong>Water & Flat Collections</strong> (meter readings, consumed liters, and payment status)
              <br />
              • <strong>Monthly Financial Summaries</strong> (opening balances, collections, and closing funds)
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <div className="flex items-center space-x-2">
                <label className="text-xs font-bold text-slate-700">Select Year:</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                >
                  <option value={2026}>Year 2026</option>
                  <option value={2025}>Year 2025</option>
                  <option value={2024}>Year 2024</option>
                </select>
              </div>

              <button
                type="button"
                onClick={handleExcelExport}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md flex items-center space-x-1.5 transition-all active:scale-95"
              >
                <span>📊</span>
                <span>Download Annual Excel Workbook</span>
              </button>
            </div>
          </div>

          {/* Section 2: Cross-Browser JSON Backup & Migration */}
          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200">
            <div className="flex items-center space-x-1.5 mb-2">
              <span className="text-base">📦</span>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Cross-Browser Backup & Restore (JSON)
              </h3>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              Export your society data to seamlessly migrate receipts, open cycles, and expenses across Chrome, Edge, and other devices.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleJsonExport}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl transition-all shadow-xs"
              >
                ⬇️ Export Backup (JSON)
              </button>

              <label className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-xl transition-all cursor-pointer border border-blue-200 shadow-xs">
                <span>⬆️ Import Backup (JSON)</span>
                <input
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (event) => {
                      const content = event.target?.result as string;
                      if (content) {
                        try {
                          const updated = importApartmentDataBackup(content);
                          onDataImported(updated);
                          setImportStatus('Backup restored successfully! All data updated.');
                          setTimeout(() => {
                            setImportStatus(null);
                            onClose();
                          }, 1500);
                        } catch (err) {
                          setImportStatus(err instanceof Error ? err.message : 'Import failed.');
                        }
                      }
                    };
                    reader.readAsText(file);
                  }}
                />
              </label>

              {importStatus && (
                <span className={`text-xs font-bold px-3 py-1 rounded-lg ${
                  importStatus.includes('successfully') ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'
                }`}>
                  {importStatus}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
