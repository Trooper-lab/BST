import React, { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { Layers, Zap, Shield, Monitor } from 'lucide-react';

const Hero: React.FC = () => {
  const container = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const tl = gsap.timeline({ defaults: { ease: 'power4.out', duration: 1.2 } });

    tl.from('.hero-title span', {
      y: 100,
      opacity: 0,
      stagger: 0.1,
      skewY: 7,
    })
    .from('.hero-sub', {
      y: 20,
      opacity: 0,
    }, '-=0.8')
    .from('.hero-btn', {
      scale: 0.9,
      opacity: 0,
    }, '-=1')
    .from('.hero-feature', {
      y: 30,
      opacity: 0,
      stagger: 0.2,
    }, '-=1');
  }, { scope: container });

  return (
    <section ref={container} className="relative min-h-screen flex items-center justify-center pt-20 overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-600/10 blur-[120px] rounded-full" />
      
      <div className="container mx-auto px-6 relative z-10 text-center">
        <h1 className="hero-title text-6xl md:text-8xl font-bold tracking-tight mb-8">
          <span className="block text-gradient">Build Faster.</span>
          <span className="block text-white">Animate Better.</span>
        </h1>
        
        <p className="hero-sub text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-12">
          A premium, SEO-optimized React boilerplate with Tailwind 4 and GSAP. 
          Secured with Firebase and built for speed.
        </p>
        
        <div className="hero-btn flex flex-wrap items-center justify-center gap-4 mb-20">
          <button className="px-8 py-4 bg-white text-black font-semibold rounded-full hover:scale-105 transition-transform">
            Get Started
          </button>
          <button className="px-8 py-4 glass text-white font-semibold rounded-full hover:bg-white/10 transition-colors">
            View Docs
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 max-w-5xl mx-auto">
          {[
            { icon: <Zap className="w-6 h-6" />, label: 'Fast Loading', desc: 'Vite 6 + React 19' },
            { icon: <Shield className="w-6 h-6" />, label: 'Secure', desc: 'Firebase Config' },
            { icon: <Monitor className="w-6 h-6" />, label: 'SEO Friendly', desc: 'Meta tags included' },
            { icon: <Layers className="w-6 h-6" />, label: 'Modern Stack', desc: 'Tailwind 4 + GSAP' },
          ].map((item, idx) => (
            <div key={idx} className="hero-feature p-6 rounded-2xl glass text-left">
              <div className="mb-4 p-3 w-fit rounded-xl bg-blue-600/10 text-blue-500">
                {item.icon}
              </div>
              <h3 className="text-lg font-semibold mb-1">{item.label}</h3>
              <p className="text-sm text-gray-500">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Hero;
