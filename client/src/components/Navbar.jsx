import React from 'react';
import { useAuth } from './FirebaseAuth';
import { Menu, ChevronLeft } from 'lucide-react';

const Navbar = ({ toggleSidebar, sidebarOpen }) => {
  const { currentUser } = useAuth();

  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <button
              onClick={toggleSidebar}
              className="text-gray-500 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              {sidebarOpen ? (
                <ChevronLeft className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
            <h1 className="ml-4 text-xl font-semibold text-gray-800">Admin Panel</h1>
          </div>
          {currentUser && (
            <div className="flex items-center">
              <span className="text-sm font-medium text-gray-700 mr-2">{currentUser.email}</span>
              <img
                className="h-8 w-8 rounded-full"
                src={currentUser.photoURL || `https://ui-avatars.com/api/?name=${currentUser.email}`}
                alt={currentUser.displayName || currentUser.email}
              />
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;

