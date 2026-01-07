import { Component, OnInit } from '@angular/core';
import { User } from '../../../../models/user.model';
import { UserService } from '../../../../services/user_service';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ConfirmDialogComponent } from '../../../page-area/confirm-dialog/confirm-dialog.component';
import { ToastService } from '../../../../services/toast.service';
import { SocketService } from '../../../../services/socket.service';
import { MatDialog } from '@angular/material/dialog';
import { ChangeDetectorRef } from '@angular/core';
import { forkJoin } from 'rxjs';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import { UserCardComponent } from '../user-card/user-card.component';
import { ROLES, ROLE_LABELS } from '../../../../constants/roles';

@Component({
  selector: 'app-user-data',
  templateUrl: './user-data.component.html',
  styleUrls: ['./user-data.component.css'],
  imports: [RouterModule, CommonModule, FormsModule, ReactiveFormsModule],
})
export class UserDataComponent implements OnInit {
  users: User[] = [];
  filteredLogs: User[] = [];
  pageSize = 5;
  currentPage = 1;
  showFilters = false;
  filtersCollapsed = false;
  searchTerm = '';
  selectedRole: string = '';
  roles = ROLES;
  roleLabels = ROLE_LABELS;
  availableRoles: string[] = [];
  license_expiry_date?: Date;
  licenceExpiredMap: { [userId: string]: boolean } = {};
  departmentNames: { [key: string]: string } = {};
  supervisorToDeptName: { [key: string]: string } = {};

  isBlockUserModalOpen: boolean = false;
  isUnblockConfirmationModalOpen: boolean = false;
  selectedUserForBlock: User | null = null;
  blockUserForm!: FormGroup;
  isSubmitting: boolean = false;

  constructor(
    private userService: UserService,
    private router: Router,
    private toastservice: ToastService,
    private socketservice: SocketService,
    private dialog: MatDialog,
    private cdr: ChangeDetectorRef,
    private fb: FormBuilder
  ) {}

  ngOnInit(): void {
    this.blockUserForm = this.fb.group({
      blockDuration: [14, [Validators.required, Validators.min(1)]],
      blockReason: [
        '',
        [
          Validators.required,
          Validators.minLength(5),
          this.noWhitespaceValidator,
        ],
      ],
    });

    this.loadUsersAndDepartments();
  }

  noWhitespaceValidator(control: any) {
    const isWhitespace = (control.value || '').trim().length === 0;
    const isValid = !isWhitespace;
    return isValid ? null : { whitespace: true };
  }
  private loadUsersAndDepartments(): void {
    const users$ = this.userService.getAllUsers();
    const departments$ = this.userService.getDepartments();

    forkJoin([users$, departments$]).subscribe({
      next: ([users, departments]) => {
        const deptIdToName = departments.reduce((map, dept) => {
          map[dept.id] = dept.name;
          return map;
        }, {} as { [key: string]: string });

        this.supervisorToDeptName = departments.reduce((map, dept) => {
          if (dept.supervisor_id) {
            map[dept.supervisor_id] = dept.name;
          }
          return map;
        }, {} as { [key: string]: string });

        this.users = users.map((user) => {
          let deptName = '—';
          if (
            user.role === 'supervisor' &&
            this.supervisorToDeptName[user.employee_id]
          ) {
            deptName = this.supervisorToDeptName[user.employee_id];
          } else if (user.department_id && deptIdToName[user.department_id]) {
            deptName = deptIdToName[user.department_id];
          }

          return { ...user, department_name: deptName };
        });

        this.filteredLogs = [...this.users];
        this.departmentNames = deptIdToName;
        this.checkLicence(this.users);
        this.availableRoles = Array.from(
          new Set(users.map((u) => u.isRaan ? 'raan' : u.role))
        ).filter(Boolean);

        this.setupSocketListeners();
      },
      error: (err) => console.error('Failed to fetch data', err),
    });
  }

