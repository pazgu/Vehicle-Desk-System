export function getRowBackgroundColor(log: any): string {
  if (log.action === 'DELETE') {
    return '#f8e2e2'; 
  }

  if (
    log.action === 'UPDATE' &&
    log.entity_type === 'Ride' &&
    (log.change_data?.new?.emergency_event === true ||
      log.change_data?.new?.emergency_event === 'true')
  ) {
    return '#feaf66'; 
  }

  if (
    log.entity_type === 'Vehicle' &&
    log.change_data?.new?.status === 'frozen'
  ) {
    return '#e2f0f8';
  }

  if (
    log.entity_type === 'Ride' &&
    ((log.action === 'UPDATE' && log.change_data?.new?.status === 'pending') ||
      (log.action === 'INSERT' && log.change_data?.status === 'pending'))
  ) {
    return '#fbf3da'; 
  }

  if (
    (log.entity_type === 'Ride' &&
      log.change_data?.new?.status === 'in_progress') ||
    (log.entity_type === 'Vehicle' && log.change_data?.new?.status === 'in_use')
  ) {
    return '#ffe5b4';
  }

  if (
    log.entity_type === 'Ride' &&
    (log.change_data?.new?.status === 'approved' ||
      log.change_data?.new?.status === 'completed')
  ) {
    return '#60cd79';
  }

  if (
    log.entity_type === 'Ride' &&
    log.change_data?.new?.status === 'rejected'
  ) {
    return '#dc5b5b'; 
  }

  if (
    log.entity_type === 'Ride' &&
    log.action === 'UPDATE' &&
    (log.change_data?.new?.status === 'cancelled_due_to_no_show' ||
      log.change_data?.new?.status === 'cancelled-due-to-no-show')
  ) {
    return '#e0d6e8'; 
  }

  if (
    log.entity_type === 'User' &&
    log.change_data?.new?.exceeded_monthly_trip_quota === true
  ) {
    return '#cdb69b'; 
  }

  if (
    (log.entity_type === 'User' &&
      (log.action === 'INSERT' || log.action === 'UPDATE')) ||
    (log.entity_type === 'Department' &&
      (log.action === 'INSERT' || log.action === 'UPDATE')) ||
    (log.entity_type === 'Vehicle' &&
      ((log.action === 'UPDATE' &&
        (log.change_data?.new?.status === 'available' ||
          log.change_data?.new?.status === 'approved')) ||
        log.action === 'INSERT'))
  ) {
    return '#dcf1e1'; 
  }

  return '#ffffff';
}

export function getEnglishStatusLabel(log: any): string {
  if (log.action === 'DELETE') {
    return 'Deleted';
  }

  if (
    log.action === 'UPDATE' &&
    log.entity_type === 'Ride' &&
    (log.change_data?.new?.emergency_event === true ||
      log.change_data?.new?.emergency_event === 'true')
  ) {
    return 'Emergency Event';
  }

  if (
    log.entity_type === 'Vehicle' &&
    log.change_data?.new?.status === 'frozen'
  ) {
    return 'Frozen';
  }

  if (log.entity_type === 'Ride') {
    const status = log.change_data?.new?.status || log.change_data?.status;
    switch (status?.toLowerCase()) {
      case 'pending':
        return 'Pending';
      case 'approved':
        return 'Approved';
      case 'completed':
        return 'Completed';
      case 'rejected':
        return 'Rejected';
      case 'in_progress':
        return 'In Progress';
      case 'cancelled_due_to_no_show':
      case 'cancelled-due-to-no-show':
        return 'Cancelled - No Show';
      default:
        return status || 'Unknown';
    }
  }

  if (log.entity_type === 'Vehicle') {
    const status = log.change_data?.new?.status || log.change_data?.status;
    switch (status?.toLowerCase()) {
      case 'available':
        return 'Available';
      case 'in_use':
        return 'In Use';
      case 'frozen':
        return 'Frozen';
      default:
        return status || 'Unknown';
    }
  }

  if (
    log.entity_type === 'User' &&
    log.change_data?.new?.exceeded_monthly_trip_quota === true
  ) {
    return 'Monthly Limit Exceeded';
  }

  if (
    (log.entity_type === 'User' || log.entity_type === 'Department') &&
    (log.action === 'INSERT' || log.action === 'UPDATE')
  ) {
    return 'Success';
  }

  return 'Unknown';
}

