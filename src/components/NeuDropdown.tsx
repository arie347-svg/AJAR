import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface NeuDropdownOption {
  value: string;
  label: string;
}

interface NeuDropdownProps {
  value: string;
  onChange: (val: string) => void;
  options: NeuDropdownOption[];
  placeholder?: string;
  icon?: React.ReactNode;
  className?: string;
  menuMaxHeight?: string;
}

export const NeuDropdown: React.FC<NeuDropdownProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Pilih opsi...',
  icon,
  className = '',
  menuMaxHeight = 'max-h-56',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const selectedOption = options.find(opt => opt.value === value);

  return (
    <div ref={dropdownRef} className={`relative select-none ${className}`}>
      {/* Trigger Button: Neumorphic Inset / Soft pill */}
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`w-full neu-input-container rounded-2xl flex items-center justify-between px-3 py-2.5 text-left cursor-pointer transition-all ${
          isOpen ? 'ring-2 ring-[#2167F3]/40 border-[#2167F3]/30 bg-[#f1f6fd]' : ''
        }`}
      >
        <div className="flex items-center gap-2 min-w-0 pr-2">
          {icon && <span className="shrink-0 text-slate-400">{icon}</span>}
          <span
            className={`truncate text-xs font-semibold ${
              selectedOption?.value ? 'text-slate-800' : 'text-slate-500'
            }`}
          >
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-[#2167F3]' : ''
          }`}
        />
      </button>

      {/* Floating Popover List: Full Neumorphic / Soft UI Card */}
      {isOpen && (
        <div
          role="listbox"
          className={`absolute left-0 right-0 mt-2 z-50 rounded-2xl bg-[#edf3fb] border border-white/80 overflow-hidden shadow-[12px_14px_28px_rgba(160,178,204,0.45),-10px_-10px_24px_rgba(255,255,255,0.95)] animate-in fade-in zoom-in-95 duration-150`}
        >
          <div
            className={`p-1.5 overflow-y-auto ${menuMaxHeight} space-y-1 focus:outline-none`}
            style={{
              scrollbarWidth: 'thin',
              scrollbarColor: '#c5d3e5 transparent',
            }}
          >
            {options.length === 0 ? (
              <div className="px-3 py-2 text-center text-xs text-slate-400">
                Tidak ada pilihan
              </div>
            ) : (
              options.map(option => {
                const isSelected = option.value === value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      onChange(option.value);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all duration-150 text-left ${
                      isSelected
                        ? 'bg-[#2167F3] text-white shadow-[0_4px_12px_rgba(33,103,243,0.35)]'
                        : 'text-slate-700 hover:bg-[#e2ecf9] hover:text-slate-900 active:scale-[0.98]'
                    }`}
                  >
                    <span className="truncate pr-2">{option.label}</span>
                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-white shrink-0 stroke-[2.5]" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
