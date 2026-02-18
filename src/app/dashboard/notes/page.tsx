'use client';

import { useState } from 'react';
import MeetingNotesView from '@/components/MeetingNotesView';

export default function NotesPage() {
  const [mode, setMode] = useState<'quick' | 'meeting'>('quick');

  return (
    <div className="container mx-auto py-6">
      <h2 className="text-2xl font-bold mb-4">Notes</h2>

      {/* Radio Toggle */}
      <div className="mb-6 flex gap-6 border-b pb-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="noteMode"
            value="quick"
            checked={mode === 'quick'}
            onChange={() => setMode('quick')}
            className="w-4 h-4"
          />
          <span className="font-medium text-lg">Quick Capture</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="noteMode"
            value="meeting"
            checked={mode === 'meeting'}
            onChange={() => setMode('meeting')}
            className="w-4 h-4"
          />
          <span className="font-medium text-lg">Meeting Notes</span>
        </label>
      </div>

      {/* Show content based on mode */}
      {mode === 'quick' ? (
        <div className="bg-gray-50 p-6 rounded-lg border">
          <p className="text-gray-600">Quick Capture functionality will be integrated here</p>
          <p className="text-sm text-gray-500 mt-2">This preserves the original quick note entry for future integration</p>
        </div>
      ) : (
        <MeetingNotesView />
      )}
    </div>
  );
}