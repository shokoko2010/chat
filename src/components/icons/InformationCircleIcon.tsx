import React from 'react';

const InformationCircleIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
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
      d="M11.25 11.25l.25 5.25m.47-5.47a.75.75 0 10-1.5 0 .75.75 0 001.5 0zM21 12a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

export default InformationCircleIcon;
