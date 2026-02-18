'use client';

import { useState } from 'react';
import MeetingNotesView from '@/components/MeetingNotesView';

export default function NotesPage() {
  const [mode, setMode] = useState<'quick' | 'meeting'>('quick');

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Notes</h1>
      </div>

      {/* Radio Toggle */}
      <div className="mb-6 flex gap-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="noteMode"
            value="quick"
            checked={mode === 'quick'}
            onChange={() => setMode('quick')}
            className="w-4 h-4"
          />
          <span className="font-medium">Quick Capture</span>
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
          <span className="font-medium">Meeting Notes</span>
        </label>
      </div>

      {/* Show appropriate component based on mode */}
      {mode === 'quick' ? (
        <div className="bg-gray-50 p-6 rounded-lg border">
          <p className="text-gray-600">Quick Capture functionality</p>
        </div>
      ) : (
        <MeetingNotesView />
      )}
    </div>
  );
}