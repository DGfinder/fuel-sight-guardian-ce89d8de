import { AlertCircle, Bell, Clock } from "lucide-react";
import { AlertType } from "@/types/fuel";

export const ALERT_TYPE_CONFIG: Record<AlertType, {
  label: string;
  icon: typeof AlertCircle;
  color: string;
  bgColor: string;
  borderColor: string;
}> = {
  critical: {
    label: "Critical",
    icon: AlertCircle,
    color: "text-red-600",
    bgColor: "bg-red-50",
    borderColor: "border-red-200"
  },
  low_level: {
    label: "Low Level",
    icon: Bell,
    color: "text-orange-600",
    bgColor: "bg-orange-50",
    borderColor: "border-orange-200"
  },
  low_days: {
    label: "Low Days",
    icon: Clock,
    color: "text-yellow-600",
    bgColor: "bg-yellow-50",
    borderColor: "border-yellow-200"
  }
}; 