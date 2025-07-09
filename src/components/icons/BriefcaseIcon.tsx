
import React from 'react';

const BriefcaseIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
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
      d="M20.25 14.15v4.098a2.25 2.25 0 01-2.25 2.25h-13.5a2.25 2.25 0 01-2.25-2.25V14.15M18.75 6.75h.75A2.25 2.25 0 0121.75 9v4.5a2.25 2.25 0 01-2.25 2.25h-15A2.25 2.25 0 012.25 13.5v-4.5A2.25 2.25 0 014.5 6.75h.75m13.5 0v-1.5a2.25 2.25 0 00-2.25-2.25h-9a2.25 2.25 0 00-2.25 2.25v1.5m13.5 0h-13.5"
    />
  </svg>
);

export default BriefcaseIcon;
