'use client';

import { useState } from 'react';
import QuickCaptureView from '@/components/QuickCaptureView';
import MeetingNotesView from '@/components/MeetingNotesView';

export default function NotesPage() {
  const [mode, setMode] = useState<'quick' | 'meeting'>('quick');

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Notes</h2>

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

      {mode === 'quick' ? <QuickCaptureView /> : <MeetingNotesView />}
    </div>
  );
}