export function translateFuelType(fuelType: string | null | undefined): string {
  if (!fuelType) return '';
  switch (fuelType.toLowerCase()) {
    case 'electric':
      return 'חשמלי';
    case 'hybrid':
      return 'היברידי';
    case 'gasoline':
      return 'בנזין';
    default:
      return fuelType;
  }
}

export function translateVehicleStatus(
  status: string | null | undefined
): string {
  if (!status) return '';
  switch (status.toLowerCase()) {
    case 'available':
      return 'זמין';
    case 'in_use':
      return 'בשימוש';
    case 'frozen':
      return 'מוקפא';
    default:
      return status;
  }
}
export function translateRideStatus(status: string | null | undefined): string {
  if (!status) return '';
  switch (status.toLowerCase()) {
    case 'pending':
      return 'ממתין';
    case 'approved':
      return 'מאושר';
    case 'rejected':
      return 'נדחה';
    case 'in_progress':
      return 'בתהליך';
    case 'completed':
      return 'הושלם';
    case 'cancelled_due_to_no_show':
      return 'בוטל עקב אי הגעה';
    default:
      return status;
  }
}

export function translateUserRole(userRole: string | null | undefined): string {
  if (!userRole) return '';
  switch (userRole.toLowerCase()) {
    case 'admin':
      return 'מנהל';
    case 'employee':
      return 'עובד';
    case 'superuser':
      return 'מנהל ישיר';
    case 'inspector':
      return 'בודק';
    default:
      return userRole;
  }
}

export function translateFreezeReason(
  freezeReason: string | null | undefined
): string {
  if (!freezeReason) return '';
  switch (freezeReason.toLowerCase()) {
    case 'accident':
      return 'תאונה';
    case 'maintenance':
      return 'תחזוקה';
    case 'personal':
      return 'אישי';
    default:
      return freezeReason;
  }
}

export function translateRideType(rideType: string | null | undefined): string {
  if (!rideType) return '';
  switch (rideType.toLowerCase()) {
    case 'administrative':
      return 'מנהלתית';
    case 'operational':
      return 'מבצעית';
    default:
      return rideType;
  }
}

export function getVehicleAuditRows(
  oldData: any,
  newData: any,
  getDepartmentNameById: (id: string | null | undefined) => string
): Array<{ label: string; oldValue: any; newValue: any }> {
  return [
    {
      label: 'מספר רכב',
      oldValue: oldData.plate_number,
      newValue: newData.plate_number,
    },
    { label: 'סוג רכב', oldValue: oldData.type, newValue: newData.type },
    {
      label: 'סוג דלק',
      oldValue: translateFuelType(oldData.fuel_type),
      newValue: translateFuelType(newData.fuel_type),
    },
    {
      label: 'סטטוס',
      oldValue: translateVehicleStatus(oldData.status),
      newValue: translateVehicleStatus(newData.status),
    },
    {
      label: 'שימוש אחרון',
      oldValue: oldData.last_used_at,
      newValue: newData.last_used_at,
    }, 
    {
      label: 'סיבת הקפאה',
      oldValue: translateFreezeReason(oldData.freeze_reason),
      newValue: translateFreezeReason(newData.freeze_reason),
    },
    {
      label: 'פרטי הקפאה',
      oldValue: oldData.freeze_details,
      newValue: newData.freeze_details,
    },
    {
      label: 'מחלקה',
      oldValue: getDepartmentNameById(oldData.department_id),
      newValue: getDepartmentNameById(newData.department_id),
    },
    {
      label: "קילומטראז'",
      oldValue: oldData.mileage,
      newValue: newData.mileage,
    },
    {
      label: 'תאריך סיום ליסינג',
      oldValue: oldData.lease_expiry,
      newValue: newData.lease_expiry,
    },
    {
      label: 'דגם רכב',
      oldValue: oldData.vehicle_model,
      newValue: newData.vehicle_model,
    },
    {
      label: 'תמונה',
      oldValue: oldData.image_url,
      newValue: newData.image_url,
    },
  ];
}

