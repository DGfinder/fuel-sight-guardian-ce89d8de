import React from 'react';
import { SimpleTanksList } from '@/components/SimpleTanksList';

// Simple test page to verify tanks are loading and analytics work
export default function TestTanksList() {
  return (
    <div className="min-h-screen bg-gray-50">
      <SimpleTanksList />
    </div>
  );
} 