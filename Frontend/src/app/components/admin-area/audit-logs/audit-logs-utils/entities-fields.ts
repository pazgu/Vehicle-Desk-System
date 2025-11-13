export const userFieldLabels: { [key: string]: string } = {
    role: 'תפקיד',
    email: 'אימייל',
    phone: 'מספר טלפון',
    username: 'שם משתמש',
    first_name: 'שם פרטי',
    last_name: 'שם משפחה',
    employee_id: 'מזהה עובד',
    department_id: 'מזהה מחלקה',
    license_file_url: 'קובץ רישיון',
    license_expiry_date: 'תוקף רישיון',
    has_government_license: 'רישיון ממשלתי',
    exceeded_monthly_trip_quota: 'חריגה מהמכסה החודשית',
  };

export const   vehicleFieldLabels: { [key: string]: string } = {
    id: 'מזהה רכב',
    type: 'סוג רכב',
    status: 'סטטוס',
    fuel_type: 'סוג דלק',
    image_url: 'תמונה',
    last_used_at: 'שימוש אחרון',
    plate_number: 'מספר רישוי',
    freeze_reason: 'סיבת הקפאה',
    vehicle_model: 'דגם רכב',
    freeze_details: 'פרטי הקפאה',
    department_id: 'מחלקה',
    mileage: 'מד מרחק',
  };

export const departmentFieldLabels: { [key: string]: string } = {
    id: 'מזהה מחלקה',
    name: 'שם מחלקה',
    supervisior_id: 'שם מנהל מחלקה',
  };

export const rideFieldLabels: { [key: string]: string } = {
    id: 'מזהה נסיעה',
    stop: 'עצירה',
    status: 'סטטוס הזמנה',
    user_id: 'מזהה משתמש',
    ride_type: 'סוג נסיעה',
    vehicle_id: 'מזהה רכב',
    destination: 'יעד',
    start_datetime: 'תאריך התחלת נסיעה',
    end_datetime: 'תאריך סיום נסיעה',
    submitted_at: 'תאריך שליחת הזמנה',
    start_location: 'מיקום התחלה',
    emergency_event: 'אירוע חירום',
    override_user_id: 'מזהה משתמש עוקף',
    actual_distance_km: 'מרחק משוער אחרי סטייה (ק"מ)',
    license_check_passed: 'עבר בדיקת רישיון',
    estimated_distance_km: 'מרחק משוער (ק"מ)',
    four_by_four_reasonn: 'סיבת בחירה ברכב מסוג 4X4',
    extra_stops: 'עצירות נוספות',
  };
  