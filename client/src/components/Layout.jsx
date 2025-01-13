import React, { useState } from 'react';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import WithAuth from './WithAuth';

const Layout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  return (
    <WithAuth>
      <div className="flex h-screen bg-gray-100">
        <Sidebar open={sidebarOpen} />
        <div className="flex flex-col flex-1 overflow-hidden">
          <Navbar toggleSidebar={toggleSidebar} />
          <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100">
            <div className="container mx-auto px-6 py-8">
              {children}
            </div>
          </main>
        </div>
      </div>
    </WithAuth>
  );
};

export default Layout;

