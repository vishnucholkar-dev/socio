import React, { useState } from 'react';
import { DirectoryContact, UserRole } from '../types/apartment';
import { Phone, Copy, Plus, Search, CheckCircle2, Wrench, Zap, Droplet, Shield, Building } from './Icons';

interface DirectoryModuleProps {
  currentRole: UserRole;
  contacts: DirectoryContact[];
  onSaveContact: (contact: DirectoryContact) => void;
  onDeleteContact: (id: string) => void;
}

const CATEGORY_ICONS: { [cat: string]: React.ReactNode } = {
  Plumber: <Wrench size={16} className="text-blue-600" />,
  Electrician: <Zap size={16} className="text-amber-500" />,
  'Water Tanker': <Droplet size={16} className="text-cyan-500" />,
  'Elevator / Lift': <Building size={16} className="text-indigo-600" />,
  'Security & Watchman': <Shield size={16} className="text-purple-600" />,
  Sanitation: <Building size={16} className="text-emerald-600" />,
  'Borewell & Motors': <Wrench size={16} className="text-orange-600" />,
  Committee: <Shield size={16} className="text-blue-800" />,
  Other: <Phone size={16} className="text-slate-500" />
};

export const DirectoryModule: React.FC<DirectoryModuleProps> = ({
  currentRole,
  contacts,
  onSaveContact,
  onDeleteContact
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modal State
  const [editingContact, setEditingContact] = useState<DirectoryContact | null>(null);
  const [isNew, setIsNew] = useState(false);

  const categories = [
    'all',
    'Plumber',
    'Electrician',
    'Security & Watchman',
    'Water Tanker',
    'Elevator / Lift',
    'Borewell & Motors',
    'Sanitation',
    'Committee'
  ];

  const filteredContacts = contacts.filter(c => {
    if (selectedCategory !== 'all' && c.category !== selectedCategory) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        (c.notes && c.notes.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const handleCopy = (id: string, phone: string) => {
    navigator.clipboard.writeText(phone.replace(/\s+/g, ''));
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleOpenAdd = () => {
    setEditingContact({
      id: '',
      category: 'Plumber',
      name: '',
      phone: '',
      notes: '',
      available_hours: '8:00 AM - 8:00 PM'
    });
    setIsNew(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingContact || !editingContact.name || !editingContact.phone) return;
    onSaveContact(editingContact);
    setEditingContact(null);
  };

  return (
    <div className="space-y-6">
      {/* Header & Quick Action */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 no-print">
        <div className="flex items-center space-x-3">
          <span className="p-2.5 bg-blue-100 text-blue-700 rounded-xl">
            <Phone size={22} />
          </span>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Apartment Emergency & Service Directory</h2>
            <p className="text-xs text-slate-500">
              Verified phone numbers for Plumber, Electrician, Watchman Laxman, Tankers & Lift AMC
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
          <div className="relative flex-1 sm:flex-initial">
            <input
              type="text"
              placeholder="Search contact or service..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-slate-100 text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-48"
            />
            <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
          </div>

          {currentRole === 'admin' && (
            <button
              onClick={handleOpenAdd}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all whitespace-nowrap"
            >
              <Plus size={15} />
              <span>Add Contact</span>
            </button>
          )}
        </div>
      </div>

      {/* Category Pills (Mobile Scrollable) */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none no-print">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              selectedCategory === cat
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            {cat === 'all' ? 'All Services' : cat}
          </button>
        ))}
      </div>

      {/* Contact Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredContacts.map(c => (
          <div
            key={c.id}
            className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
          >
            <div>
              {/* Category Pill & Action */}
              <div className="flex items-center justify-between mb-2">
                <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                  {CATEGORY_ICONS[c.category] || <Phone size={13} />}
                  <span>{c.category}</span>
                </span>

                {c.available_hours && (
                  <span className="text-[10px] text-slate-400 font-medium">
                    {c.available_hours}
                  </span>
                )}
              </div>

              {/* Contact Name & Details */}
              <h3 className="text-base font-bold text-slate-900 mt-1">{c.name}</h3>

              {c.notes && (
                <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                  {c.notes}
                </p>
              )}

              {/* Main Phone Display */}
              <div className="mt-3 py-2 px-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Phone Number</span>
                  <span className="text-sm font-black font-mono text-slate-900 tracking-wide">{c.phone}</span>
                </div>
                {c.alternate_phone && (
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Alt</span>
                    <span className="text-xs font-mono text-slate-600">{c.alternate_phone}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Mobile-Friendly Action Buttons */}
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2">
              <a
                href={`tel:${c.phone.replace(/[^0-9+]/g, '')}`}
                className="flex-1 flex items-center justify-center space-x-1.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
              >
                <Phone size={15} />
                <span>Call Now</span>
              </a>

              <button
                onClick={() => handleCopy(c.id, c.phone)}
                className={`flex items-center justify-center space-x-1 px-3 py-2.5 border rounded-xl text-xs font-semibold transition-all ${
                  copiedId === c.id
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {copiedId === c.id ? <CheckCircle2 size={15} /> : <Copy size={15} />}
                <span>{copiedId === c.id ? 'Copied' : 'Copy'}</span>
              </button>

              {currentRole === 'admin' && (
                <button
                  onClick={() => {
                    setEditingContact(c);
                    setIsNew(false);
                  }}
                  className="px-2.5 py-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors text-xs font-semibold"
                >
                  Edit
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add / Edit Contact Modal */}
      {editingContact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900">
              {isNew ? 'Add Helpful Contact' : 'Edit Service Contact'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Keep essential service providers and emergency contacts easily accessible
            </p>

            <form onSubmit={handleSave} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Service Category</label>
                <select
                  value={editingContact.category}
                  onChange={(e) => setEditingContact({ ...editingContact, category: e.target.value as any })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  {categories.filter(c => c !== 'all').map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Name / Agency</label>
                <input
                  type="text"
                  placeholder="e.g. Suresh Plumber, Sri Sai Water Tankers"
                  value={editingContact.name}
                  onChange={(e) => setEditingContact({ ...editingContact, name: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Primary Phone</label>
                  <input
                    type="text"
                    placeholder="e.g. +91 90000 00000"
                    value={editingContact.phone}
                    onChange={(e) => setEditingContact({ ...editingContact, phone: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Alternate Phone</label>
                  <input
                    type="text"
                    placeholder="Optional"
                    value={editingContact.alternate_phone || ''}
                    onChange={(e) => setEditingContact({ ...editingContact, alternate_phone: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Service Hours / Availability</label>
                <input
                  type="text"
                  placeholder="e.g. 8:00 AM - 8:00 PM, 24x7 Emergency"
                  value={editingContact.available_hours || ''}
                  onChange={(e) => setEditingContact({ ...editingContact, available_hours: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Notes / Services Provided</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Handles PVC pipe joints, sump valve leakage"
                  value={editingContact.notes || ''}
                  onChange={(e) => setEditingContact({ ...editingContact, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-between">
                {!isNew && (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('Delete this contact?')) {
                        onDeleteContact(editingContact.id);
                        setEditingContact(null);
                      }
                    }}
                    className="text-xs font-semibold text-rose-600 hover:text-rose-800"
                  >
                    Delete Contact
                  </button>
                )}

                <div className="flex items-center space-x-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => setEditingContact(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm"
                  >
                    Save Contact
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