  private setupSocketListeners(): void {
    this.socketservice.deleteUserRequests$.subscribe((deletedUser) => {
      if (deletedUser) {
        this.users = this.users.filter((u) => u.employee_id !== deletedUser.id);
        this.filterLogs();
      }
    });

    this.socketservice.usersBlockStatus$.subscribe((update) => {
      const id = String(update.id);
      const idx = this.users.findIndex((u) => String(u.employee_id) === id);
      if (idx === -1) return;

      const updatedUser = {
        ...this.users[idx],
        is_blocked: update.is_blocked,
        block_expires_at: update.block_expires_at,
      };

      this.users = [
        ...this.users.slice(0, idx),
        updatedUser,
        ...this.users.slice(idx + 1),
      ];

      const fIdx = this.filteredLogs.findIndex(
        (u) => String(u.employee_id) === id
      );
      if (fIdx !== -1) {
        this.filteredLogs = [
          ...this.filteredLogs.slice(0, fIdx),
          updatedUser,
          ...this.filteredLogs.slice(fIdx + 1),
        ];
      }

      if (
        this.selectedUserForBlock?.employee_id &&
        String(this.selectedUserForBlock.employee_id) === id
      ) {
        this.closeBlockUserModal();
        this.closeUnblockConfirmationModal();
      }

      this.cdr.detectChanges();
    });

    this.socketservice.usersLicense$.subscribe((update) => {
      const idx = this.users.findIndex((u) => u.employee_id === update.id);
      if (idx === -1) return;

      const updatedUser = { ...this.users[idx], ...update };
      if (update.license_expiry_date) {
        updatedUser.license_expiry_date = new Date(update.license_expiry_date);
      }

      this.users[idx] = updatedUser;
      this.licenceExpiredMap[update.id] = updatedUser.license_expiry_date
        ? updatedUser.license_expiry_date < new Date()
        : false;

      this.cdr.detectChanges();
    });
  }

  getDepartmentName(user: any): string {
    if (
      user.role === 'supervisor' &&
      user.employee_id in this.supervisorToDeptName
    ) {
      return this.supervisorToDeptName[user.employee_id];
    }

    return this.departmentNames[user.department_id] || 'לא זמין';
  }
  hasNoLicense(user: User): boolean {
    return !user.has_government_license;
  }
  hasExpiredLicense(user: User): boolean {
    return (
      user.has_government_license && this.licenceExpiredMap[user.employee_id]
    );
  }
  getLicenseWarningMessage(user: User): string {
    if (this.hasNoLicense(user)) {
      return 'אין רישיון ממשלתי';
    } else if (this.hasExpiredLicense(user)) {
      return 'רישיון פג תוקף';
    }
    return '';
  }

  openBlockUserModal(user: User) {
    this.selectedUserForBlock = user;
    this.isBlockUserModalOpen = true;
    this.blockUserForm.reset({ blockDuration: 14, blockReason: '' });
  }

  closeBlockUserModal() {
    this.isBlockUserModalOpen = false;
    this.selectedUserForBlock = null;
    this.blockUserForm.reset();
  }

  openUnblockConfirmationModal(user: User) {
    this.selectedUserForBlock = user;
    this.isUnblockConfirmationModalOpen = true;
  }

  closeUnblockConfirmationModal() {
    this.isUnblockConfirmationModalOpen = false;
    this.selectedUserForBlock = null;
  }

  confirmBlockUser() {
    if (this.blockUserForm.invalid || !this.selectedUserForBlock) {
      this.toastservice.show('יש למלא את כל השדות הנדרשים ', 'error');
      return;
    }

    this.isSubmitting = true;
    const blockDuration = this.blockUserForm.get('blockDuration')?.value;
    const blockReason = this.blockUserForm.get('blockReason')?.value.trim();
    const now = new Date();
    const blockExpiresAt = new Date(now.setDate(now.getDate() + blockDuration));

    const formData = this.createFormDataForUserUpdate(
      this.selectedUserForBlock,
      true,
      blockExpiresAt.toISOString().slice(0, 16),
      blockReason
    );

    this.userService
      .updateUser(this.selectedUserForBlock.employee_id, formData)
      .subscribe({
        next: () => {
          this.isSubmitting = false;
          this.toastservice.show(
            `המשתמש נחסם בהצלחה למשך ${blockDuration} ימים. הסיבה נרשמה `,
            'success'
          );
          this.closeBlockUserModal();
        },
        error: (err) => {
          this.isSubmitting = false;
          let errorMessage = 'שגיאה בחסימת המשתמש ';
          if (err.status === 400) {
            errorMessage =
              err.error?.detail ||
              'נתונים שגויים - יש לבדוק את השדות ולנסות שוב ';
          } else if (err.status === 403) {
            errorMessage = 'אין לך הרשאה לחסום משתמש זה ';
          } else if (err.status === 404) {
            errorMessage = 'המשתמש לא נמצא במערכת ';
          } else if (err.status === 500) {
            errorMessage = 'שגיאה בשרת או במסד הנתונים - נסה שוב מאוחר יותר ';
          } else if (err.status === 0 || !err.status) {
            errorMessage = 'אין חיבור לשרת - בדוק את החיבור לאינטרנט ';
          } else if (err.error?.detail) {
            errorMessage = err.error.detail;
          }
          this.toastservice.show(errorMessage, 'error');
          console.error('Error blocking user:', err);
        },
      });
  }

