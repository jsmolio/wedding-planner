import { useState, useRef } from 'react';
import Papa from 'papaparse';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, FileText, AlertCircle } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { createGuest } from '@/lib/queries/guests';
import { queryKeys } from '@/lib/queryKeys';
import type { GuestSide } from '@/types/database';

interface CSVImportProps {
  open: boolean;
  onClose: () => void;
  weddingId: string;
}

interface CSVRow {
  name: string;
  email: string;
  phone: string;
  address: string;
  side: string;
  group: string;
}

const EXPECTED_COLUMNS = ['name', 'email', 'phone', 'address', 'side', 'group'];

function normalizeSide(value: string): GuestSide {
  const lower = value.trim().toLowerCase();
  if (lower === 'partner1' || lower === 'partner 1') return 'partner1';
  if (lower === 'partner2' || lower === 'partner 2') return 'partner2';
  return 'mutual';
}

export function CSVImport({ open, onClose, weddingId }: CSVImportProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [rows, setRows] = useState<CSVRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const resetState = () => {
    setRows([]);
    setParseError(null);
    setFileName(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setParseError(null);
    setFileName(file.name);

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim().toLowerCase(),
      complete: (results) => {
        if (results.errors.length > 0) {
          setParseError(
            `CSV parsing error: ${results.errors[0].message} (row ${results.errors[0].row})`
          );
          setRows([]);
          return;
        }

        const headers = results.meta.fields?.map((f) => f.toLowerCase()) ?? [];
        const missingColumns = EXPECTED_COLUMNS.filter(
          (col) => col !== 'email' && col !== 'phone' && col !== 'address' && col !== 'side' && col !== 'group' && !headers.includes(col)
        );

        if (missingColumns.length > 0) {
          setParseError(
            `Missing required column(s): ${missingColumns.join(', ')}. Expected: ${EXPECTED_COLUMNS.join(', ')}`
          );
          setRows([]);
          return;
        }

        const parsed: CSVRow[] = results.data.map((row) => ({
          name: row['name'] ?? '',
          email: row['email'] ?? '',
          phone: row['phone'] ?? '',
          address: row['address'] ?? '',
          side: row['side'] ?? '',
          group: row['group'] ?? '',
        }));

        const validRows = parsed.filter((r) => r.name.trim() !== '');
        if (validRows.length === 0) {
          setParseError('No valid rows found. Each row must have a name.');
          setRows([]);
          return;
        }

        setRows(validRows);
      },
      error: (err) => {
        setParseError(`Failed to read file: ${err.message}`);
        setRows([]);
      },
    });
  };

  const importMutation = useMutation({
    mutationFn: async () => {
      const results = [];
      for (const row of rows) {
        const result = await createGuest({
          wedding_id: weddingId,
          full_name: row.name.trim(),
          email: row.email.trim(),
          phone: row.phone.trim(),
          address: row.address.trim(),
          side: normalizeSide(row.side),
          group_name: row.group.trim(),
        });
        results.push(result);
      }
      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.guests(weddingId) });
      handleClose();
    },
  });

  return (
    <Modal open={open} onClose={handleClose} title="Import Guests from CSV" size="xl">
      <div className="space-y-4">
        {/* Instructions */}
        <div className="rounded-lg bg-blue-50 p-4 text-sm text-blue-800">
          <p className="font-medium mb-1">Expected CSV columns:</p>
          <code className="text-xs bg-blue-100 px-2 py-1 rounded">
            {EXPECTED_COLUMNS.join(', ')}
          </code>
          <p className="mt-2 text-blue-700">
            Only <strong>name</strong> is required. Side values: partner1, partner2, or mutual.
          </p>
        </div>

        {/* File Upload */}
        <div
          className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center
            hover:border-primary-400 transition-colors cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleFileChange}
          />
          {fileName ? (
            <div className="flex items-center justify-center gap-2 text-gray-700">
              <FileText className="w-5 h-5" />
              <span className="font-medium">{fileName}</span>
              <span className="text-gray-500">({rows.length} guests)</span>
            </div>
          ) : (
            <div className="space-y-2">
              <Upload className="w-8 h-8 mx-auto text-gray-400" />
              <p className="text-sm text-gray-600">
                Click to upload or drag and drop a CSV file
              </p>
            </div>
          )}
        </div>

        {/* Parse Error */}
        {parseError && (
          <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{parseError}</span>
          </div>
        )}

        {/* Preview Table */}
        {rows.length > 0 && (
          <div className="border rounded-lg overflow-hidden">
            <div className="overflow-x-auto max-h-64 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">#</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Name</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Email</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Phone</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Side</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-700">Group</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-gray-500">{i + 1}</td>
                      <td className="px-3 py-2 font-medium text-gray-900">{row.name}</td>
                      <td className="px-3 py-2 text-gray-600">{row.email || '--'}</td>
                      <td className="px-3 py-2 text-gray-600">{row.phone || '--'}</td>
                      <td className="px-3 py-2 text-gray-600">{row.side || 'mutual'}</td>
                      <td className="px-3 py-2 text-gray-600">{row.group || '--'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Import Error */}
        {importMutation.error && (
          <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>
              {importMutation.error instanceof Error
                ? importMutation.error.message
                : 'Failed to import guests. Please try again.'}
            </span>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={() => importMutation.mutate()}
            disabled={rows.length === 0}
            loading={importMutation.isPending}
          >
            Import {rows.length} {rows.length === 1 ? 'Guest' : 'Guests'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
