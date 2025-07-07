import React from 'react';

const HandThumbDownIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    {...props}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M10.05 4.95a2.25 2.25 0 100 4.5 2.25 2.25 0 000-4.5z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M14.25 7.5a3 3 0 00-3-3h-1.5a3 3 0 00-3 3v4.5m5.25 0a3 3 0 00-3-3h-1.5a3 3 0 00-3 3v4.5m5.25 0h3.375c.621 0 1.125.504 1.125 1.125V18a3 3 0 01-3 3h-3.375a3 3 0 01-2.92-2.316l-.32-1.08a3 3 0 00-2.92-2.316H6a3 3 0 01-3-3V9a3 3 0 013-3h1.375a3 3 0 012.92 2.316l.32 1.08a3 3 0 002.92 2.316h1.5a.75.75 0 00.75-.75v-2.25a.75.75 0 00-.75-.75h-1.5"
    />
  </svg>
);

export default HandThumbDownIcon;
