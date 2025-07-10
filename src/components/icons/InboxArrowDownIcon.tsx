import React from 'react';

const InboxArrowDownIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
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
      d="M10.5 1.5H5.25A2.25 2.25 0 003 3.75v16.5a2.25 2.25 0 002.25 2.25h13.5A2.25 2.25 0 0021 20.25V10.5M10.5 1.5L15 1.5m-4.5 0V5.625c0 .621.504 1.125 1.125 1.125h1.5a1.125 1.125 0 001.125-1.125V1.5m-4.5 0h4.5M12 18.75a.75.75 0 00.75.75h.008a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75h-.008a.75.75 0 00-.75.75v5.25z"
    />
     <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 13.5L12 18l-4.5-4.5" />
  </svg>
);

export default InboxArrowDownIcon;
