
import React from 'react';

const UsersIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
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
      d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m-7.5-2.962c.57-1.03-.19-2.3-1.34-2.3H5.25A2.25 2.25 0 003 13.5v2.25a2.25 2.25 0 002.25 2.25H5.25c1.15 0 1.91-.127 2.44-.391m-2.44-.391a2.25 2.25 0 01-1.5-2.092V13.5m2.44-.391c.426-.223.954-.391 1.5-.391h.525c.426 0 .832.059 1.22.164m-1.745 4.882a2.25 2.25 0 01-1.5-2.092V13.5m4.375 5.062c.282-.135.533-.298.747-.484a2.25 2.25 0 013.483 0c.214.186.465.349.747.484M12 12a3 3 0 11-6 0 3 3 0 016 0z"
    />
  </svg>
);

export default UsersIcon;
