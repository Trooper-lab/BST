import React from 'react';
import Meta from '../common/Meta';
import Navbar from './Navbar';

interface LayoutProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
}

const Layout: React.FC<LayoutProps> = ({ children, title, description }) => {
  return (
    <>
      <Meta title={title} description={description} />
      <div className="min-h-screen bg-[#050505]">
        <Navbar />
        <main>
          {children}
        </main>
        {/* Basic Footer */}
        <footer className="py-20 border-t border-white/5 text-center">
          <p className="text-gray-500 text-sm">
            &copy; {new Date().getFullYear()} Gravity Boilerplate. Built for speed.
          </p>
        </footer>
      </div>
    </>
  );
};

export default Layout;
