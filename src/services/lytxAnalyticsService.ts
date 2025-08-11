/**
 * LYTX Analytics Service
 * Comprehensive business intelligence service for 34K+ historical safety events
 * Provides advanced statistical analysis, trend calculations, and executive reporting
 */

import { supabase } from '@/lib/supabase';
import type { LytxHistoricalEvent, LytxAnalyticsFilters, DateRange } from '@/hooks/useLytxHistoricalData';

// Statistical Analysis Types
export interface PerformanceMetrics {
  mean: number;
  median: number;
  mode: number | null;
  standardDeviation: number;
  percentile25: number;
  percentile75: number;
  percentile90: number;
  outliers: number[];
  trendDirection: 'improving' | 'stable' | 'declining';
  confidenceInterval: { lower: number; upper: number };
}

export interface TimeSeriesAnalysis {
  period: string;
  value: number;
  movingAverage: number;
  seasonalIndex: number;
  trendComponent: number;
  cyclicalComponent: number;
  irregularComponent: number;
  forecast?: number;
  confidenceBand?: { upper: number; lower: number };
}

export interface DriverPerformanceAnalysis {
  driver: string;
  carrier: string;
  totalEvents: number;
  avgScore: number;
  scoreMetrics: PerformanceMetrics;
  eventTrend: TimeSeriesAnalysis[];
  riskProfile: DriverRiskProfile;
  coachingEffectiveness: CoachingAnalysis;
  benchmarkComparison: BenchmarkComparison;
  recommendations: string[];
}

export interface DriverRiskProfile {
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskScore: number;
  riskFactors: string[];
  frequencyRisk: number;
  severityRisk: number;
  behavioralPatterns: string[];
  timePatterns: { hour: number; frequency: number }[];
  locationPatterns: { depot: string; frequency: number }[];
}

export interface CoachingAnalysis {
  coachingRequired: boolean;
  coachingCompleted: boolean;
  effectiveness: number; // Improvement rate after coaching
  timeToResolution: number; // Days from event to resolution
  recurrenceRate: number; // Rate of similar events after coaching
  recommendedApproach: string;
}

export interface BenchmarkComparison {
  peerGroupAvg: number;
  industryAvg: number;
  companyAvg: number;
  percentileRank: number;
  performanceGap: number;
  improvementPotential: number;
}

export interface CarrierAnalysis {
  carrier: string;
  totalEvents: number;
  avgScore: number;
  resolutionRate: number;
  topTriggers: { trigger: string; count: number; avgScore: number }[];
  depotComparison: DepotMetrics[];
  monthlyTrends: TimeSeriesAnalysis[];
  safetyMetrics: SafetyMetrics;
  operationalEfficiency: OperationalMetrics;
}

export interface DepotMetrics {
  depot: string;
  totalEvents: number;
  avgScore: number;
  resolutionRate: number;
  driverCount: number;
  eventsPerDriver: number;
  topRiskDrivers: string[];
  improvementOpportunities: string[];
}

export interface SafetyMetrics {
  safetyScore: number;
  incidentRate: number;
  severityIndex: number;
  complianceRate: number;
  proactiveIndicators: ProactiveIndicator[];
  leadingIndicators: LeadingIndicator[];
  laggingIndicators: LaggingIndicator[];
}

export interface ProactiveIndicator {
  name: string;
  value: number;
  threshold: number;
  trend: 'improving' | 'stable' | 'deteriorating';
  actionRequired: boolean;
}

export interface LeadingIndicator {
  name: string;
  current: number;
  target: number;
  variance: number;
  predictivePower: number;
}

export interface LaggingIndicator {
  name: string;
  current: number;
  previous: number;
  change: number;
  benchmark: number;
}

export interface OperationalMetrics {
  processingEfficiency: number;
  avgResolutionTime: number;
  workloadDistribution: { status: string; count: number; avgAge: number }[];
  resourceUtilization: number;
  automationOpportunities: string[];
}

export interface RiskAssessment {
  overallRisk: number;
  riskCategories: { category: string; risk: number; weight: number }[];
  riskTrends: TimeSeriesAnalysis[];
  mitigationStrategies: MitigationStrategy[];
  monitoringRecommendations: string[];
}

export interface MitigationStrategy {
  risk: string;
  strategy: string;
  priority: 'high' | 'medium' | 'low';
  estimatedImpact: number;
  implementationCost: 'low' | 'medium' | 'high';
  timeline: string;
}

export interface ExecutiveReport {
  reportPeriod: DateRange;
  executiveSummary: string;
  keyMetrics: KeyMetric[];
  trends: TrendSummary[];
  recommendations: ExecutiveRecommendation[];
  riskAssessment: RiskAssessment;
  carrierComparison: CarrierComparison;
  actionItems: ActionItem[];
}

export interface KeyMetric {
  name: string;
  current: number;
  previous: number;
  change: number;
  target?: number;
  status: 'on-track' | 'at-risk' | 'critical';
}

export interface TrendSummary {
  metric: string;
  direction: 'improving' | 'stable' | 'declining';
  magnitude: number;
  significance: 'high' | 'medium' | 'low';
  explanation: string;
}

export interface ExecutiveRecommendation {
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  impact: string;
  effort: 'low' | 'medium' | 'high';
  timeline: string;
  owner: string;
}

export interface CarrierComparison {
  stevemacs: CarrierSummary;
  greatSouthernFuels: CarrierSummary;
  keyDifferences: string[];
  bestPractices: string[];
}

export interface CarrierSummary {
  totalEvents: number;
  avgScore: number;
  resolutionRate: number;
  topStrengths: string[];
  improvementAreas: string[];
}

export interface ActionItem {
  id: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  owner: string;
  dueDate: string;
  status: 'pending' | 'in-progress' | 'completed';
  dependencies: string[];
}

export interface ExportOptions {
  format: 'csv' | 'xlsx' | 'pdf' | 'json';
  includeCharts: boolean;
  includeRawData: boolean;
  dateRange?: DateRange;
  filters?: LytxAnalyticsFilters;
}

export interface PredictiveAnalysis {
  forecastPeriod: number; // days
  predictedEvents: TimeSeriesAnalysis[];
  riskPredictions: { driver: string; riskScore: number; confidence: number }[];
  seasonalFactors: { month: string; multiplier: number }[];
  interventionRecommendations: InterventionRecommendation[];
}

export interface InterventionRecommendation {
  type: 'coaching' | 'training' | 'policy' | 'technology';
  target: string; // driver, depot, carrier
  description: string;
  expectedImpact: number;
  cost: number;
  roi: number;
}

