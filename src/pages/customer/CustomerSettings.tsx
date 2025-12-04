import React, { useState } from 'react';
import { useCustomerPreferences, useUpdateCustomerPreferences, useTankThresholds, useUpdateTankThreshold, useDeleteTankThreshold } from '../../hooks/useCustomerAuth';
import { AlertCircle, CheckCircle, Trash2, Edit2, Save, X } from 'lucide-react';

/**
 * Customer Settings Page
 * Manage account preferences, fuel level thresholds, and notifications
 */
export default function CustomerSettings() {
  const { data: preferences, isLoading: preferencesLoading } = useCustomerPreferences();
  const { data: tankThresholds, isLoading: thresholdsLoading } = useTankThresholds();
  const updatePreferences = useUpdateCustomerPreferences();
  const updateTankThreshold = useUpdateTankThreshold();
  const deleteTankThreshold = useDeleteTankThreshold();

  const [formData, setFormData] = useState({
    default_critical_threshold_pct: 15,
    default_warning_threshold_pct: 25,
    delivery_notification_email: '',
    enable_low_fuel_alerts: true,
    enable_delivery_confirmations: true,
    default_chart_days: 7,
  });

  const [editingTank, setEditingTank] = useState<string | null>(null);
  const [tankFormData, setTankFormData] = useState({
    critical_threshold_pct: null as number | null,
    warning_threshold_pct: null as number | null,
    notes: '',
  });

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  // Initialize form when preferences load
  React.useEffect(() => {
    if (preferences) {
      setFormData({
        default_critical_threshold_pct: preferences.default_critical_threshold_pct ?? 15,
        default_warning_threshold_pct: preferences.default_warning_threshold_pct ?? 25,
        delivery_notification_email: preferences.delivery_notification_email ?? '',
        enable_low_fuel_alerts: preferences.enable_low_fuel_alerts ?? true,
        enable_delivery_confirmations: preferences.enable_delivery_confirmations ?? true,
        default_chart_days: preferences.default_chart_days ?? 7,
      });
    }
  }, [preferences]);

  const handleSavePreferences = async () => {
    // Validation
    if (formData.default_critical_threshold_pct >= formData.default_warning_threshold_pct) {
      setErrorMessage('Critical threshold must be lower than warning threshold');
      setSaveStatus('error');
      return;
    }

    setSaveStatus('saving');
    setErrorMessage('');

    try {
      await updatePreferences.mutateAsync(formData);
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error) {
      setSaveStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Failed to save preferences');
    }
  };

  const handleEditTank = (tank: any) => {
    setEditingTank(tank.id);
    setTankFormData({
      critical_threshold_pct: tank.customer_tank_thresholds?.critical_threshold_pct ?? null,
      warning_threshold_pct: tank.customer_tank_thresholds?.warning_threshold_pct ?? null,
      notes: tank.customer_tank_thresholds?.notes ?? '',
    });
  };

  const handleSaveTankThreshold = async (tankAccessId: string) => {
    try {
      await updateTankThreshold.mutateAsync({
        customer_tank_access_id: tankAccessId,
        ...tankFormData,
      });
      setEditingTank(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to save tank threshold');
    }
  };

  const handleDeleteTankThreshold = async (tankAccessId: string) => {
    if (!confirm('Remove custom threshold for this tank? It will revert to account defaults.')) {
      return;
    }

    try {
      await deleteTankThreshold.mutateAsync(tankAccessId);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to delete threshold');
    }
  };

  if (preferencesLoading || thresholdsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-500">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 mt-1">Manage your account preferences and fuel level alerts</p>
      </div>

      {/* Success/Error Messages */}
      {saveStatus === 'success' && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
          <CheckCircle className="h-5 w-5 text-green-600" />
          <span className="text-green-800">Settings saved successfully</span>
        </div>
      )}

      {saveStatus === 'error' && errorMessage && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-600" />
          <span className="text-red-800">{errorMessage}</span>
        </div>
      )}

      {/* Fuel Level Alerts Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Fuel Level Alerts</h2>

        <div className="space-y-6">
          {/* Critical Threshold */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Critical Threshold ({formData.default_critical_threshold_pct}%)
            </label>
            <p className="text-sm text-gray-500 mb-3">
              You'll receive urgent notifications when fuel drops below this level
            </p>
            <input
              type="range"
              min="0"
              max="100"
              value={formData.default_critical_threshold_pct}
              onChange={(e) => setFormData({ ...formData, default_critical_threshold_pct: parseInt(e.target.value) })}
              className="w-full h-2 bg-red-200 rounded-lg appearance-none cursor-pointer accent-red-600"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>0%</span>
              <span>100%</span>
            </div>
          </div>

          {/* Warning Threshold */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Warning Threshold ({formData.default_warning_threshold_pct}%)
            </label>
            <p className="text-sm text-gray-500 mb-3">
              You'll receive regular notifications when fuel drops below this level
            </p>
            <input
              type="range"
              min="0"
              max="100"
              value={formData.default_warning_threshold_pct}
              onChange={(e) => setFormData({ ...formData, default_warning_threshold_pct: parseInt(e.target.value) })}
              className="w-full h-2 bg-yellow-200 rounded-lg appearance-none cursor-pointer accent-yellow-600"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>0%</span>
              <span>100%</span>
            </div>
          </div>

          {/* Enable Low Fuel Alerts */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <label className="font-medium text-gray-900">Enable Low Fuel Alerts</label>
              <p className="text-sm text-gray-500">Receive email notifications for low fuel levels</p>
            </div>
            <input
              type="checkbox"
              checked={formData.enable_low_fuel_alerts}
              onChange={(e) => setFormData({ ...formData, enable_low_fuel_alerts: e.target.checked })}
              className="h-5 w-5 text-blue-600 rounded focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Notification Preferences */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Notification Preferences</h2>

        <div className="space-y-4">
          {/* Delivery Notification Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Delivery Notification Email
            </label>
            <p className="text-sm text-gray-500 mb-3">
              Email address for fuel delivery confirmations (leave blank to use your account email)
            </p>
            <input
              type="email"
              value={formData.delivery_notification_email}
              onChange={(e) => setFormData({ ...formData, delivery_notification_email: e.target.value })}
              placeholder="email@example.com"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Enable Delivery Confirmations */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <label className="font-medium text-gray-900">Enable Delivery Confirmations</label>
              <p className="text-sm text-gray-500">Receive email confirmations when you request fuel delivery</p>
            </div>
            <input
              type="checkbox"
              checked={formData.enable_delivery_confirmations}
              onChange={(e) => setFormData({ ...formData, enable_delivery_confirmations: e.target.checked })}
              className="h-5 w-5 text-blue-600 rounded focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Display Preferences */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Display Preferences</h2>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Default Chart Period
          </label>
          <p className="text-sm text-gray-500 mb-3">
            Default time range for consumption charts
          </p>
          <select
            value={formData.default_chart_days}
            onChange={(e) => setFormData({ ...formData, default_chart_days: parseInt(e.target.value) })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value={7}>7 days</option>
            <option value={14}>14 days</option>
            <option value={30}>30 days</option>
            <option value={90}>90 days</option>
          </select>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSavePreferences}
          disabled={saveStatus === 'saving'}
          className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        >
          {saveStatus === 'saving' ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Save Preferences
            </>
          )}
        </button>
      </div>

      {/* Tank-Specific Thresholds */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Tank-Specific Thresholds</h2>
        <p className="text-gray-500 mb-6">
          Override the default thresholds for individual tanks. Leave empty to use account defaults.
        </p>

        {tankThresholds && tankThresholds.length > 0 ? (
          <div className="space-y-4">
            {tankThresholds.map((tank: any) => (
              <div
                key={tank.id}
                className={`border rounded-lg p-4 ${tank.has_override ? 'border-blue-200 bg-blue-50' : 'border-gray-200'}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">
                      {tank.agbot_location?.name || `Tank ${tank.agbot_location_id}`}
                    </h3>
                    <p className="text-sm text-gray-500">{tank.agbot_location?.address}</p>

                    {editingTank === tank.id ? (
                      <div className="mt-4 space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Critical Threshold (%)
                          </label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={tankFormData.critical_threshold_pct ?? ''}
                            onChange={(e) => setTankFormData({
                              ...tankFormData,
                              critical_threshold_pct: e.target.value ? parseInt(e.target.value) : null
                            })}
                            placeholder={`Default: ${formData.default_critical_threshold_pct}%`}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Warning Threshold (%)
                          </label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={tankFormData.warning_threshold_pct ?? ''}
                            onChange={(e) => setTankFormData({
                              ...tankFormData,
                              warning_threshold_pct: e.target.value ? parseInt(e.target.value) : null
                            })}
                            placeholder={`Default: ${formData.default_warning_threshold_pct}%`}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Notes
                          </label>
                          <input
                            type="text"
                            value={tankFormData.notes}
                            onChange={(e) => setTankFormData({ ...tankFormData, notes: e.target.value })}
                            placeholder="Why are you setting custom thresholds?"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSaveTankThreshold(tank.id)}
                            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 flex items-center gap-2"
                          >
                            <Save className="h-4 w-4" />
                            Save
                          </button>
                          <button
                            onClick={() => setEditingTank(null)}
                            className="px-4 py-2 bg-gray-200 text-gray-700 text-sm rounded-lg hover:bg-gray-300 flex items-center gap-2"
                          >
                            <X className="h-4 w-4" />
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2 flex items-center gap-4 text-sm">
                        <span className={tank.has_override ? 'text-blue-700 font-medium' : 'text-gray-500'}>
                          Critical: {tank.effective_critical_threshold}%
                        </span>
                        <span className={tank.has_override ? 'text-blue-700 font-medium' : 'text-gray-500'}>
                          Warning: {tank.effective_warning_threshold}%
                        </span>
                        {tank.has_override && (
                          <span className="text-blue-600 text-xs bg-blue-100 px-2 py-1 rounded">
                            Custom
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {editingTank !== tank.id && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditTank(tank)}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Edit threshold"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      {tank.has_override && (
                        <button
                          onClick={() => handleDeleteTankThreshold(tank.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Remove custom threshold"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">No tanks found</p>
        )}
      </div>
    </div>
  );
}
