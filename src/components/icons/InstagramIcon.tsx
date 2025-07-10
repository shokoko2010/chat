
import React from 'react';

const InstagramIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <defs>
      <radialGradient id="ig-gradient" r="150%" cx="30%" cy="107%">
        <stop stopColor="#fdf497" offset="0" />
        <stop stopColor="#fdf497" offset="0.05" />
        <stop stopColor="#fd5949" offset="0.45" />
        <stop stopColor="#d6249f" offset="0.6" />
        <stop stopColor="#285AEB" offset="0.9" />
      </radialGradient>
    </defs>
    <rect width="20" height="20" x="2" y="2" rx="5" ry="5" stroke="url(#ig-gradient)" fill="none" strokeWidth="2.5"></rect>
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" stroke="url(#ig-gradient)" strokeWidth="2.5"></path>
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" stroke="url(#ig-gradient)" strokeWidth="3"></line>
  </svg>
);

export default InstagramIcon;