/**
 * LYTX Analytics Service - Main Service Class
 */
export class LytxAnalyticsService {
  
  /**
   * Statistical Analysis Functions
   */
  
  static calculatePerformanceMetrics(scores: number[]): PerformanceMetrics {
    if (scores.length === 0) {
      return this.getEmptyMetrics();
    }

    const sorted = [...scores].sort((a, b) => a - b);
    const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const median = this.calculateMedian(sorted);
    const mode = this.calculateMode(scores);
    const standardDeviation = this.calculateStandardDeviation(scores, mean);
    
    return {
      mean: Math.round(mean * 100) / 100,
      median,
      mode,
      standardDeviation: Math.round(standardDeviation * 100) / 100,
      percentile25: this.calculatePercentile(sorted, 25),
      percentile75: this.calculatePercentile(sorted, 75),
      percentile90: this.calculatePercentile(sorted, 90),
      outliers: this.identifyOutliers(scores, mean, standardDeviation),
      trendDirection: this.determineTrendDirection(scores),
      confidenceInterval: this.calculateConfidenceInterval(mean, standardDeviation, scores.length)
    };
  }

  static async performTimeSeriesAnalysis(
    events: LytxHistoricalEvent[],
    period: 'daily' | 'weekly' | 'monthly' = 'monthly'
  ): Promise<TimeSeriesAnalysis[]> {
    const groupedData = this.groupEventsByPeriod(events, period);
    const timeSeries: TimeSeriesAnalysis[] = [];

    for (const [periodKey, periodEvents] of Object.entries(groupedData)) {
      const value = periodEvents.length;
      const avgScore = periodEvents.reduce((sum, e) => sum + e.score, 0) / periodEvents.length;
      
      timeSeries.push({
        period: periodKey,
        value,
        movingAverage: 0, // Will be calculated after full series
        seasonalIndex: 1,
        trendComponent: 0,
        cyclicalComponent: 0,
        irregularComponent: 0,
      });
    }

    // Calculate moving averages and decomposition
    return this.enhanceTimeSeriesData(timeSeries);
  }

  static async analyzeDriverPerformance(
    driverName: string,
    filters: LytxAnalyticsFilters = {}
  ): Promise<DriverPerformanceAnalysis | null> {
    const { data: events, error } = await supabase
      .from('lytx_safety_events')
      .select('*')
      .eq('driver_name', driverName)
      .neq('driver_name', 'Driver Unassigned');

    if (error || !events || events.length === 0) {
      return null;
    }

    const filteredEvents = this.applyFilters(events, filters);
    const scores = filteredEvents.map(e => e.score);
    const scoreMetrics = this.calculatePerformanceMetrics(scores);
    const eventTrend = await this.performTimeSeriesAnalysis(filteredEvents);
    const riskProfile = this.analyzeDriverRisk(filteredEvents);
    const coachingAnalysis = this.analyzeCoachingEffectiveness(filteredEvents);
    const benchmarkComparison = await this.getBenchmarkComparison(driverName, filteredEvents[0]?.carrier);

    return {
      driver: driverName,
      carrier: filteredEvents[0]?.carrier || 'Unknown',
      totalEvents: filteredEvents.length,
      avgScore: scoreMetrics.mean,
      scoreMetrics,
      eventTrend,
      riskProfile,
      coachingEffectiveness: coachingAnalysis,
      benchmarkComparison,
      recommendations: this.generateDriverRecommendations(riskProfile, coachingAnalysis, scoreMetrics)
    };
  }

  static async analyzeCarrierPerformance(
    carrier: 'Stevemacs' | 'Great Southern Fuels',
    filters: LytxAnalyticsFilters = {}
  ): Promise<CarrierAnalysis> {
    const { data: events, error } = await supabase
      .from('lytx_safety_events')
      .select('*')
      .eq('carrier', carrier);

    if (error || !events) {
      throw new Error(`Failed to fetch carrier data: ${error?.message}`);
    }

    const filteredEvents = this.applyFilters(events, filters);
    const totalEvents = filteredEvents.length;
    const avgScore = filteredEvents.reduce((sum, e) => sum + e.score, 0) / totalEvents;
    const resolvedEvents = filteredEvents.filter(e => e.status === 'Resolved').length;
    const resolutionRate = (resolvedEvents / totalEvents) * 100;

    const topTriggers = this.analyzeTopTriggers(filteredEvents);
    const depotComparison = await this.analyzeDepotMetrics(carrier, filteredEvents);
    const monthlyTrends = await this.performTimeSeriesAnalysis(filteredEvents);
    const safetyMetrics = this.calculateSafetyMetrics(filteredEvents);
    const operationalEfficiency = this.calculateOperationalMetrics(filteredEvents);

    return {
      carrier,
      totalEvents,
      avgScore: Math.round(avgScore * 100) / 100,
      resolutionRate: Math.round(resolutionRate * 100) / 100,
      topTriggers,
      depotComparison,
      monthlyTrends,
      safetyMetrics,
      operationalEfficiency
    };
  }

  static async generateExecutiveReport(
    filters: LytxAnalyticsFilters = {},
    reportPeriod?: DateRange
  ): Promise<ExecutiveReport> {
    const dateRange = reportPeriod || this.getDefaultReportPeriod();
    const filtersWithDate = { ...filters, dateRange };

    const { data: events, error } = await supabase
      .from('lytx_safety_events')
      .select('*');

    if (error || !events) {
      throw new Error(`Failed to fetch data for executive report: ${error?.message}`);
    }

    const filteredEvents = this.applyFilters(events, filtersWithDate);
    
    // Generate comprehensive analysis
    const keyMetrics = await this.calculateKeyMetrics(filteredEvents);
    const trends = await this.analyzeTrends(filteredEvents);
    const riskAssessment = await this.performRiskAssessment(filteredEvents);
    const carrierComparison = await this.compareCarriers(filteredEvents);
    const recommendations = this.generateExecutiveRecommendations(filteredEvents, trends, riskAssessment);
    const actionItems = this.generateActionItems(recommendations);

    return {
      reportPeriod: dateRange,
      executiveSummary: this.generateExecutiveSummary(keyMetrics, trends, riskAssessment),
      keyMetrics,
      trends,
      recommendations,
      riskAssessment,
      carrierComparison,
      actionItems
    };
  }

