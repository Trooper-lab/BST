import React, { useState, useEffect } from 'react';
import { Menu, X, Ghost } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const Navbar: React.FC = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav 
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300 px-6 py-4",
        isScrolled ? "bg-black/50 backdrop-blur-lg border-b border-white/10" : "bg-transparent"
      )}
    >
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2 group cursor-pointer">
          <div className="p-2 bg-blue-600 rounded-xl group-hover:rotate-12 transition-transform">
            <Ghost className="w-6 h-6 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight text-white">GRAVITY</span>
        </div>

        {/* Desktop Links */}
        <div className="hidden md:flex items-center gap-8">
          {['Features', 'About', 'Pricing', 'Docs'].map((link) => (
            <a key={link} href={`#${link.toLowerCase()}`} className="text-sm font-medium text-gray-400 hover:text-white transition-colors">
              {link}
            </a>
          ))}
          <button className="px-6 py-2 bg-white text-black text-sm font-bold rounded-full hover:bg-gray-200 transition-colors">
            Get Started
          </button>
        </div>

        {/* Mobile Toggle */}
        <button className="md:hidden text-white" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
          {isMobileMenuOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="absolute top-full left-0 right-0 bg-black border-b border-white/10 p-6 md:hidden animate-in fade-in slide-in-from-top-4">
          <div className="flex flex-col gap-4">
            {['Features', 'About', 'Pricing', 'Docs'].map((link) => (
              <a key={link} href={`#${link.toLowerCase()}`} className="text-lg font-medium text-gray-400">
                {link}
              </a>
            ))}
            <button className="w-full py-3 bg-white text-black font-bold rounded-xl">
              Get Started
            </button>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
