
import React from 'react';

const ChatBubbleLeftRightIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
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
      d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193l-3.722.537a55.454 55.454 0 01-1.654.216l-1.353.193a.5.5 0 00-.414.493V19.5a2.25 2.25 0 01-2.25 2.25h-1.5a2.25 2.25 0 01-2.25-2.25v-.632a.5.5 0 00-.414-.493l-1.353-.193a55.454 55.454 0 01-1.654-.216l-3.722-.537C3.347 16.9 2.5 15.936 2.5 14.8v-4.286c0-.97.616-1.813 1.5-2.097L6.25 7.5l2.25-3.03a.75.75 0 011.2-.3L12 5.25l2.25-3.03a.75.75 0 011.2.3l2.25 3.03L20.25 8.511z"
    />
  </svg>
);

export default ChatBubbleLeftRightIcon;
