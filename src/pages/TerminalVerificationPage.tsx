import React, { useState } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, MapPin, Navigation } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  useTerminalVerificationDashboard,
  sortByDrift,
  needsCorrection
} from '@/hooks/useTerminalVerification';
import {
  formatDrift,
  getStatusColor,
  getStatusLabel,
  type TerminalVerificationResult
} from '@/api/terminalVerification';

export default function TerminalVerificationPage() {
  const { verifications, summary, isLoading, acceptCorrection } = useTerminalVerificationDashboard();
  const [correctionDialogOpen, setCorrectionDialogOpen] = useState(false);
  const [selectedTerminal, setSelectedTerminal] = useState<TerminalVerificationResult | null>(null);

  const handleAcceptCorrection = (terminal: TerminalVerificationResult) => {
    setSelectedTerminal(terminal);
    setCorrectionDialogOpen(true);
  };

  const handleConfirmCorrection = async () => {
    if (selectedTerminal && selectedTerminal.actual_centroid_lat && selectedTerminal.actual_centroid_lon) {
      await acceptCorrection.mutateAsync({
        terminalId: selectedTerminal.terminal_id,
        newLatitude: selectedTerminal.actual_centroid_lat,
        newLongitude: selectedTerminal.actual_centroid_lon
      });
      setCorrectionDialogOpen(false);
      setSelectedTerminal(null);
    }
  };

  // Sort terminals by drift (worst first)
  const sortedVerifications = sortByDrift(verifications);

  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Terminal GPS Verification</h2>
        <p className="text-muted-foreground mt-2">
          Verify terminal GPS accuracy by analyzing actual trip data
        </p>
      </div>

      {/* Info Alert */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>How GPS Verification Works</AlertTitle>
        <AlertDescription>
          This tool analyzes all trips that start or end near each terminal and compares the recorded
          GPS coordinates against the actual centroid of trip endpoints. Terminals with significant drift
          should be reviewed and updated to improve trip-to-terminal matching accuracy.
        </AlertDescription>
      </Alert>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Terminals</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.total}</div>
            <p className="text-xs text-muted-foreground">
              Being verified
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Verified</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{summary.verified}</div>
            <p className="text-xs text-muted-foreground">
              {'<'} 50m drift
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Good</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{summary.good}</div>
            <p className="text-xs text-muted-foreground">
              50-100m drift
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Needs Review</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{summary.needsReview}</div>
            <p className="text-xs text-muted-foreground">
              100-500m drift
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inaccurate</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {summary.inaccurate + summary.noData}
            </div>
            <p className="text-xs text-muted-foreground">
              {'>'}500m drift or no data
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Verification Results Table */}
      <Card>
        <CardHeader>
          <CardTitle>Verification Results</CardTitle>
          <CardDescription>
            Terminals sorted by GPS drift distance (worst first)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : verifications.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Terminal</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Recorded GPS</TableHead>
                    <TableHead>Actual Centroid</TableHead>
                    <TableHead>Drift</TableHead>
                    <TableHead>Trip Count</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead>Recommendations</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedVerifications.map((verification) => (
                    <TableRow key={verification.terminal_id}>
                      <TableCell className="font-medium">
                        {verification.terminal_name}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusColor(verification.status)}>
                          {getStatusLabel(verification.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">
                        {verification.recorded_latitude.toFixed(6)}, {verification.recorded_longitude.toFixed(6)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">
                        {verification.actual_centroid_lat && verification.actual_centroid_lon
                          ? `${verification.actual_centroid_lat.toFixed(6)}, ${verification.actual_centroid_lon.toFixed(6)}`
                          : 'No data'}
                      </TableCell>
                      <TableCell>
                        <span
                          className={
                            verification.drift_meters === null
                              ? 'text-muted-foreground'
                              : verification.drift_meters < 50
                              ? 'text-green-600 font-medium'
                              : verification.drift_meters < 100
                              ? 'text-blue-600 font-medium'
                              : verification.drift_meters < 500
                              ? 'text-yellow-600 font-medium'
                              : 'text-red-600 font-bold'
                          }
                        >
                          {formatDrift(verification.drift_meters)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span className="text-sm font-medium">{verification.trip_count} trips</span>
                          <span className="text-xs text-muted-foreground">
                            {verification.start_point_count} starts, {verification.end_point_count} ends
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden"
                            title={`${verification.confidence_score}% confidence`}
                          >
                            <div
                              className={`h-full ${
                                verification.confidence_score >= 85
                                  ? 'bg-green-500'
                                  : verification.confidence_score >= 70
                                  ? 'bg-blue-500'
                                  : verification.confidence_score >= 50
                                  ? 'bg-yellow-500'
                                  : 'bg-red-500'
                              }`}
                              style={{ width: `${verification.confidence_score}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {verification.confidence_score}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs max-w-xs">
                        {verification.recommendations}
                      </TableCell>
                      <TableCell className="text-right">
                        {needsCorrection(verification) ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAcceptCorrection(verification)}
                            disabled={acceptCorrection.isPending}
                          >
                            <Navigation className="h-4 w-4 mr-1" />
                            Accept Correction
                          </Button>
                        ) : verification.status === 'VERIFIED' || verification.status === 'GOOD' ? (
                          <span className="text-xs text-green-600">✓ Accurate</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">No action</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <MapPin className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No terminals found for verification.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Correction Confirmation Dialog */}
      <AlertDialog open={correctionDialogOpen} onOpenChange={setCorrectionDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Accept GPS Correction</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to update the GPS coordinates for <strong>{selectedTerminal?.terminal_name}</strong>?
              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Current:</span>
                  <span className="font-mono">
                    {selectedTerminal?.recorded_latitude.toFixed(6)}, {selectedTerminal?.recorded_longitude.toFixed(6)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">New (Centroid):</span>
                  <span className="font-mono font-medium text-green-600">
                    {selectedTerminal?.actual_centroid_lat?.toFixed(6)}, {selectedTerminal?.actual_centroid_lon?.toFixed(6)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Drift:</span>
                  <span className="font-medium">{formatDrift(selectedTerminal?.drift_meters || null)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Based on:</span>
                  <span>{selectedTerminal?.trip_count} trip samples</span>
                </div>
              </div>
              <p className="mt-4 text-sm text-yellow-600">
                This will update the terminal's GPS coordinates and regenerate its service area polygon.
                Trip-to-terminal matching will be more accurate after this update.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmCorrection}
              className="bg-green-600 hover:bg-green-700"
            >
              Accept Correction
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