  static async predictFutureEvents(
    forecastDays: number = 30,
    filters: LytxAnalyticsFilters = {}
  ): Promise<PredictiveAnalysis> {
    const { data: events, error } = await supabase
      .from('lytx_safety_events')
      .select('*')
      .order('event_datetime', { ascending: true });

    if (error || !events) {
      throw new Error(`Failed to fetch data for predictions: ${error?.message}`);
    }

    const filteredEvents = this.applyFilters(events, filters);
    const timeSeries = await this.performTimeSeriesAnalysis(filteredEvents);
    
    // Apply forecasting algorithm (simplified exponential smoothing)
    const predictedEvents = this.forecastTimeSeries(timeSeries, forecastDays);
    const riskPredictions = await this.predictDriverRisks(filteredEvents);
    const seasonalFactors = this.calculateSeasonalFactors(filteredEvents);
    const interventionRecommendations = this.generateInterventionRecommendations(riskPredictions);

    return {
      forecastPeriod: forecastDays,
      predictedEvents,
      riskPredictions,
      seasonalFactors,
      interventionRecommendations
    };
  }

  /**
   * Export and Reporting Functions
   */

  static async exportData(options: ExportOptions): Promise<Blob> {
    const { data: events, error } = await supabase
      .from('lytx_safety_events')
      .select('*');

    if (error || !events) {
      throw new Error(`Failed to fetch data for export: ${error?.message}`);
    }

    let filteredEvents = events;
    if (options.filters) {
      filteredEvents = this.applyFilters(events, options.filters);
    }

    if (options.dateRange) {
      filteredEvents = filteredEvents.filter(e => 
        e.event_datetime >= options.dateRange!.startDate && 
        e.event_datetime <= options.dateRange!.endDate
      );
    }

    switch (options.format) {
      case 'csv':
        return this.exportToCsv(filteredEvents);
      case 'xlsx':
        return this.exportToExcel(filteredEvents, options.includeCharts);
      case 'pdf':
        return this.exportToPdf(filteredEvents, options.includeCharts);
      case 'json':
        return this.exportToJson(filteredEvents, options.includeRawData);
      default:
        throw new Error(`Unsupported export format: ${options.format}`);
    }
  }

  /**
   * Private Helper Methods
   */

  private static getEmptyMetrics(): PerformanceMetrics {
    return {
      mean: 0,
      median: 0,
      mode: null,
      standardDeviation: 0,
      percentile25: 0,
      percentile75: 0,
      percentile90: 0,
      outliers: [],
      trendDirection: 'stable',
      confidenceInterval: { lower: 0, upper: 0 }
    };
  }

  private static calculateMedian(sortedValues: number[]): number {
    const mid = Math.floor(sortedValues.length / 2);
    return sortedValues.length % 2 === 0
      ? (sortedValues[mid - 1] + sortedValues[mid]) / 2
      : sortedValues[mid];
  }

  private static calculateMode(values: number[]): number | null {
    const frequency: Record<number, number> = {};
    let maxFreq = 0;
    let mode: number | null = null;

    for (const value of values) {
      frequency[value] = (frequency[value] || 0) + 1;
      if (frequency[value] > maxFreq) {
        maxFreq = frequency[value];
        mode = value;
      }
    }

    return maxFreq > 1 ? mode : null;
  }

