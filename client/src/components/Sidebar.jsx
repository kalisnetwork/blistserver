import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './FirebaseAuth';
import { List, Building, LogOut } from 'lucide-react';

const Sidebar = ({ open }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();

  const menuItems = [
    { text: 'Listing Form', path: '/', icon: List },
    { text: 'Listed Businesses', path: '/listed-businesses', icon: Building },
  ];

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (e) {
      console.error("Failed to logout ", e);
    }
  };

  return (
    <div className={`bg-white border-r border-gray-200 ${open ? 'w-64' : 'w-0'} transition-all duration-300 ease-in-out`}>
      <div className="h-full flex flex-col">
        <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
          <nav className="mt-5 flex-1 px-2 space-y-1">
            {menuItems.map((item) => (
              <a
                key={item.text}
                href={item.path}
                className={`${
                  location.pathname === item.path
                    ? 'bg-gray-100 text-gray-900'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                } group flex items-center px-2 py-2 text-sm font-medium rounded-md`}
              >
                <item.icon className="text-gray-400 group-hover:text-gray-500 mr-3 flex-shrink-0 h-6 w-6" aria-hidden="true" />
                {item.text}
              </a>
            ))}
          </nav>
        </div>
        <div className="flex-shrink-0 flex border-t border-gray-200 p-4">
          <button
            onClick={handleLogout}
            className="flex-shrink-0 group block w-full"
          >
            <div className="flex items-center">
              <div>
                <LogOut className="inline-block h-9 w-9 rounded-full text-gray-400 group-hover:text-gray-500" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
                  Logout
                </p>
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;

