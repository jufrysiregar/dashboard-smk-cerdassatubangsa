import React from 'react';
import { motion } from 'framer-motion';

const GlassCard = ({ children, className = "" }) => {
  const hasBg = className.includes('bg-');
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`${!hasBg ? 'bg-white/80' : ''} backdrop-blur-xl border border-white/40 shadow-xl rounded-[2rem] p-6 lg:p-8 ${className}`}
    >
      {children}
    </motion.div>
  );
};

export default GlassCard;
