import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface NeuSelectOption {
  value: string;
  label: string;
}

interface NeuSelectProps {
  value: string;
  onChange: (val: string) => void;
  options: NeuSelectOption[];
  placeholder?: string;
  icon?: React.ReactNode;
  className?: string;
  menuPlacement?: 'bottom' | 'top';
}

export const NeuSelect: React.FC<NeuSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = '-- Pilih --',
  icon,
  className = '',
  menuPlacement = 'bottom',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(opt => opt.value === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Trigger Button - Recessed Neumorphic Inset */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`neu-input-container w-full rounded-2xl flex items-center justify-between px-3.5 py-2.5 gap-2 cursor-pointer transition-all text-left outline-none ${
          isOpen ? 'ring-2 ring-blue-500/30' : ''
        }`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {icon && <span className="shrink-0">{icon}</span>}
          <span className="text-xs sm:text-sm font-semibold text-slate-800 truncate">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-blue-600' : ''
          }`}
        />
      </button>

      {/* Dropdown Menu Popup - Floating Elevated Neumorphic Bevel Plinth */}
      {isOpen && (
        <div
          className={`absolute left-0 right-0 z-50 bg-[#EAF0F9] border border-white/80 rounded-2xl shadow-[12px_16px_32px_rgba(153,174,206,0.48),-8px_-8px_20px_rgba(255,255,255,0.95)] p-1.5 max-h-56 overflow-y-auto no-scrollbar overscroll-none transition-all duration-200 animate-in fade-in zoom-in-95 ${
            menuPlacement === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'
          }`}
        >
          {options.map((option, idx) => {
            const isSelected = option.value === value;
            return (
              <button
                key={`${option.value}-${idx}`}
                type="button"
                onClick={() => handleSelect(option.value)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer text-left mb-0.5 last:mb-0 ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                    : 'text-slate-700 hover:bg-white/80 hover:text-blue-600 active:scale-[0.98]'
                }`}
              >
                <span className="truncate">{option.label}</span>
                {isSelected && <Check className="w-3.5 h-3.5 shrink-0 stroke-[2.5]" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
