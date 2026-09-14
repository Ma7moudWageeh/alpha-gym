import React from 'react';
import { CHANGELOG_DATA } from '../../data/changelog';

export default function WhatsNewModal({ isOpen, onClose, currentVersion = "1.0.10" }) {
  if (!isOpen) return null;

  const currentChangelog = CHANGELOG_DATA.find((item) => item.version === currentVersion) || CHANGELOG_DATA[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in">
      <div 
        className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-slate-100">What's New in Alpha Gym</h3>
              <span className="px-2 py-0.5 text-xs font-mono font-medium rounded bg-slate-800 text-slate-300 border border-slate-700">
                v{currentChangelog.version}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">{currentChangelog.title} — {currentChangelog.releaseDate}</p>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 transition-colors p-1"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content Body */}
        <div className="px-6 py-5 overflow-y-auto space-y-6 text-sm text-slate-300">
          {currentChangelog.categories.map((category, idx) => (
            <div key={idx} className="space-y-2.5">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                {category.name}
              </h4>
              <ul className="space-y-2 pl-1">
                {category.items.map((item, itemIdx) => (
                  <li key={itemIdx} className="flex items-start gap-2.5 text-xs text-slate-300 leading-relaxed">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-500 mt-1.5 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
