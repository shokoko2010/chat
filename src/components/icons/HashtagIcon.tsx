import React from 'react';

const HashtagIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
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
      d="M5.25 8.25h13.5m-13.5 7.5h13.5m-1.5-15l-3 18m-3-18l-3 18"
    />
  </svg>
);

export default HashtagIcon;
