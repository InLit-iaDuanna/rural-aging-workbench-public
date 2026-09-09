'use client';
import { useState } from 'react';
import Workspace from './workspace';
import V2Workspace from './v2-workspace';
import VillageJourney from './v2-journey';
export default function Page() {
  const [mode, setMode] = useState('journey');
  return mode === 'journey' ? (
    <VillageJourney onAdvanced={() => setMode('advanced')} />
  ) : (
    <>
      <button
        style={{
          position: 'fixed',
          bottom: 18,
          right: 18,
          zIndex: 100,
          padding: '8px 14px',
          background: '#235943',
          color: 'white',
          borderRadius: 8,
        }}
        onClick={() => setMode('journey')}
      >
        返回体验流程
      </button>
      {mode === 'legacy' ? (
        <Workspace />
      ) : (
        <V2Workspace onLegacy={() => setMode('legacy')} />
      )}
    </>
  );
}
