import React from 'react';

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
}

const Tooltip: React.FC<TooltipProps> = ({ content, children }) => {
  return (
    <div className="relative flex items-center group">
      {children}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-xs bg-gray-800 text-white text-sm rounded-md shadow-lg p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-50 pointer-events-none">
        {content}
      </div>
    </div>
  );
};

export default Tooltip;
