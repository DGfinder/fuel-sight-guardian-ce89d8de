const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/components/AgbotDetailsModal.tsx');
const content = fs.readFileSync(filePath, 'utf8');

// Find the start and end of the Analytics Tab section
const startMarker = '          {/* Analytics Tab */}\n          <TabsContent value="analytics" className="space-y-4">';
const endMarker = '          </TabsContent>\n\n          {/* Device Tab */}';

const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker);

if (startIndex === -1 || endIndex === -1) {
  console.error('Could not find Analytics Tab section markers');
  process.exit(1);
}

const newAnalyticsSection = `          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-4">
            {/* TIER 1: Always Show - Current Tank Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Fuel className="h-5 w-5 text-blue-600" />
                  Current Tank Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-6">
                  {/* Current Litres - Primary Display */}
                  <div className="text-center">
                    {currentLitres !== null ? (
                      <>
                        <div className={\`text-5xl font-bold \${percentageColor}\`}>
                          {Math.round(currentLitres).toLocaleString()}
                        </div>
                        <div className="text-sm font-medium text-muted-foreground mt-1">
                          LITRES ({commodity})
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {percentage?.toFixed(1)}% of capacity
                        </div>
                      </>
                    ) : (
                      <>
                        <div className={\`text-5xl font-bold \${percentageColor}\`}>
                          {percentage !== null && percentage !== undefined
                            ? \`\${percentage.toFixed(1)}%\`
                            : 'N/A'
                          }
                        </div>
                        <div className="text-sm font-medium text-muted-foreground mt-1">
                          FUEL LEVEL
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          calibrated reading
                        </div>
                      </>
                    )}
                  </div>

                  {/* Tank Capacity */}
                  <div className="text-center">
                    <div className="text-3xl font-bold text-gray-700">
                      {capacity.toLocaleString()}
                    </div>
                    <div className="text-sm font-medium text-muted-foreground mt-1">
                      CAPACITY (L)
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      total tank size
                    </div>
                  </div>

                  {/* Last Reading */}
                  <div className="text-center">
                    <div className="text-lg font-semibold text-gray-700">
                      {formatTimestamp(selectedLocation.latest_telemetry)}
                    </div>
                    <div className="text-sm font-medium text-muted-foreground mt-1">
                      LAST READING
                    </div>
                    {selectedLocation.latest_telemetry && (
                      <div className="text-xs text-gray-500 mt-1">
                        {new Date(selectedLocation.latest_telemetry).toLocaleString()}
                      </div>
                    )}
                  </div>
                </div>

                {/* Visual Progress Bar */}
                {percentage !== null && percentage !== undefined && (
                  <div className="mt-6">
                    <Progress value={percentage} className="h-4" />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>Empty (0L)</span>
                      <span className="font-semibold">Critical: 20% ({Math.round(capacity * 0.2).toLocaleString()}L)</span>
                      <span>Full ({capacity.toLocaleString()}L)</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* TIER 2: Basic Analytics - Show when we have historical data */}
            {historyData && historyData.readings && historyData.readings.length > 0 && (
              <>
                {/* Simple Calculations from Available Data */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Activity className="h-5 w-5 text-green-600" />
                      Available Data Insights
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-4 gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">
                          {historyData.readings.length}
                        </div>
                        <div className="text-sm text-muted-foreground">Data Points</div>
                        <div className="text-xs text-gray-500 mt-1">
                          readings collected
                        </div>
                      </div>

                      {/* Litres Above Critical */}
                      {currentLitres !== null && percentage !== null && percentage > 20 && (
                        <div className="text-center">
                          <div className={\`text-2xl font-bold \${
                            percentage <= 30 ? 'text-red-600' : percentage <= 50 ? 'text-yellow-600' : 'text-green-600'
                          }\`}>
                            {Math.round(currentLitres - (capacity * 0.2)).toLocaleString()}
                          </div>
                          <div className="text-sm text-muted-foreground">Litres Above Critical</div>
                          <div className="text-xs text-gray-500 mt-1">
                            {Math.round(capacity * 0.2).toLocaleString()}L is critical
                          </div>
                        </div>
                      )}

                      {/* Latest Reading Info */}
                      <div className="text-center">
                        <div className="text-2xl font-bold text-purple-600">
                          {historyData.readings[0]?.calibrated_fill_percentage?.toFixed(1) || 'N/A'}%
                        </div>
                        <div className="text-sm text-muted-foreground">Latest Reading</div>
                        <div className="text-xs text-gray-500 mt-1">
                          {historyData.readings[0]?.reading_timestamp
                            ? format(new Date(historyData.readings[0].reading_timestamp), 'MMM d, h:mm a')
                            : 'N/A'}
                        </div>
                      </div>

                      {/* Oldest Reading for Comparison */}
                      {historyData.readings.length > 1 && (
                        <div className="text-center">
                          <div className="text-2xl font-bold text-orange-600">
                            {historyData.readings[historyData.readings.length - 1]?.calibrated_fill_percentage?.toFixed(1) || 'N/A'}%
                          </div>
                          <div className="text-sm text-muted-foreground">Oldest Reading</div>
                          <div className="text-xs text-gray-500 mt-1">
                            {historyData.readings[historyData.readings.length - 1]?.reading_timestamp
                              ? format(new Date(historyData.readings[historyData.readings.length - 1].reading_timestamp), 'MMM d')
                              : 'N/A'}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Charts - Always show when we have readings */}
                {historyData.readings.length > 0 && (
                  <AgbotReadingCharts
                    readings={historyData.readings}
                    isLoading={historyLoading}
                    showLitres={true}
                  />
                )}
              </>
            )}

            {/* TIER 3: Advanced Analytics - Show when we have 2+ days of data */}
            {analytics && historyData && historyData.readings && historyData.readings.length >= 2 ? (
              <>
                {/* Consumption Metrics in LITRES */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingDown className="h-5 w-5 text-red-600" />
                      Diesel Consumption Analytics
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4">
                      {/* Daily Consumption in Litres */}
                      <div className="text-center">
                        <div className="text-3xl font-bold text-blue-600">
                          {capacity > 0
                            ? \`\${Math.round((analytics.rolling_avg_pct_per_day / 100) * capacity).toLocaleString()}L\`
                            : \`\${analytics.rolling_avg_pct_per_day.toFixed(2)}%\`
                          }
                        </div>
                        <div className="text-sm font-medium text-muted-foreground mt-1">
                          DAILY CONSUMPTION
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {capacity > 0 ? \`\${analytics.rolling_avg_pct_per_day.toFixed(2)}% per day\` : 'percentage per day'}
                        </div>
                      </div>

                      {/* Yesterday's Consumption */}
                      <div className="text-center">
                        <div className="text-3xl font-bold text-purple-600">
                          {capacity > 0
                            ? \`\${Math.round((analytics.prev_day_pct_used / 100) * capacity).toLocaleString()}L\`
                            : \`\${analytics.prev_day_pct_used.toFixed(2)}%\`
                          }
                        </div>
                        <div className="text-sm font-medium text-muted-foreground mt-1">
                          YESTERDAY'S USAGE
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {capacity > 0 ? \`\${analytics.prev_day_pct_used.toFixed(2)}% consumed\` : 'percentage consumed'}
                        </div>
                      </div>

                      {/* Days to Critical */}
                      <div className="text-center">
                        <div className={\`text-3xl font-bold \${
                          analytics.days_to_critical_level === null ? 'text-gray-500' :
                          analytics.days_to_critical_level <= 7 ? 'text-red-600' :
                          analytics.days_to_critical_level <= 14 ? 'text-yellow-600' : 'text-green-600'
                        }\`}>
                          {analytics.days_to_critical_level !== null
                            ? analytics.days_to_critical_level.toFixed(1)
                            : 'N/A'
                          }
                        </div>
                        <div className="text-sm font-medium text-muted-foreground mt-1">
                          DAYS TO CRITICAL
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          until reaching 20%
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Performance & Trend Metrics */}
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Zap className="h-5 w-5 text-amber-600" />
                        Performance Metrics
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Efficiency Score</span>
                        <div className="flex items-center gap-2">
                          <Progress value={Math.min(100, analytics.efficiency_score)} className="w-24 h-2" />
                          <span className={\`text-sm font-semibold \${
                            analytics.efficiency_score >= 80 ? 'text-green-600' :
                            analytics.efficiency_score >= 60 ? 'text-yellow-600' : 'text-red-600'
                          }\`}>
                            {analytics.efficiency_score.toFixed(1)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Data Reliability</span>
                        <div className="flex items-center gap-2">
                          <Progress value={analytics.data_reliability_score} className="w-24 h-2" />
                          <span className={\`text-sm font-semibold \${
                            analytics.data_reliability_score >= 90 ? 'text-green-600' :
                            analytics.data_reliability_score >= 70 ? 'text-yellow-600' : 'text-red-600'
                          }\`}>
                            {analytics.data_reliability_score.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Activity className="h-5 w-5 text-green-600" />
                        Consumption Trend
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center gap-2">
                        {analytics.consumption_trend === 'increasing' ? (
                          <TrendingUp className="h-5 w-5 text-red-500" />
                        ) : analytics.consumption_trend === 'decreasing' ? (
                          <TrendingDown className="h-5 w-5 text-green-500" />
                        ) : (
                          <div className="h-5 w-5 bg-gray-400 rounded-full" />
                        )}
                        <span className="capitalize font-medium">{analytics.consumption_trend}</span>
                      </div>
                      <div className="text-sm">
                        <span className="font-medium">Velocity: </span>
                        <span className={analytics.consumption_velocity > 0 ? 'text-red-600' :
                                       analytics.consumption_velocity < 0 ? 'text-green-600' : 'text-gray-600'}>
                          {analytics.consumption_velocity > 0 ? '+' : ''}
                          {capacity > 0
                            ? \`\${Math.round((analytics.consumption_velocity / 100) * capacity)}L/day\`
                            : \`\${analytics.consumption_velocity.toFixed(2)}%/day\`
                          }
                        </span>
                      </div>
                      <div className="text-xs text-gray-500">
                        {analytics.consumption_velocity > 0 ? 'Usage accelerating' :
                         analytics.consumption_velocity < 0 ? 'Usage decelerating' : 'Usage stable'}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Refill Analysis */}
                {analytics.last_refill_date && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                        Refill Patterns
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="text-center">
                          <div className="text-lg font-semibold">
                            {formatTimestamp(analytics.last_refill_date)}
                          </div>
                          <div className="text-sm text-muted-foreground">Last Refill</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-semibold">
                            {analytics.refill_frequency_days?.toFixed(1) || 'N/A'} days
                          </div>
                          <div className="text-sm text-muted-foreground">Avg Refill Frequency</div>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-semibold">
                            {analytics.predicted_next_refill
                              ? formatTimestamp(analytics.predicted_next_refill)
                              : 'N/A'
                            }
                          </div>
                          <div className="text-sm text-muted-foreground">Predicted Next Refill</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Alerts Section */}
                {(analytics.unusual_consumption_alert || analytics.potential_leak_alert || analytics.device_connectivity_alert) && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-orange-500" />
                        Alerts & Warnings
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {analytics.unusual_consumption_alert && (
                        <div className="flex items-center gap-2 p-3 rounded-md bg-yellow-50 border border-yellow-200">
                          <AlertTriangle className="h-4 w-4 text-yellow-600" />
                          <span className="text-sm text-yellow-800">
                            Unusual consumption pattern detected - diesel usage is higher than normal
                          </span>
                        </div>
                      )}
                      {analytics.potential_leak_alert && (
                        <div className="flex items-center gap-2 p-3 rounded-md bg-red-50 border border-red-200">
                          <AlertTriangle className="h-4 w-4 text-red-600" />
                          <span className="text-sm text-red-800">
                            Potential leak detected - consistently high consumption rate
                          </span>
                        </div>
                      )}
                      {analytics.device_connectivity_alert && (
                        <div className="flex items-center gap-2 p-3 rounded-md bg-orange-50 border border-orange-200">
                          <AlertTriangle className="h-4 w-4 text-orange-600" />
                          <span className="text-sm text-orange-800">
                            Device connectivity issues - data reliability below 80%
                          </span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </>
            ) : (
              /* Show info message when advanced analytics aren't available yet */
              historyData && historyData.readings && historyData.readings.length > 0 && historyData.readings.length < 2 && (
                <Card>
                  <CardContent className="p-6 text-center">
                    <Info className="h-10 w-10 text-blue-400 mx-auto mb-3" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Advanced Analytics Coming Soon</h3>
                    <p className="text-gray-600 text-sm">
                      {historyData.readings.length} reading collected. Advanced analytics including consumption trends,
                      refill predictions, and alerts will be available once we have 2+ days of data.
                    </p>
                    <div className="mt-3 text-xs text-gray-500">
                      Keep monitoring to unlock detailed insights about your diesel consumption.
                    </div>
                  </CardContent>
                </Card>
              )
            )}
          </TabsContent>`;

const newContent = content.substring(0, startIndex) + newAnalyticsSection + content.substring(endIndex);

fs.writeFileSync(filePath, newContent, 'utf8');
console.log('Successfully replaced Analytics Tab section');
