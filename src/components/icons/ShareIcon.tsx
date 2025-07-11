
import React from 'react';

const ShareIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
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
      d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.195.025.39.042.586.042h1.564c.23 0 .456.027.676.08A2.25 2.25 0 0114.25 15v.375c0 .621.504 1.125 1.125 1.125h2.25c.621 0 1.125-.504 1.125-1.125V15a2.25 2.25 0 01-2.25-2.25h-1.564a2.25 2.25 0 00-2.083-2.186M7.217 10.907a2.25 2.25 0 100-2.186m0 2.186c-.195-.025-.39-.042-.586-.042H4.875c-.23 0-.456-.027-.676-.08A2.25 2.25 0 002.25 9V8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V9a2.25 2.25 0 002.083 2.186M12 12c0 .621-.504 1.125-1.125 1.125H10.875c-.621 0-1.125-.504-1.125-1.125V12c0-.621.504-1.125 1.125-1.125h.25c.621 0 1.125.504 1.125 1.125v.001z"
    />
  </svg>
);

export default ShareIcon;