export function getVehicleById(
  vehicleId: string,
  vehicles: { id: string; vehicle_model: string; plate_number: string }[]
): { vehicle_model: string; plate_number: string } | undefined {
  return vehicles.find((v) => v.id === vehicleId);
}

export function getVehicleModel(
  vehicleId: string,
  vehicles: { id: string; vehicle_model: string; plate_number: string }[]
): string {
  const vehicle = getVehicleById(vehicleId, vehicles);
  return vehicle ? `${vehicle.vehicle_model}` : 'לא זמין';
}

export function getPlateNumber(
  vehicleId: string,
  vehicles: { id: string; vehicle_model: string; plate_number: string }[]
): string {
  const vehicle = getVehicleById(vehicleId, vehicles);
  return vehicle ? `${vehicle.plate_number}` : 'לא זמין';
}

export function getDepartmentNameById(
  id: string | null | undefined,
  departments: { id: string; name: string }[]
): string {
  if (!id) return '';
  const dep = departments.find((d) => d.id === id);
  return dep ? dep.name : 'לא משוייך למחלקה';
}

export function getUserFullNameById(
  id: string,
  users: {
    id: string;
    first_name: string;
    last_name: string;
    user_name: string;
  }[]
): string {
  const user = users.find((u) => u.id === id);
  return user ? `${user.first_name} ${user.last_name}` : id;
}

export function getUsernameById(
  id: string,
  users: {
    id: string;
    first_name: string;
    last_name: string;
    user_name: string;
  }[]
): string {
  const user = users.find((u) => u.id === id);
  return user ? `${user.user_name}` : id;
}

export function getCityName(
  cityId: string,
  cityMap: Record<string, string>
): string {
  return cityMap[cityId] || cityId;
}

export function formatRouteFromChangeData(
  changeData: any,
  cityMap: Record<string, string>
): string {
  const start = changeData.start_location;
  const stop = changeData.stop;
  const destination = changeData.destination;
  const extraStops = changeData.extra_stops; 

  const allStops = [start, stop, ...(extraStops || []), destination];

  return allStops
    .filter(Boolean)
    .map((id) => getCityName(id, cityMap))
    .join(' ← ');
}

export function getUserAuditRows(
  oldData: any,
  newData: any,
  departments: {
    id: string;
    name: string;
  }[]
): Array<{ label: string; oldValue: any; newValue: any }> {
  return [
    {
      label: 'שם פרטי',
      oldValue: oldData.first_name,
      newValue: newData.first_name,
    },
    {
      label: 'שם משפחה',
      oldValue: oldData.last_name,
      newValue: newData.last_name,
    },
    {
      label: 'שם משתמש',
      oldValue: oldData.username,
      newValue: newData.username,
    },
    { label: 'אימייל', oldValue: oldData.email, newValue: newData.email },
    { label: 'מספר טלפון', oldValue: oldData.phone, newValue: newData.phone },
    {
      label: 'תפקיד',
      oldValue: translateUserRole(oldData.role),
      newValue: translateUserRole(newData.role),
    },
    {
      label: 'מזהה עובד',
      oldValue: oldData.employee_id,
      newValue: newData.employee_id,
    },
    {
      label: 'מחלקה',
      oldValue: getDepartmentNameById(oldData.department_id, departments),
      newValue: getDepartmentNameById(newData.department_id, departments),
    },
    {
      label: 'רישיון ממשלתי',
      oldValue: oldData.has_government_license,
      newValue: newData.has_government_license,
    },
    {
      label: 'תוקף רישיון',
      oldValue: oldData.license_expiry_date,
      newValue: newData.license_expiry_date,
    },
    {
      label: 'קובץ רישיון',
      oldValue: oldData.license_file_url,
      newValue: newData.license_file_url,
    },
    {
      label: 'חריגה מהמכסה החודשית',
      oldValue: oldData.exceeded_monthly_trip_quota,
      newValue: newData.exceeded_monthly_trip_quota,
    },
  ];
}

