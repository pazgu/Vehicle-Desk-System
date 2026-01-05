export type RideStatusKey =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'in_progress'
  | 'completed'
  | 'cancelled_due_to_no_show'
  | 'cancelled_vehicle_unavailable';

export const RIDE_STATUS_COLORS: Record<RideStatusKey, { labelHe: string; color: string }> = {
  pending: { labelHe: 'ממתין לאישור', color: '#fdf0c8' },
  approved: { labelHe: 'אושר', color: '#60cd79' },
  rejected: { labelHe: 'נדחה', color: '#dc5b5b' },
  in_progress: { labelHe: 'בנסיעה', color: '#fbdda5' },
  completed: { labelHe: 'בוצע', color: '#60cd79' },
  cancelled_due_to_no_show: { labelHe: 'בוטלה עקב אי-הגעה', color: '#e0d6e8' },
  cancelled_vehicle_unavailable: { labelHe: 'בוטל-רכב לא זמין', color: '#e0d6e8' },
};

export type VehicleStatusKey = 'available' | 'in_use' | 'frozen';

export const VEHICLE_STATUS_COLORS: Record<VehicleStatusKey, { labelHe: string; color: string }> = {
  available: { labelHe: 'זמין', color: '#dcf1e1' }, 
  in_use: { labelHe: 'בשימוש', color: '#ffe5b4' },
  frozen: { labelHe: 'מוקפא', color: '#e2f0f8' },
};

export type AuditLegendKey =
  | 'approved_done'         
  | 'success'                
  | 'frozen'                 
  | 'active'               
  | 'pending'               
  | 'rejected'             
  | 'emergency'            
  | 'delete'           
  | 'cancelled_due_to_no_show'
  | 'exceeded_monthly_trip_quota';

export const AUDIT_LEGEND_COLORS: Record<AuditLegendKey, { labelHe: string; color: string }> = {
  approved_done: { labelHe: 'אושר / הסתיים', color: '#60cd79' },
  success: { labelHe: 'פעולה בוצעה בהצלחה', color: '#dcf1e1' },
  frozen: { labelHe: 'מוקפא', color: '#e2f0f8' },
  active: { labelHe: 'פעיל (בנסיעה/בשימוש)', color: '#ffe5b4' },
  pending: { labelHe: 'ממתין לאישור', color: '#fdf0c8' },
  rejected: { labelHe: 'נדחה', color: '#dc5b5b' },
  emergency: { labelHe: 'אירוע חירום', color: '#fabd84' },
  delete: { labelHe: 'נמחק', color: '#f1b5b5' },
  cancelled_due_to_no_show: { labelHe: 'בוטל עקב אי הגעה', color: '#e0d6e8' },
  exceeded_monthly_trip_quota: { labelHe: 'חריגה ממכסת נסיעות חודשית', color: '#cdb69b' },
};

export const buildAuditLegendCssVars = () => ({
  '--legend-approved': AUDIT_LEGEND_COLORS.approved_done.color,
  '--legend-success': AUDIT_LEGEND_COLORS.success.color,
  '--legend-frozen': AUDIT_LEGEND_COLORS.frozen.color,
  '--legend-active': AUDIT_LEGEND_COLORS.active.color,
  '--legend-pending': AUDIT_LEGEND_COLORS.pending.color,
  '--legend-rejected': AUDIT_LEGEND_COLORS.rejected.color,
  '--legend-emergency': AUDIT_LEGEND_COLORS.emergency.color,
  '--legend-delete': AUDIT_LEGEND_COLORS.delete.color,
  '--legend-cancelled-no-show': AUDIT_LEGEND_COLORS.cancelled_due_to_no_show.color,
  '--legend-exceeded-quota': AUDIT_LEGEND_COLORS.exceeded_monthly_trip_quota.color,
});
