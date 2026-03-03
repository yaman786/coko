import React, { useState, useRef, useEffect } from 'react';
import type { LucideIcon } from 'lucide-react';

interface DropdownItem {
    label: string;
    icon?: LucideIcon;
    onClick: () => void;
    className?: string; // e.g., for danger actions
}

interface DropdownMenuProps {
    buttonContent: React.ReactNode;
    items: DropdownItem[];
    buttonClassName?: string;
}

export function DropdownMenu({ buttonContent, items, buttonClassName = '' }: DropdownMenuProps) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    return (
        <div className="relative inline-block text-left z-20" ref={dropdownRef}>
            <div>
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className={`inline-flex w-full justify-center items-center gap-x-1.5 rounded-md px-3 py-2 text-sm font-semibold shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 transition-colors ${buttonClassName}`}
                >
                    {buttonContent}
                </button>
            </div>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-48 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none animate-in fade-in zoom-in-95 duration-100 ease-out">
                    <div className="py-1" role="menu" aria-orientation="vertical">
                        {items.map((item, index) => {
                            const Icon = item.icon;
                            return (
                                <button
                                    key={index}
                                    onClick={() => {
                                        item.onClick();
                                        setIsOpen(false);
                                    }}
                                    className={`group flex w-full items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors ${item.className || ''}`}
                                    role="menuitem"
                                >
                                    {Icon && (
                                        <Icon
                                            className="mr-3 h-4 w-4 text-gray-400 group-hover:text-gray-500"
                                            aria-hidden="true"
                                        />
                                    )}
                                    {item.label}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
