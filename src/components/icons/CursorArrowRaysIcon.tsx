
import React from 'react';

const CursorArrowRaysIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
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
      d="M15.042 21.672L13.684 16.6m0 0l-2.51 2.225.569-2.474m0 0l5.572-2.506m3.423-1.443c.068.51-.026 1.023-.245 1.48a.75.75 0 01-1.037.636l-2.752-.688-3.793 1.7A.75.75 0 016.5 18.25l-2.752-.688a.75.75 0 01-.636-1.037.994.994 0 01.245-1.48L5.33 9.227a.75.75 0 01.636-1.037l2.752.688 3.793-1.7a.75.75 0 011.037.636l2.455 5.334z"
    />
  </svg>
);

export default CursorArrowRaysIcon;
