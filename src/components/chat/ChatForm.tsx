import { useState } from 'react';
import { Send } from 'lucide-react';
import type { FormRequest } from '../../hooks/useChat';

interface ChatFormProps {
  form: FormRequest;
  onSubmit: (message: string) => void;
  disabled?: boolean;
}

interface FieldDef {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'textarea' | 'boolean';
  options?: string[];
  placeholder?: string;
}

const TABLE_FIELDS: Record<string, FieldDef[]> = {
  guests: [
    { key: 'full_name', label: 'Full Name', type: 'text', placeholder: 'John Smith' },
    { key: 'email', label: 'Email', type: 'text', placeholder: 'john@example.com' },
    { key: 'phone', label: 'Phone', type: 'text', placeholder: '(303) 555-0100' },
    { key: 'side', label: 'Side', type: 'select', options: ['partner1', 'partner2', 'mutual'] },
    { key: 'group_name', label: 'Group', type: 'text', placeholder: 'Family, Work, College Friends...' },
    { key: 'rsvp_status', label: 'RSVP Status', type: 'select', options: ['pending', 'accepted', 'declined'] },
    { key: 'has_plus_one', label: 'Plus One', type: 'boolean' },
    { key: 'plus_one_name', label: 'Plus One Name', type: 'text', placeholder: 'Jane Smith' },
    { key: 'dietary_restrictions', label: 'Dietary Restrictions', type: 'text', placeholder: 'vegetarian, gluten-free...' },
    { key: 'address', label: 'Address', type: 'text', placeholder: '123 Main St, Denver, CO' },
  ],
  venues: [
    { key: 'name', label: 'Venue Name', type: 'text', placeholder: 'The Garden Estate' },
    { key: 'address', label: 'Address', type: 'text', placeholder: '123 Main St, Denver, CO' },
    { key: 'capacity', label: 'Capacity', type: 'number', placeholder: '200' },
    { key: 'cost', label: 'Cost', type: 'number', placeholder: '10000' },
    { key: 'contact_name', label: 'Contact Name', type: 'text' },
    { key: 'contact_email', label: 'Contact Email', type: 'text' },
    { key: 'contact_phone', label: 'Contact Phone', type: 'text' },
    { key: 'website_url', label: 'Website', type: 'text', placeholder: 'https://...' },
    { key: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Style, amenities, highlights...' },
  ],
  budget_expenses: [
    { key: 'category', label: 'Category', type: 'text', placeholder: 'Venue, Catering, Photography...' },
    { key: 'description', label: 'Description', type: 'text', placeholder: 'Deposit payment' },
    { key: 'estimated_cost', label: 'Estimated Cost', type: 'number', placeholder: '5000' },
    { key: 'actual_cost', label: 'Actual Cost', type: 'number', placeholder: '4800' },
    { key: 'vendor_name', label: 'Vendor', type: 'text', placeholder: 'Vendor name' },
    { key: 'is_paid', label: 'Paid', type: 'boolean' },
    { key: 'due_date', label: 'Due Date', type: 'text', placeholder: 'YYYY-MM-DD' },
  ],
  checklist_items: [
    { key: 'title', label: 'Task', type: 'text', placeholder: 'Book florist' },
    { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Details...' },
    { key: 'time_period', label: 'Time Period', type: 'text', placeholder: '6-8 months before' },
    { key: 'due_date', label: 'Due Date', type: 'text', placeholder: 'YYYY-MM-DD' },
    { key: 'is_completed', label: 'Completed', type: 'boolean' },
  ],
  seating_tables: [
    { key: 'name', label: 'Table Name', type: 'text', placeholder: 'Table 1' },
    { key: 'shape', label: 'Shape', type: 'select', options: ['round', 'rectangular'] },
    { key: 'capacity', label: 'Capacity', type: 'number', placeholder: '8' },
  ],
  budget_categories: [
    { key: 'name', label: 'Category Name', type: 'text', placeholder: 'Transportation' },
    { key: 'allocated_amount', label: 'Allocated Amount', type: 'number', placeholder: '1000' },
  ],
};

const TABLE_LABELS: Record<string, string> = {
  guests: 'Guest',
  venues: 'Venue',
  budget_expenses: 'Expense',
  budget_categories: 'Budget Category',
  checklist_items: 'Checklist Item',
  seating_tables: 'Seating Table',
};

export function ChatForm({ form, onSubmit, disabled }: ChatFormProps) {
  const fields = TABLE_FIELDS[form.table] ?? [];
  const label = TABLE_LABELS[form.table] ?? form.table;
  const [values, setValues] = useState<Record<string, string | boolean>>(() => {
    const init: Record<string, string | boolean> = {};
    for (const f of fields) {
      const prefilled = form.prefill?.[f.key];
      if (f.type === 'boolean') {
        init[f.key] = prefilled === true || prefilled === 'true' || false;
      } else {
        init[f.key] = prefilled != null ? String(prefilled) : '';
      }
    }
    return init;
  });

  const handleSubmit = () => {
    // Build a structured data object for the agent
    const record: Record<string, unknown> = {};
    for (const f of fields) {
      const val = values[f.key];
      if (val === '' || val === false) continue;
      if (f.type === 'number') {
        record[f.key] = Number(val);
      } else if (f.type === 'boolean') {
        record[f.key] = true;
      } else {
        record[f.key] = val;
      }
    }

    const verb = form.action === 'create' ? 'Create' : 'Update';
    const msg = `${verb} a ${label.toLowerCase()} in the ${form.table} table with this data: ${JSON.stringify(record)}`;
    onSubmit(msg);
  };

  const setValue = (key: string, val: string | boolean) => {
    setValues(prev => ({ ...prev, [key]: val }));
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
      <h4 className="text-sm font-semibold text-gray-700">
        {form.action === 'create' ? 'New' : 'Edit'} {label}
      </h4>

      <div className="space-y-2">
        {fields.map(f => (
          <div key={f.key}>
            {f.type === 'boolean' ? (
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={values[f.key] === true}
                  onChange={e => setValue(f.key, e.target.checked)}
                  className="rounded border-gray-300 text-primary-500 focus:ring-primary-500"
                />
                {f.label}
              </label>
            ) : f.type === 'select' ? (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-0.5">{f.label}</label>
                <select
                  value={values[f.key] as string}
                  onChange={e => setValue(f.key, e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="">Select...</option>
                  {f.options?.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            ) : f.type === 'textarea' ? (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-0.5">{f.label}</label>
                <textarea
                  value={values[f.key] as string}
                  onChange={e => setValue(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  rows={2}
                  className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm resize-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-0.5">{f.label}</label>
                <input
                  type={f.type === 'number' ? 'number' : 'text'}
                  value={values[f.key] as string}
                  onChange={e => setValue(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={handleSubmit}
        disabled={disabled}
        className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary-500 text-white py-2 text-sm font-medium
          hover:bg-primary-600 disabled:opacity-40 transition-colors"
      >
        <Send className="w-3.5 h-3.5" />
        {form.action === 'create' ? 'Create' : 'Update'} {label}
      </button>
    </div>
  );
}
