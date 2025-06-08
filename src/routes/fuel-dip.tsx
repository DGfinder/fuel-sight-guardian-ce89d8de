import React from 'react';
import { PageHeader } from '@/components/fuel-dip/PageHeader';
import { FuelDipForm } from '@/components/fuel-dip/FuelDipForm';

export default function FuelDipRoute() {
  return (
    <div className="min-h-screen w-full bg-muted flex flex-col items-center justify-start py-8 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-xl bg-white rounded-lg shadow p-6">
        <PageHeader title="Add Fuel Dip Reading" />
        <FuelDipForm />
      </div>
    </div>
  );
} 