import { Injectable } from '@angular/core';
import { UserService } from './user_service';
import { ToastService } from './toast.service';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

interface DepartmentCheckResult {
  disableDueToDepartment: boolean;
  disableRequest: boolean;
}
interface UserBlockCheckResult {
  isBlocked: boolean;
  blockExpirationDate: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class RideUserChecksService {
  constructor(
    private userService: UserService,
    private toastService: ToastService
  ) {}

  checkGovernmentLicence(employeeId: string): Observable<boolean> {
    if (!employeeId) {
      console.warn(
        'RideUserChecksService.checkGovernmentLicence called with empty employeeId'
      );
      return of(false);
    }

    return this.userService.getUserById(employeeId).pipe(
      map((user: any) => {
        if (!('has_government_license' in user)) {
          console.error('🚨 user object missing has_government_license:', user);
          this.toastService.show(
            'שגיאה: פרטי רישיון ממשלתי לא נמצאו.',
            'error'
          );
          return false;
        }

        const hasLicense = user.has_government_license;
        const expiryDateStr = user.license_expiry_date as string | null;

        if (!hasLicense) {
          this.toastService.showPersistent(
            'לא ניתן לשלוח בקשה: למשתמש שנבחר אין רישיון ממשלתי תקף. לעדכון פרטים יש ליצור קשר עם המנהל.',
            'error'
          );
          return false;
        }

        if (expiryDateStr) {
          const expiryDate = new Date(expiryDateStr);
          const today = new Date();
          expiryDate.setHours(0, 0, 0, 0);
          today.setHours(0, 0, 0, 0);

          if (expiryDate < today) {
            this.toastService.showPersistent(
              'לא ניתן לשלוח בקשה: למשתמש שנבחר רישיון ממשלתי פג תוקף. לעדכון פרטים יש ליצור קשר עם המנהל.',
              'error'
            );
            return false;
          }
        }

        return true;
      }),
      catchError((err) => {
        console.error('Failed to fetch user data from API:', err);
        this.toastService.show('שגיאה בבדיקת רישיון ממשלתי', 'error');
        return of(false);
      })
    );
  }

  checkUserDepartment(userId: string): Observable<DepartmentCheckResult> {
    if (!userId) {
      return of({
        disableDueToDepartment: false,
        disableRequest: false,
      });
    }

    return this.userService.getUserById(userId).pipe(
      map((user: any) => {
        const isUnassignedUser = user.is_unassigned_user === true;
        const departmentId = user.department_id;
        const isUnassigned =
          isUnassignedUser || !departmentId || departmentId === null;

        if (isUnassigned) {
          this.toastService.showPersistent(
            'לא ניתן לשלוח בקשה: אינך משויך למחלקה. יש ליצור קשר עם המנהל להשמה במחלקה.',
            'error'
          );
          return {
            disableDueToDepartment: true,
            disableRequest: true,
          };
        }

        return {
          disableDueToDepartment: false,
          disableRequest: false,
        };
      }),
      catchError((err) => {
        console.error('Failed to fetch user department:', err);
        this.toastService.show('שגיאה בבדיקת שיוך למחלקה', 'error');
        return of({
          disableDueToDepartment: true,
          disableRequest: true,
        });
      })
    );
  }
  checkUserBlock(userId: string): Observable<UserBlockCheckResult> {
    if (!userId) {
      console.warn(
        'RideUserChecksService.checkUserBlock called with empty userId'
      );
      return of({
        isBlocked: false,
        blockExpirationDate: null,
      });
    }

    return this.userService.getUserById(userId).pipe(
      map((user: any) => {
        const isBlocked = user.is_blocked === true;
        const expirationDateStr = user.block_expires_at as string | null;
        return {
          isBlocked: isBlocked,
          blockExpirationDate: expirationDateStr,
        };
      }),
      catchError((err) => {
        console.error('Failed to check user block status:', err);
        this.toastService.show(
          'אירעה שגיאה בבדיקת סטטוס המשתמש. אנא נסה שנית.',
          'error'
        );
        return of({
          isBlocked: false,
          blockExpirationDate: null,
        });
      })
    );
  }
}