  private static calculateStandardDeviation(values: number[], mean: number): number {
    const variance = values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  private static calculatePercentile(sortedValues: number[], percentile: number): number {
    const index = (percentile / 100) * (sortedValues.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;

    return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
  }

  private static identifyOutliers(values: number[], mean: number, stdDev: number): number[] {
    const threshold = 2 * stdDev;
    return values.filter(value => Math.abs(value - mean) > threshold);
  }

  private static determineTrendDirection(values: number[]): 'improving' | 'stable' | 'declining' {
    if (values.length < 2) return 'stable';
    
    const midpoint = Math.floor(values.length / 2);
    const firstHalf = values.slice(0, midpoint);
    const secondHalf = values.slice(midpoint);
    
    const firstAvg = firstHalf.reduce((sum, v) => sum + v, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, v) => sum + v, 0) / secondHalf.length;
    
    const difference = secondAvg - firstAvg;
    const threshold = 0.1; // 10% threshold for significance
    
    if (Math.abs(difference) < threshold) return 'stable';
    return difference < 0 ? 'improving' : 'declining'; // Lower scores are better in LYTX
  }

  private static calculateConfidenceInterval(
    mean: number, 
    stdDev: number, 
    sampleSize: number, 
    confidence: number = 0.95
  ): { lower: number; upper: number } {
    const zScore = confidence === 0.95 ? 1.96 : 2.58; // 95% or 99% confidence
    const marginOfError = zScore * (stdDev / Math.sqrt(sampleSize));
    
    return {
      lower: Math.round((mean - marginOfError) * 100) / 100,
      upper: Math.round((mean + marginOfError) * 100) / 100
    };
  }

  private static groupEventsByPeriod(
    events: LytxHistoricalEvent[], 
    period: 'daily' | 'weekly' | 'monthly'
  ): Record<string, LytxHistoricalEvent[]> {
    const grouped: Record<string, LytxHistoricalEvent[]> = {};

    for (const event of events) {
      const date = new Date(event.event_datetime);
      let key: string;

      switch (period) {
        case 'daily':
          key = date.toISOString().split('T')[0];
          break;
        case 'weekly':
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          key = weekStart.toISOString().split('T')[0];
          break;
        case 'monthly':
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          break;
      }

      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(event);
    }

    return grouped;
  }

  private static enhanceTimeSeriesData(timeSeries: TimeSeriesAnalysis[]): TimeSeriesAnalysis[] {
    // Calculate moving averages
    const windowSize = Math.min(3, timeSeries.length);
    
    return timeSeries.map((point, index) => {
      const start = Math.max(0, index - Math.floor(windowSize / 2));
      const end = Math.min(timeSeries.length, start + windowSize);
      const window = timeSeries.slice(start, end);
      
      const movingAverage = window.reduce((sum, p) => sum + p.value, 0) / window.length;
      
      return {
        ...point,
        movingAverage: Math.round(movingAverage * 100) / 100,
        // Simplified trend component (could be enhanced with proper decomposition)
        trendComponent: index > 0 ? point.value - timeSeries[index - 1].value : 0
      };
    });
  }

  private static applyFilters(events: LytxHistoricalEvent[], filters: LytxAnalyticsFilters): LytxHistoricalEvent[] {
    return events.filter(event => {
      if (filters.carrier && filters.carrier !== 'All' && event.carrier !== filters.carrier) {
        return false;
      }
      
      if (filters.depot && event.depot !== filters.depot) {
        return false;
      }
      
      if (filters.status && filters.status !== 'All' && event.status !== filters.status) {
        return false;
      }
      
      if (filters.eventType && filters.eventType !== 'All' && event.event_type !== filters.eventType) {
        return false;
      }
      
      if (filters.dateRange) {
        if (event.event_datetime < filters.dateRange.startDate || 
            event.event_datetime > filters.dateRange.endDate) {
          return false;
        }
      }
      
      if (filters.minScore !== undefined && event.score < filters.minScore) {
        return false;
      }
      
      if (filters.maxScore !== undefined && event.score > filters.maxScore) {
        return false;
      }
      
      if (filters.excluded !== undefined && event.excluded !== filters.excluded) {
        return false;
      }

      return true;
    });
  }

  private static analyzeDriverRisk(events: LytxHistoricalEvent[]): DriverRiskProfile {
    const totalEvents = events.length;
    const avgScore = events.reduce((sum, e) => sum + e.score, 0) / totalEvents;
    const highRiskEvents = events.filter(e => e.score > 75).length;
    const recentEvents = events.filter(e => 
      new Date(e.event_datetime) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    ).length;

    // Risk calculation based on frequency, severity, and recency
    const frequencyRisk = Math.min((totalEvents / 10) * 20, 100); // 10+ events = high risk
    const severityRisk = Math.min((avgScore / 100) * 100, 100);
    const recencyRisk = Math.min((recentEvents / 5) * 30, 100);
    
    const riskScore = (frequencyRisk + severityRisk + recencyRisk) / 3;
    
    let riskLevel: 'low' | 'medium' | 'high' | 'critical';
    if (riskScore < 25) riskLevel = 'low';
    else if (riskScore < 50) riskLevel = 'medium';
    else if (riskScore < 75) riskLevel = 'high';
    else riskLevel = 'critical';

    const riskFactors = this.identifyRiskFactors(events);
    const timePatterns = this.analyzeTimePatterns(events);
    const locationPatterns = this.analyzeLocationPatterns(events);
    const behavioralPatterns = this.analyzeBehavioralPatterns(events);

    return {
      riskLevel,
      riskScore: Math.round(riskScore),
      riskFactors,
      frequencyRisk: Math.round(frequencyRisk),
      severityRisk: Math.round(severityRisk),
      behavioralPatterns,
      timePatterns,
      locationPatterns
    };
  }

  private static identifyRiskFactors(events: LytxHistoricalEvent[]): string[] {
    const factors: string[] = [];
    const avgScore = events.reduce((sum, e) => sum + e.score, 0) / events.length;
    
    if (avgScore > 70) factors.push('High average safety score');
    if (events.length > 15) factors.push('High frequency of events');
    
    const triggers = events.map(e => e.trigger);
    const triggerCounts = triggers.reduce((acc, trigger) => {
      acc[trigger] = (acc[trigger] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const maxTrigger = Object.entries(triggerCounts).reduce((max, [trigger, count]) => 
      count > max.count ? { trigger, count } : max, { trigger: '', count: 0 });
    
    if (maxTrigger.count > events.length * 0.4) {
      factors.push(`Recurring ${maxTrigger.trigger} incidents`);
    }
    
    const unresolvedEvents = events.filter(e => e.status !== 'Resolved').length;
    if (unresolvedEvents > events.length * 0.3) {
      factors.push('High rate of unresolved events');
    }

    return factors;
  }

  private static analyzeTimePatterns(events: LytxHistoricalEvent[]): { hour: number; frequency: number }[] {
    const hourCounts: Record<number, number> = {};
    
    events.forEach(event => {
      const hour = new Date(event.event_datetime).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });

    return Object.entries(hourCounts).map(([hour, frequency]) => ({
      hour: parseInt(hour),
      frequency
    })).sort((a, b) => b.frequency - a.frequency);
  }

  private static analyzeLocationPatterns(events: LytxHistoricalEvent[]): { depot: string; frequency: number }[] {
    const depotCounts: Record<string, number> = {};
    
    events.forEach(event => {
      depotCounts[event.depot] = (depotCounts[event.depot] || 0) + 1;
    });

    return Object.entries(depotCounts).map(([depot, frequency]) => ({
      depot,
      frequency
    })).sort((a, b) => b.frequency - a.frequency);
  }

  private static analyzeBehavioralPatterns(events: LytxHistoricalEvent[]): string[] {
    const behaviors: Record<string, number> = {};
    
    events.forEach(event => {
      if (event.behaviors) {
        const behaviorList = event.behaviors.split(',').map(b => b.trim());
        behaviorList.forEach(behavior => {
          behaviors[behavior] = (behaviors[behavior] || 0) + 1;
        });
      }
    });

    return Object.entries(behaviors)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([behavior]) => behavior);
  }

  private static analyzeCoachingEffectiveness(events: LytxHistoricalEvent[]): CoachingAnalysis {
    const resolvedEvents = events.filter(e => e.status === 'Resolved');
    const faceToFaceEvents = events.filter(e => e.status === 'Face-To-Face');
    
    const coachingRequired = events.filter(e => e.event_type === 'Coachable').length;
    const coachingCompleted = resolvedEvents.length;
    
    // Calculate average time to resolution
    const resolutionTimes = resolvedEvents
      .filter(e => e.assigned_date && e.reviewed_by)
      .map(e => {
        const assigned = new Date(e.assigned_date!);
        const eventDate = new Date(e.event_datetime);
        return Math.abs(assigned.getTime() - eventDate.getTime()) / (1000 * 60 * 60 * 24);
      });
    
    const avgTimeToResolution = resolutionTimes.length > 0 
      ? resolutionTimes.reduce((sum, time) => sum + time, 0) / resolutionTimes.length 
      : 0;

    // Calculate effectiveness (improvement in subsequent events)
    const effectiveness = coachingCompleted > 0 ? (coachingCompleted / coachingRequired) * 100 : 0;
    
    return {
      coachingRequired: coachingRequired > 0,
      coachingCompleted: coachingCompleted > 0,
      effectiveness: Math.round(effectiveness),
      timeToResolution: Math.round(avgTimeToResolution),
      recurrenceRate: 0, // Would need temporal analysis of post-coaching events
      recommendedApproach: effectiveness > 80 ? 'Continue current approach' : 
                          effectiveness > 50 ? 'Enhance coaching methods' : 'Review coaching strategy'
    };
  }

  private static async getBenchmarkComparison(
    driverName: string, 
    carrier: string
  ): Promise<BenchmarkComparison> {
    // This would typically fetch industry benchmarks from external sources
    // For now, we'll calculate internal benchmarks
    
    const { data: allDrivers, error } = await supabase
      .from('lytx_safety_events')
      .select('driver_name, score')
      .neq('driver_name', 'Driver Unassigned');

    if (error || !allDrivers) {
      return {
        peerGroupAvg: 0,
        industryAvg: 45, // Industry average placeholder
        companyAvg: 0,
        percentileRank: 50,
        performanceGap: 0,
        improvementPotential: 0
      };
    }

    const driverEvents = allDrivers.filter(e => e.driver_name === driverName);
    const carrierEvents = allDrivers.filter(e => e.driver_name.includes(carrier) || carrier.includes('Stevemacs'));
    
    const driverAvg = driverEvents.reduce((sum, e) => sum + e.score, 0) / driverEvents.length;
    const carrierAvg = carrierEvents.reduce((sum, e) => sum + e.score, 0) / carrierEvents.length;
    const companyAvg = allDrivers.reduce((sum, e) => sum + e.score, 0) / allDrivers.length;

    // Calculate percentile rank
    const allScores = allDrivers.map(e => e.score).sort((a, b) => a - b);
    const rank = allScores.findIndex(score => score >= driverAvg) / allScores.length * 100;

    return {
      peerGroupAvg: Math.round(carrierAvg * 100) / 100,
      industryAvg: 45,
      companyAvg: Math.round(companyAvg * 100) / 100,
      percentileRank: Math.round(rank),
      performanceGap: Math.round((driverAvg - carrierAvg) * 100) / 100,
      improvementPotential: Math.max(0, Math.round((driverAvg - 30) * 100) / 100) // Assume 30 is excellent
    };
  }

  private static generateDriverRecommendations(
    riskProfile: DriverRiskProfile,
    coachingAnalysis: CoachingAnalysis,
    scoreMetrics: PerformanceMetrics
  ): string[] {
    const recommendations: string[] = [];

    if (riskProfile.riskLevel === 'critical' || riskProfile.riskLevel === 'high') {
      recommendations.push('Immediate coaching intervention required');
      recommendations.push('Consider additional training on identified risk behaviors');
    }

    if (coachingAnalysis.effectiveness < 50) {
      recommendations.push('Review and enhance coaching methodology');
      recommendations.push('Consider peer mentoring program');
    }

    if (scoreMetrics.trendDirection === 'declining') {
      recommendations.push('Monitor closely for continued deterioration');
      recommendations.push('Investigate potential external factors affecting performance');
    }

    if (riskProfile.timePatterns.length > 0) {
      const peakHour = riskProfile.timePatterns[0];
      recommendations.push(`Focus coaching on ${peakHour.hour}:00 hour incidents (highest frequency)`);
    }

    if (recommendations.length === 0) {
      recommendations.push('Continue monitoring current performance levels');
      recommendations.push('Consider recognition for maintaining good safety standards');
    }

    return recommendations;
  }

  private static analyzeTopTriggers(events: LytxHistoricalEvent[]): { trigger: string; count: number; avgScore: number }[] {
    const triggerStats: Record<string, { count: number; totalScore: number }> = {};

    events.forEach(event => {
      const trigger = event.trigger;
      if (!triggerStats[trigger]) {
        triggerStats[trigger] = { count: 0, totalScore: 0 };
      }
      triggerStats[trigger].count++;
      triggerStats[trigger].totalScore += event.score;
    });

    return Object.entries(triggerStats)
      .map(([trigger, stats]) => ({
        trigger,
        count: stats.count,
        avgScore: Math.round((stats.totalScore / stats.count) * 100) / 100
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  private static async analyzeDepotMetrics(
    carrier: string,
    events: LytxHistoricalEvent[]
  ): Promise<DepotMetrics[]> {
    const depotStats: Record<string, {
      events: LytxHistoricalEvent[];
      drivers: Set<string>;
    }> = {};

    events.forEach(event => {
      const depot = event.depot;
      if (!depotStats[depot]) {
        depotStats[depot] = { events: [], drivers: new Set() };
      }
      depotStats[depot].events.push(event);
      if (event.driver_name !== 'Driver Unassigned') {
        depotStats[depot].drivers.add(event.driver_name);
      }
    });

    return Object.entries(depotStats).map(([depot, stats]) => {
      const totalEvents = stats.events.length;
      const avgScore = stats.events.reduce((sum, e) => sum + e.score, 0) / totalEvents;
      const resolvedEvents = stats.events.filter(e => e.status === 'Resolved').length;
      const resolutionRate = (resolvedEvents / totalEvents) * 100;
      const driverCount = stats.drivers.size;
      const eventsPerDriver = totalEvents / Math.max(driverCount, 1);

      // Identify top risk drivers in this depot
      const driverEventCounts: Record<string, number> = {};
      stats.events.forEach(e => {
        if (e.driver_name !== 'Driver Unassigned') {
          driverEventCounts[e.driver_name] = (driverEventCounts[e.driver_name] || 0) + 1;
        }
      });

      const topRiskDrivers = Object.entries(driverEventCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([driver]) => driver);

      return {
        depot,
        totalEvents,
        avgScore: Math.round(avgScore * 100) / 100,
        resolutionRate: Math.round(resolutionRate * 100) / 100,
        driverCount,
        eventsPerDriver: Math.round(eventsPerDriver * 100) / 100,
        topRiskDrivers,
        improvementOpportunities: this.generateDepotImprovementOpportunities(stats.events)
      };
    }).sort((a, b) => b.totalEvents - a.totalEvents);
  }

  private static generateDepotImprovementOpportunities(events: LytxHistoricalEvent[]): string[] {
    const opportunities: string[] = [];
    
    const unresolvedRate = events.filter(e => e.status === 'New').length / events.length;
    if (unresolvedRate > 0.3) {
      opportunities.push('Improve event resolution processes');
    }

    const avgScore = events.reduce((sum, e) => sum + e.score, 0) / events.length;
    if (avgScore > 60) {
      opportunities.push('Focus on reducing high-risk behaviors');
    }

    const unassignedRate = events.filter(e => e.driver_name === 'Driver Unassigned').length / events.length;
    if (unassignedRate > 0.2) {
      opportunities.push('Improve driver identification and assignment');
    }

    return opportunities;
  }

  private static calculateSafetyMetrics(events: LytxHistoricalEvent[]): SafetyMetrics {
    const totalEvents = events.length;
    const avgScore = events.reduce((sum, e) => sum + e.score, 0) / totalEvents;
    const highRiskEvents = events.filter(e => e.score > 70).length;
    const resolvedEvents = events.filter(e => e.status === 'Resolved').length;

    const safetyScore = Math.max(0, 100 - avgScore); // Invert score (higher is better)
    const incidentRate = (totalEvents / 30) * 100; // Events per month (assuming 30-day period)
    const severityIndex = (highRiskEvents / totalEvents) * 100;
    const complianceRate = (resolvedEvents / totalEvents) * 100;

    return {
      safetyScore: Math.round(safetyScore),
      incidentRate: Math.round(incidentRate * 100) / 100,
      severityIndex: Math.round(severityIndex),
      complianceRate: Math.round(complianceRate),
      proactiveIndicators: [],
      leadingIndicators: [],
      laggingIndicators: []
    };
  }

  private static calculateOperationalMetrics(events: LytxHistoricalEvent[]): OperationalMetrics {
    const resolvedEvents = events.filter(e => e.status === 'Resolved');
    const avgResolutionTime = resolvedEvents.length > 0 ? 
      resolvedEvents.reduce((sum, e) => {
        const eventDate = new Date(e.event_datetime);
        const now = new Date();
        return sum + (now.getTime() - eventDate.getTime()) / (1000 * 60 * 60 * 24);
      }, 0) / resolvedEvents.length : 0;

    const statusDistribution = {
      'New': events.filter(e => e.status === 'New').length,
      'Face-To-Face': events.filter(e => e.status === 'Face-To-Face').length,
      'FYI Notify': events.filter(e => e.status === 'FYI Notify').length,
      'Resolved': events.filter(e => e.status === 'Resolved').length,
    };

    const workloadDistribution = Object.entries(statusDistribution).map(([status, count]) => ({
      status,
      count,
      avgAge: 0 // Would need more detailed analysis
    }));

    const processingEfficiency = (resolvedEvents.length / events.length) * 100;
    const resourceUtilization = Math.min(processingEfficiency, 100);

    return {
      processingEfficiency: Math.round(processingEfficiency),
      avgResolutionTime: Math.round(avgResolutionTime),
      workloadDistribution,
      resourceUtilization: Math.round(resourceUtilization),
      automationOpportunities: this.identifyAutomationOpportunities(events)
    };
  }

  private static identifyAutomationOpportunities(events: LytxHistoricalEvent[]): string[] {
    const opportunities: string[] = [];
    
    const unassignedEvents = events.filter(e => e.driver_name === 'Driver Unassigned').length;
    if (unassignedEvents > events.length * 0.2) {
      opportunities.push('Automated driver assignment based on vehicle/device matching');
    }

    const lowRiskEvents = events.filter(e => e.score < 30).length;
    if (lowRiskEvents > events.length * 0.3) {
      opportunities.push('Automated closure of low-risk events');
    }

    const duplicateTriggers = this.analyzeTopTriggers(events);
    if (duplicateTriggers.length > 0 && duplicateTriggers[0].count > events.length * 0.4) {
      opportunities.push('Automated categorization and routing for common triggers');
    }

    return opportunities;
  }

  private static getDefaultReportPeriod(): DateRange {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    return {
      startDate: thirtyDaysAgo.toISOString(),
      endDate: now.toISOString()
    };
  }

  private static async calculateKeyMetrics(events: LytxHistoricalEvent[]): Promise<KeyMetric[]> {
    const totalEvents = events.length;
    const avgScore = events.reduce((sum, e) => sum + e.score, 0) / totalEvents;
    const resolutionRate = (events.filter(e => e.status === 'Resolved').length / totalEvents) * 100;
    const highRiskEvents = events.filter(e => e.score > 70).length;

    return [
      {
        name: 'Total Safety Events',
        current: totalEvents,
        previous: 0, // Would need historical comparison
        change: 0,
        target: Math.round(totalEvents * 0.8), // 20% reduction target
        status: 'on-track'
      },
      {
        name: 'Average Safety Score',
        current: Math.round(avgScore),
        previous: 0,
        change: 0,
        target: 40,
        status: avgScore > 50 ? 'at-risk' : 'on-track'
      },
      {
        name: 'Resolution Rate (%)',
        current: Math.round(resolutionRate),
        previous: 0,
        change: 0,
        target: 90,
        status: resolutionRate < 80 ? 'at-risk' : 'on-track'
      },
      {
        name: 'High Risk Events',
        current: highRiskEvents,
        previous: 0,
        change: 0,
        target: Math.round(highRiskEvents * 0.5),
        status: 'at-risk'
      }
    ];
  }

  private static async analyzeTrends(events: LytxHistoricalEvent[]): Promise<TrendSummary[]> {
    // Simplified trend analysis - would be enhanced with proper time series analysis
    const timeSeries = await this.performTimeSeriesAnalysis(events);
    
    if (timeSeries.length < 2) {
      return [];
    }

    const latest = timeSeries[timeSeries.length - 1];
    const previous = timeSeries[timeSeries.length - 2];
    const change = ((latest.value - previous.value) / previous.value) * 100;

    return [
      {
        metric: 'Monthly Event Volume',
        direction: change > 5 ? 'declining' : change < -5 ? 'improving' : 'stable',
        magnitude: Math.abs(change),
        significance: Math.abs(change) > 20 ? 'high' : Math.abs(change) > 10 ? 'medium' : 'low',
        explanation: `Event volume has ${change > 0 ? 'increased' : 'decreased'} by ${Math.abs(change).toFixed(1)}% from previous period`
      }
    ];
  }

  private static async performRiskAssessment(events: LytxHistoricalEvent[]): Promise<RiskAssessment> {
    const totalEvents = events.length;
    const avgScore = events.reduce((sum, e) => sum + e.score, 0) / totalEvents;
    const highRiskEvents = events.filter(e => e.score > 70).length;
    const unresolvedEvents = events.filter(e => e.status === 'New').length;

    const riskCategories = [
      { category: 'Frequency Risk', risk: Math.min((totalEvents / 20) * 100, 100), weight: 0.3 },
      { category: 'Severity Risk', risk: Math.min(avgScore, 100), weight: 0.4 },
      { category: 'Operational Risk', risk: (unresolvedEvents / totalEvents) * 100, weight: 0.3 }
    ];

    const overallRisk = riskCategories.reduce((sum, cat) => sum + (cat.risk * cat.weight), 0);

    return {
      overallRisk: Math.round(overallRisk),
      riskCategories,
      riskTrends: await this.performTimeSeriesAnalysis(events),
      mitigationStrategies: this.generateMitigationStrategies(overallRisk, riskCategories),
      monitoringRecommendations: [
        'Monitor high-risk drivers weekly',
        'Review depot performance monthly',
        'Analyze trigger patterns quarterly',
        'Assess coaching effectiveness bi-annually'
      ]
    };
  }

  private static generateMitigationStrategies(
    overallRisk: number, 
    riskCategories: { category: string; risk: number; weight: number }[]
  ): MitigationStrategy[] {
    const strategies: MitigationStrategy[] = [];

    if (overallRisk > 70) {
      strategies.push({
        risk: 'Critical overall risk level',
        strategy: 'Implement emergency safety intervention program',
        priority: 'high',
        estimatedImpact: 40,
        implementationCost: 'high',
        timeline: 'Immediate - 30 days'
      });
    }

    const highestRisk = riskCategories.reduce((max, cat) => cat.risk > max.risk ? cat : max);
    
    if (highestRisk.category === 'Frequency Risk' && highestRisk.risk > 50) {
      strategies.push({
        risk: 'High event frequency',
        strategy: 'Enhanced driver training and awareness program',
        priority: 'high',
        estimatedImpact: 30,
        implementationCost: 'medium',
        timeline: '60-90 days'
      });
    }

    return strategies;
  }

  private static async compareCarriers(events: LytxHistoricalEvent[]): Promise<CarrierComparison> {
    const stevemacsEvents = events.filter(e => e.carrier === 'Stevemacs');
    const gsfEvents = events.filter(e => e.carrier === 'Great Southern Fuels');

    const stevemacsSummary = this.generateCarrierSummary(stevemacsEvents);
    const gsfSummary = this.generateCarrierSummary(gsfEvents);

    return {
      stevemacs: stevemacsSummary,
      greatSouthernFuels: gsfSummary,
      keyDifferences: this.identifyCarrierDifferences(stevemacsSummary, gsfSummary),
      bestPractices: this.identifyBestPractices(stevemacsSummary, gsfSummary)
    };
  }

  private static generateCarrierSummary(events: LytxHistoricalEvent[]): CarrierSummary {
    const totalEvents = events.length;
    const avgScore = events.reduce((sum, e) => sum + e.score, 0) / totalEvents || 0;
    const resolvedEvents = events.filter(e => e.status === 'Resolved').length;
    const resolutionRate = totalEvents > 0 ? (resolvedEvents / totalEvents) * 100 : 0;

    return {
      totalEvents,
      avgScore: Math.round(avgScore * 100) / 100,
      resolutionRate: Math.round(resolutionRate * 100) / 100,
      topStrengths: [], // Would be enhanced with more detailed analysis
      improvementAreas: []
    };
  }

  private static identifyCarrierDifferences(
    stevemacs: CarrierSummary, 
    gsf: CarrierSummary
  ): string[] {
    const differences: string[] = [];
    
    const eventDiff = Math.abs(stevemacs.totalEvents - gsf.totalEvents);
    if (eventDiff > 10) {
      const higher = stevemacs.totalEvents > gsf.totalEvents ? 'Stevemacs' : 'Great Southern Fuels';
      differences.push(`${higher} has significantly more safety events (${eventDiff} difference)`);
    }

    const scoreDiff = Math.abs(stevemacs.avgScore - gsf.avgScore);
    if (scoreDiff > 5) {
      const higher = stevemacs.avgScore > gsf.avgScore ? 'Stevemacs' : 'Great Southern Fuels';
      differences.push(`${higher} has higher average safety scores (${scoreDiff.toFixed(1)} point difference)`);
    }

    return differences;
  }

  private static identifyBestPractices(
    stevemacs: CarrierSummary, 
    gsf: CarrierSummary
  ): string[] {
    const practices: string[] = [];
    
    if (stevemacs.resolutionRate > gsf.resolutionRate + 10) {
      practices.push('Apply Stevemacs resolution processes to Great Southern Fuels');
    } else if (gsf.resolutionRate > stevemacs.resolutionRate + 10) {
      practices.push('Apply Great Southern Fuels resolution processes to Stevemacs');
    }

    if (stevemacs.avgScore < gsf.avgScore - 5) {
      practices.push('Share Stevemacs safety practices with Great Southern Fuels');
    } else if (gsf.avgScore < stevemacs.avgScore - 5) {
      practices.push('Share Great Southern Fuels safety practices with Stevemacs');
    }

    return practices;
  }

  private static generateExecutiveRecommendations(
    events: LytxHistoricalEvent[],
    trends: TrendSummary[],
    riskAssessment: RiskAssessment
  ): ExecutiveRecommendation[] {
    const recommendations: ExecutiveRecommendation[] = [];

    if (riskAssessment.overallRisk > 70) {
      recommendations.push({
        title: 'Implement Emergency Safety Protocol',
        description: 'Overall risk level is critical and requires immediate intervention',
        priority: 'high',
        impact: 'Reduce safety incidents by 40-50%',
        effort: 'high',
        timeline: '30 days',
        owner: 'Safety Manager'
      });
    }

    const unassignedEvents = events.filter(e => e.driver_name === 'Driver Unassigned').length;
    if (unassignedEvents > events.length * 0.2) {
      recommendations.push({
        title: 'Improve Driver Assignment Process',
        description: 'High percentage of unassigned events impacts coaching effectiveness',
        priority: 'medium',
        impact: 'Improve coaching reach by 25-30%',
        effort: 'medium',
        timeline: '60 days',
        owner: 'Operations Manager'
      });
    }

    return recommendations;
  }

  private static generateActionItems(recommendations: ExecutiveRecommendation[]): ActionItem[] {
    return recommendations.map((rec, index) => ({
      id: `action-${index + 1}`,
      description: rec.description,
      priority: rec.priority,
      owner: rec.owner,
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
      status: 'pending' as const,
      dependencies: []
    }));
  }

  private static generateExecutiveSummary(
    keyMetrics: KeyMetric[],
    trends: TrendSummary[],
    riskAssessment: RiskAssessment
  ): string {
    const totalEvents = keyMetrics.find(m => m.name === 'Total Safety Events')?.current || 0;
    const avgScore = keyMetrics.find(m => m.name === 'Average Safety Score')?.current || 0;
    const resolutionRate = keyMetrics.find(m => m.name === 'Resolution Rate (%)')?.current || 0;

    return `Safety Performance Summary: ${totalEvents} total events recorded with an average safety score of ${avgScore}. ` +
           `Current resolution rate stands at ${resolutionRate}%. Overall risk assessment indicates ${riskAssessment.overallRisk > 70 ? 'high' : riskAssessment.overallRisk > 40 ? 'moderate' : 'low'} risk levels requiring ` +
           `${riskAssessment.overallRisk > 70 ? 'immediate' : 'ongoing'} attention. Key focus areas include driver coaching effectiveness, ` +
           `event resolution processes, and behavioral pattern analysis.`;
  }

  private static forecastTimeSeries(
    timeSeries: TimeSeriesAnalysis[], 
    forecastDays: number
  ): TimeSeriesAnalysis[] {
    // Simplified exponential smoothing forecast
    if (timeSeries.length < 2) return [];

    const alpha = 0.3; // Smoothing parameter
    const forecasts: TimeSeriesAnalysis[] = [];
    const latest = timeSeries[timeSeries.length - 1];
    const trend = timeSeries.length > 1 ? 
      timeSeries[timeSeries.length - 1].value - timeSeries[timeSeries.length - 2].value : 0;

    for (let i = 1; i <= Math.ceil(forecastDays / 30); i++) {
      const forecast = latest.value + (trend * i);
      const date = new Date();
      date.setMonth(date.getMonth() + i);
      
      forecasts.push({
        period: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
        value: Math.max(0, Math.round(forecast)),
        movingAverage: forecast,
        seasonalIndex: 1,
        trendComponent: trend,
        cyclicalComponent: 0,
        irregularComponent: 0,
        forecast: Math.max(0, Math.round(forecast)),
        confidenceBand: {
          upper: Math.max(0, Math.round(forecast * 1.2)),
          lower: Math.max(0, Math.round(forecast * 0.8))
        }
      });
    }

    return forecasts;
  }

  private static async predictDriverRisks(events: LytxHistoricalEvent[]): Promise<{ driver: string; riskScore: number; confidence: number }[]> {
    const driverStats: Record<string, { events: LytxHistoricalEvent[]; avgScore: number }> = {};

    events.forEach(event => {
      if (event.driver_name !== 'Driver Unassigned') {
        if (!driverStats[event.driver_name]) {
          driverStats[event.driver_name] = { events: [], avgScore: 0 };
        }
        driverStats[event.driver_name].events.push(event);
      }
    });

    return Object.entries(driverStats).map(([driver, stats]) => {
      const totalEvents = stats.events.length;
      const avgScore = stats.events.reduce((sum, e) => sum + e.score, 0) / totalEvents;
      const recentEvents = stats.events.filter(e => 
        new Date(e.event_datetime) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      ).length;

      const riskScore = (avgScore * 0.6) + (totalEvents * 2) + (recentEvents * 5);
      const confidence = Math.min(totalEvents / 10, 1) * 100; // More events = higher confidence

      return {
        driver,
        riskScore: Math.round(riskScore),
        confidence: Math.round(confidence)
      };
    }).sort((a, b) => b.riskScore - a.riskScore);
  }

  private static calculateSeasonalFactors(events: LytxHistoricalEvent[]): { month: string; multiplier: number }[] {
    const monthlyEvents: Record<string, number> = {};
    
    events.forEach(event => {
      const date = new Date(event.event_datetime);
      const month = date.toLocaleString('default', { month: 'long' });
      monthlyEvents[month] = (monthlyEvents[month] || 0) + 1;
    });

    const avgMonthlyEvents = Object.values(monthlyEvents).reduce((sum, count) => sum + count, 0) / 12;
    
    return Object.entries(monthlyEvents).map(([month, count]) => ({
      month,
      multiplier: Math.round((count / avgMonthlyEvents) * 100) / 100
    }));
  }

  private static generateInterventionRecommendations(
    riskPredictions: { driver: string; riskScore: number; confidence: number }[]
  ): InterventionRecommendation[] {
    const recommendations: InterventionRecommendation[] = [];

    const highRiskDrivers = riskPredictions.filter(p => p.riskScore > 70 && p.confidence > 70);
    
    if (highRiskDrivers.length > 0) {
      recommendations.push({
        type: 'coaching',
        target: `${highRiskDrivers.length} high-risk drivers`,
        description: 'Immediate one-on-one coaching sessions for high-risk drivers',
        expectedImpact: 30,
        cost: highRiskDrivers.length * 200, // $200 per coaching session
        roi: 2.5
      });
    }

    if (riskPredictions.length > 20) {
      recommendations.push({
        type: 'training',
        target: 'All drivers',
        description: 'Fleet-wide safety awareness training program',
        expectedImpact: 15,
        cost: 5000,
        roi: 1.8
      });
    }

    return recommendations;
  }

  private static async exportToCsv(events: LytxHistoricalEvent[]): Promise<Blob> {
    const headers = [
      'Event ID', 'Driver Name', 'Vehicle', 'Date', 'Score', 'Status', 
      'Trigger', 'Carrier', 'Depot', 'Event Type', 'Behaviors'
    ];

    const rows = events.map(event => [
      event.event_id,
      event.driver_name,
      event.vehicle_registration || '',
      new Date(event.event_datetime).toLocaleDateString(),
      event.score.toString(),
      event.status,
      event.trigger,
      event.carrier,
      event.depot,
      event.event_type,
      event.behaviors || ''
    ]);

    const csvContent = [headers, ...rows].map(row => 
      row.map(field => `"${field}"`).join(',')
    ).join('\n');

    return new Blob([csvContent], { type: 'text/csv' });
  }

  private static async exportToExcel(events: LytxHistoricalEvent[], includeCharts: boolean): Promise<Blob> {
    // This would require a library like xlsx or exceljs
    // For now, return CSV format
    return this.exportToCsv(events);
  }

  private static async exportToPdf(events: LytxHistoricalEvent[], includeCharts: boolean): Promise<Blob> {
    // This would require a PDF generation library
    // For now, return a simple text representation
    const content = `LYTX Safety Events Report\n\nTotal Events: ${events.length}\n\n${events.map(e => 
      `${e.event_id} - ${e.driver_name} - ${e.score}`
    ).join('\n')}`;
    
    return new Blob([content], { type: 'text/plain' });
  }

  private static async exportToJson(events: LytxHistoricalEvent[], includeRawData: boolean): Promise<Blob> {
    const data = includeRawData ? events : events.map(e => ({
      event_id: e.event_id,
      driver_name: e.driver_name,
      score: e.score,
      status: e.status,
      carrier: e.carrier,
      depot: e.depot,
      event_datetime: e.event_datetime
    }));

    return new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  }
}

// Utility functions for external use
export const analyticsUtils = {
  formatScore: (score: number): string => `${score}/100`,
  formatTrend: (trend: 'improving' | 'stable' | 'declining'): string => {
    const symbols = { improving: '↗️', stable: '➡️', declining: '↘️' };
    return symbols[trend];
  },
  getRiskColor: (riskLevel: 'low' | 'medium' | 'high' | 'critical'): string => {
    const colors = { low: '#10B981', medium: '#F59E0B', high: '#EF4444', critical: '#7C2D12' };
    return colors[riskLevel];
  }
};