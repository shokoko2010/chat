import React from 'react';

const CloudIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
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
      d="M2.25 15a4.5 4.5 0 004.5 4.5H18a3.75 3.75 0 001.332-7.257 3 3 0 00-2.43-4.242 4.5 4.5 0 00-8.23-2.543 4.5 4.5 0 00-1.084 6.678A4.5 4.5 0 002.25 15z"
    />
  </svg>
);

export default CloudIcon;