  confirmUnblockUser() {
    if (!this.selectedUserForBlock) {
      return;
    }

    this.isSubmitting = true;

    const formData = this.createFormDataForUserUpdate(
      this.selectedUserForBlock,
      false,
      null,
      null
    );

    this.userService
      .updateUser(this.selectedUserForBlock.employee_id, formData)
      .subscribe({
        next: () => {
          this.isSubmitting = false;
          this.toastservice.show('חסימת המשתמש שוחררה בהצלחה ', 'success');
          this.closeUnblockConfirmationModal();
        },
        error: (err) => {
          this.isSubmitting = false;
          this.toastservice.show('שגיאה בשחרור חסימת המשתמש ', 'error');
          console.error('Error unblocking user:', err);
        },
      });
  }

  private createFormDataForUserUpdate(
    user: User,
    isBlocked: boolean,
    blockExpiresAt: string | null,
    blockReason: string | null
  ): FormData {
    const formData = new FormData();

    formData.append('first_name', user.first_name || '');
    formData.append('last_name', user.last_name || '');
    formData.append('username', user.username || '');
    formData.append('email', user.email || '');
    formData.append('phone', user.phone || '');
    formData.append('role', user.role || '');

    if (user.department_id) {
      formData.append('department_id', user.department_id);
    } else {
      formData.append('department_id', '');
    }

    formData.append(
      'has_government_license',
      String(user.has_government_license || false)
    );

    if (user.license_expiry_date) {
      const date = new Date(user.license_expiry_date);
      const formattedDate = date.toISOString().split('T')[0];
      formData.append('license_expiry_date', formattedDate);
    } else {
      formData.append('license_expiry_date', '');
    }

    formData.append('is_blocked', String(isBlocked));

    if (blockExpiresAt) {
      formData.append('block_expires_at', blockExpiresAt);
    } else {
      formData.append('block_expires_at', '');
    }
    if (blockReason) {
      formData.append('block_reason', blockReason);
    } else {
      formData.append('block_reason', '');
    }

    return formData;
  }

  goToUserCard(userId: string): void {
    const dialogRef = this.dialog.open(UserCardComponent, {
      width: '90%',
      maxWidth: '900px',
      maxHeight: '90vh',
      panelClass: 'user-card-dialog',
      data: { userId: userId },
      disableClose: false,
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result?.action === 'edit') {
        this.router.navigate(['/user-data-edit', result.userId]);
      }
    });
  }
  get totalPages(): number {
    return Math.ceil(this.filteredLogs.length / this.pageSize) || 1;
  }

  get pagedUsers(): User[] {
    const start = (this.currentPage - 1) * this.pageSize;
    const end = start + this.pageSize;
    return this.filteredLogs.slice(start, end);
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) this.currentPage++;
  }

  prevPage(): void {
    if (this.currentPage > 1) this.currentPage--;
  }

  filterLogs(): void {
    const term = this.searchTerm.toLowerCase().trim();
    this.filteredLogs = this.users.filter((user) => {
      const nameMatch =
        user.first_name?.toLowerCase().includes(term) ||
        user.last_name?.toLowerCase().includes(term) ||
        user.email?.toLowerCase().includes(term);

      const userRole = user.isRaan ? 'raan' : user.role;
      const roleMatch = this.selectedRole === '' || userRole === this.selectedRole;

      return nameMatch && roleMatch;
    });
    this.currentPage = 1;
  }

  deleteUser(userId: string): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      height: 'auto',
      data: {
        title: 'מחיקת משתמש',
        message: '?האם אתה בטוח שברצונך למחוק את המשתמש',
        confirmText: 'מחק משתמש',
        cancelText: 'חזור',
        noRestoreText: 'שימ/י לב שלא ניתן לשחזר את המשתמש',
        isDestructive: true,
      },
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;

      this.userService.deleteUser(userId).subscribe({
        next: () => {
          this.toastservice.show('המשתמש נמחק בהצלחה ', 'success');
          this.users = this.users.filter((u) => u.employee_id !== userId);
          this.filterLogs();
          this.socketservice.deleteUserRequests$.next(userId);
        },
        error: () => {
          this.toastservice.show('שגיאה במחיקת המשתמש ', 'error');
        },
      });
    });
  }

  checkLicence(users: User[]): void {
    const now = new Date();
    users.forEach((user) => {
      if (user.license_expiry_date) {
        const expiryDate = new Date(user.license_expiry_date);
        const isExpired = expiryDate < now;
        this.licenceExpiredMap[user.employee_id] = isExpired;
      } else {
        this.licenceExpiredMap[user.employee_id] = false;
      }
    });
  }

  loadUsers() {
    this.userService.getAllUsers().subscribe({
      next: (usersData) => {
        this.users = usersData;
        this.filterLogs();
        this.checkLicence(usersData);
      },
      error: (err) => console.error('Error fetching users:', err),
    });
  }

  showToast(message: string, isError: boolean = false) {
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.className = `custom-toast ${isError ? 'error' : 'success'}`;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 3000);
  }

  getDisplayRole(user: User): string {
    const roleKey = user.isRaan ? 'raan' : user.role;
    return this.roleLabels[roleKey] || user.role;
  }
}