export function formatRoute(
  start: string,
  stop: string,
  extraStops: string[] | undefined,
  destination: string,
  cityMap: Record<string, string>
): string {
  const allStops = [start, stop, ...(extraStops || []), destination];

  return allStops
    .filter(Boolean)
    .map((id) => getCityName(id, cityMap))
    .join(' ← ');
}

export function getRideAuditRows(
  oldData: any,
  newData: any,
  cityMap: Record<string, string>,
  users: {
    id: string;
    first_name: string;
    last_name: string;
    user_name: string;
  }[],
  vehicles: {
    id: string;
    vehicle_model: string;
    plate_number: string;
  }[]
): Array<{ label: string; oldValue: any; newValue: any }> {
  return [
    { label: 'מזהה נסיעה', oldValue: oldData.id, newValue: newData.id },
    {
      label: 'מסלול',
      oldValue: formatRoute(
        oldData.start_location,
        oldData.stop,
        oldData.extra_stops,
        oldData.destination,
        cityMap
      ),
      newValue: formatRoute(
        newData.start_location,
        newData.stop,
        newData.extra_stops,
        newData.destination,
        cityMap
      ),
    },
    {
      label: 'סוג נסיעה',
      oldValue: translateRideType(oldData.ride_type),
      newValue: translateRideType(newData.ride_type),
    },
    {
      label: 'סיבת בחירה ברכב 4X4',
      oldValue: oldData.four_by_four_reasonn,
      newValue: newData.four_by_four_reasonn,
    },
    {
      label: 'שם משתמש',
      oldValue: getUserFullNameById(oldData.user_id, users),
      newValue: getUserFullNameById(newData.user_id, users),
    },
    {
      label: 'שם משתמש עוקף',
      oldValue: getUserFullNameById(oldData.override_user_id, users),
      newValue: getUserFullNameById(newData.override_user_id, users),
    },
    {
      label: 'לוחית רישוי',
      oldValue: getPlateNumber(oldData.vehicle_id, vehicles),
      newValue: getPlateNumber(newData.vehicle_id, vehicles),
    },
    {
      label: 'דגם רכב',
      oldValue: getVehicleModel(oldData.vehicle_id, vehicles),
      newValue: getVehicleModel(newData.vehicle_id, vehicles),
    },
    {
      label: 'סטטוס',
      oldValue: translateRideStatus(oldData.status),
      newValue: translateRideStatus(newData.status),
    },
    {
      label: 'זמן התחלה מושער',
      oldValue: oldData.start_datetime,
      newValue: newData.start_datetime,
    },
    {
      label: 'זמן התחלה אמיתי',
      oldValue: oldData.actual_pickup_time,
      newValue: newData.actual_pickup_time,
    },
    {
      label: 'זמן סיום',
      oldValue: oldData.end_datetime,
      newValue: newData.end_datetime,
    },
    {
      label: 'תאריך שליחה',
      oldValue: oldData.submitted_at,
      newValue: newData.submitted_at,
    },
    {
      label: 'מרחק מוערך (ק"מ)',
      oldValue: oldData.estimated_distance_km,
      newValue: newData.estimated_distance_km,
    },
    {
      label: 'מרחק משוער אחרי סטייה (ק"מ)',
      oldValue: oldData.actual_distance_km,
      newValue: newData.actual_distance_km,
    },
    {
      label: 'בדיקת רישיון עברה',
      oldValue: oldData.license_check_passed,
      newValue: newData.license_check_passed,
    },
    {
      label: 'אירוע חירום',
      oldValue: oldData.emergency_event,
      newValue: newData.emergency_event,
    },
  ];
}

export function getDepartmentAuditRows(
  oldData: any,
  newData: any,
  users: {
    id: string;
    first_name: string;
    last_name: string;
    user_name: string;
  }[]
): Array<{ label: string; oldValue: any; newValue: any }> {
  return [
    { label: 'שם מחלקה', oldValue: oldData?.name, newValue: newData?.name },
    {
      label: 'שם מנהל מחלקה',
      oldValue: getUserFullNameById(oldData?.supervisor_id, users),
      newValue: getUserFullNameById(newData?.supervisor_id, users),
    },
  ];
}
