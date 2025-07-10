
import React from 'react';

const BrainCircuitIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M12 2a3 3 0 0 0-3 3v2a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
    <path d="M12 2a3 3 0 0 1 3 3v2a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3Z" />
    <path d="M12 13h.01" />
    <path d="M15 9.5a2.5 2.5 0 0 1 0 5h-6a2.5 2.5 0 0 1 0-5h6Z" />
    <path d="M15 9.5a2.5 2.5 0 0 0 0-5h-6a2.5 2.5 0 0 0 0 5h6Z" />
    <path d="M6.5 16a2.5 2.5 0 0 1 0-5" />
    <path d="M17.5 16a2.5 2.5 0 0 0 0-5" />
    <path d="M12 22a3 3 0 0 0 3-3v-2a3 3 0 0 0-6 0v2a3 3 0 0 0 3 3Z" />
  </svg>
);

export default BrainCircuitIcon;
