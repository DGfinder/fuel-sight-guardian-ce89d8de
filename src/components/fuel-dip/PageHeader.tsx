import React from 'react';

export function PageHeader({ title }: { title: string }) {
  return (
    <h1 className="text-2xl font-bold text-gray-900 mb-6">{title}</h1>
  );
} 