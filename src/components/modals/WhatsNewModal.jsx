import React from 'react';
import { Sparkles, X, CheckCircle2 } from 'lucide-react';
import { CHANGELOG_DATA } from '../../utils/changelog';

function formatChangelogItem(text) {
  if (!text) return null;
  // If text contains bold markdown **title**:
  if (text.includes('**')) {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={i} className="font-bold text-white">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return part;
    });
  }

  // If text contains a title before a colon (e.g. "العنوان: الشرح")
  const colonIndex = text.indexOf(':');
  if (colonIndex > 0 && colonIndex < 45) {
    const title = text.slice(0, colonIndex + 1);
    const rest = text.slice(colonIndex + 1);
    return (
      <>
        <strong className="font-bold text-white">{title}</strong>
        <span>{rest}</span>
      </>
    );
  }

  return text;
}

export default function WhatsNewModal({ isOpen, onClose, currentVersion = "1.0.15" }) {
  if (!isOpen) return null;

  const currentChangelog = CHANGELOG_DATA.find((item) => item.version === currentVersion) || CHANGELOG_DATA[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
      <div 
        className="w-full max-w-xl bg-[#121721] border border-[#222B3D] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#222B3D] bg-[#0B0E14]/70 flex items-center justify-between" dir="rtl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#CCFF00]/10 border border-[#CCFF00]/30 flex items-center justify-center text-[#CCFF00] shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="text-base font-bold font-display text-white">ما الجديد في هذا التحديث</h3>
                <span className="px-2.5 py-0.5 text-xs font-mono font-bold rounded-full bg-[#CCFF00]/15 text-[#CCFF00] border border-[#CCFF00]/30" dir="ltr">
                  v{currentChangelog.version}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 font-medium leading-relaxed">
                {currentChangelog.title} {currentChangelog.releaseDate ? `— ${currentChangelog.releaseDate}` : ''}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-[#181E2A] transition-colors cursor-pointer"
            aria-label="إغلاق"
            title="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="px-6 py-5 overflow-y-auto space-y-6 text-sm text-slate-300" dir="rtl">
          {currentChangelog.categories.map((category, idx) => (
            <div key={idx} className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#CCFF00]" />
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  {category.name}
                </h4>
              </div>
              <ul className="space-y-2.5 pr-2">
                {category.items.map((item, itemIdx) => (
                  <li key={itemIdx} className="flex items-start gap-2.5 text-xs text-slate-300 leading-relaxed">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-500 mt-1.5 shrink-0" />
                    <span className="flex-1">{formatChangelogItem(item)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#222B3D] bg-[#0B0E14]/70 flex items-center justify-between" dir="rtl">
          <p className="text-[11px] text-slate-500 font-medium">أحدث التحسينات والمميزات في Alpha Gym</p>
          <button
            onClick={onClose}
            className="px-6 py-2 text-xs font-bold text-slate-950 bg-[#CCFF00] hover:bg-[#b8e600] rounded-xl transition-all shadow-md shadow-[#CCFF00]/15 cursor-pointer"
          >
            فهمت ذلك
          </button>
        </div>
      </div>
    </div>
  );
}
