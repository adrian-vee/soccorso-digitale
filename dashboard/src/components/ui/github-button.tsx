'use client';
import React, { useState } from 'react';
import { Github, Star } from 'lucide-react';
import { Liquid, Colors } from '@/components/ui/button-1';

const COLORS: Colors = {
  color1: '#FFFFFF',
  color2: '#1E10C5',
  color3: '#5B4FE8',
  color4: '#7C3AED',
  color5: '#6D28D9',
  color6: '#4F46E5',
  color7: '#3730A3',
  color8: '#1D4ED8',
  color9: '#1E40AF',
  color10: '#1E3A8A',
  color11: '#0F172A',
  color12: '#8B5CF6',
  color13: '#A78BFA',
  color14: '#C4B5FD',
  color15: '#DDD6FE',
  color16: '#EDE9FE',
  color17: '#F5F3FF',
};

const GitHubButton = () => {
  const [isHovered, setIsHovered] = useState(false);
  const [stars] = useState(1247);

  return (
    <button
      className='relative overflow-hidden rounded-full cursor-pointer border-0 p-0'
      style={{ width: 280, height: 56 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Liquid isHovered={isHovered} colors={COLORS} />
      <span className='relative z-10 flex items-center justify-center gap-3 px-6 h-full text-white font-semibold text-sm'>
        <Github size={18} />
        Star on GitHub
        <span className='flex items-center gap-1 bg-white/20 rounded-full px-2 py-0.5 text-xs'>
          <Star size={11} fill='currentColor' />
          {stars.toLocaleString()}
        </span>
      </span>
    </button>
  );
};

export default GitHubButton;
