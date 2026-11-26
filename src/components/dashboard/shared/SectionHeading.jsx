import React from 'react';

const SectionHeading = ({ icon: Icon, title, description }) => (
  <div className="mb-8">
    <div className="flex items-center gap-4 mb-2">
      <div className="p-2.5 bg-indigo-100 text-indigo-600 rounded-2xl">
        <Icon className="w-5 h-5" />
      </div>
      <h3 className="text-2xl font-black text-slate-800 tracking-tight">{title}</h3>
    </div>
    <p className="text-sm font-medium text-slate-500 max-w-2xl leading-relaxed">{description}</p>
  </div>
);

export default SectionHeading;
