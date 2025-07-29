// src/app/components/user-data/user-data.component.ts
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
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';

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
  availableRoles: string[] = [];
  license_expiry_date?: string;
  licenceExpiredMap: { [userId: string]: boolean } = {};
  isBlockModalOpen: boolean = false;
  blockedUserId: string | null = null;
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
      employee_id: ['', Validators.required],
      is_blocked: [false, Validators.required],
      block_expires_at: ['', Validators.required],
    });

    this.userService.getAllUsers().subscribe({
      next: (users) => {
        this.users = users;
        this.filteredLogs = [...users];
        this.checkLicence(users);
        this.availableRoles = Array.from(new Set(users.map((u) => u.role))).filter(
          Boolean
        );

        this.socketservice.deleteUserRequests$.subscribe((deletedUser) => {
          if (deletedUser) {
            this.users = this.users.filter((u) => u.employee_id !== deletedUser.id);
            this.filterLogs();
          }
        });

        this.socketservice.usersLicense$.subscribe((update) => {
          const idx = this.users.findIndex((u) => u.employee_id === update.id);
          if (idx === -1) return;

          const updatedUser = { ...this.users[idx], ...update };
          if (update.license_expiry_date) {
            updatedUser.license_expiry_date = new Date(update.license_expiry_date);
          }

          // Update the user in the main array
          this.users[idx] = updatedUser;
          this.licenceExpiredMap[update.id] = updatedUser.license_expiry_date < new Date();

          // If the blocked user modal is open for this user, update its form values
          if (this.blockedUserId === update.id) {
            this.blockUserForm.patchValue({
              is_blocked: updatedUser.is_blocked ?? false,
              block_expires_at: updatedUser.block_expires_at
                ? new Date(updatedUser.block_expires_at).toISOString().slice(0, 16)
                : '',
            });
          }

          this.cdr.detectChanges();
        });
      },
      error: (err) => console.error('Failed to fetch users', err),
    });
  }

  departmentNames: { [key: string]: string } = {
    '21fed496-72a3-4551-92d6-7d6b8d979dd6': 'Security',
    '3f67f7d5-d1a4-45c2-9ae4-8b7a3c50d3fa': 'Engineering',
    '912a25b9-08e7-4461-b1a3-80e66e79d29e': 'HR',
    'b3a91e1e-2f42-4e3e-bf74-49b7c8aaf1c7': 'Finance',
  };

  goToUserCard(userId: string): void {
    this.router.navigate(['/user-card', userId]);
  }

  get totalPages(): number {
    return Math.ceil(this.filteredLogs.length / this.pageSize) || 1;
  }

  get pagedUsers(): User[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredLogs.slice().reverse().slice(start, start + this.pageSize);
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) this.currentPage++;
  }

  prevPage(): void {
    if (this.currentPage > 1) this.currentPage--;
  }

  filterLogs(): void {
    const term = this.searchTerm.toLowerCase().trim();
    this.filteredLogs = this.users.filter(
      (user) =>
        (user.first_name?.toLowerCase().includes(term) ||
          user.last_name?.toLowerCase().includes(term) ||
          user.email?.toLowerCase().includes(term)) &&
        (this.selectedRole === '' || user.role === this.selectedRole)
    );
    this.currentPage = 1;
  }

  deleteUser(userId: string): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '380px',
      height: '190px',
      data: {},
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;

      this.userService.deleteUser(userId).subscribe({
        next: () => {
          this.toastservice.show('המשתמש נמחק בהצלחה ✅', 'success');
          this.users = this.users.filter((u) => u.employee_id !== userId);
          this.filterLogs();
          this.socketservice.deleteUserRequests$.next(userId);
        },
        error: () => {
          this.toastservice.show('שגיאה במחיקת המשתמש ❌', 'error');
        },
      });
    });
  }

  checkLicence(users: User[]): void {
    console.log('Checking expired licenses...');
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

  openBlockUserModal(user: User) {
    this.blockedUserId = user.employee_id;
    this.isBlockModalOpen = true;

    // Patch form values after opening the modal
    this.blockUserForm.patchValue({
      employee_id: user.employee_id,
      is_blocked: user.is_blocked ?? false,
      block_expires_at: user.block_expires_at
        ? new Date(user.block_expires_at).toISOString().slice(0, 16)
        : '', // Format date for datetime-local input
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

  closeEditModal() {
    this.isBlockModalOpen = false;
    this.blockUserForm.reset();
    this.blockedUserId = null;
  }

  updateBlockedUser() {
    const userIdToUpdate = this.blockedUserId;

    if (this.blockUserForm.valid && userIdToUpdate !== null) {
      this.isSubmitting = true;

      // Find the user object to get all its current properties
      const userToUpdate = this.users.find((user) => user.employee_id === userIdToUpdate);

      if (!userToUpdate) {
        console.error('User not found for ID:', userIdToUpdate);
        this.isSubmitting = false;
        this.toastservice.show('שגיאה: משתמש לא נמצא ❌', 'error');
        return;
      }

      const formData = new FormData();

      // **Append ALL required fields from the existing user object**
      // Even if you're not changing them, the backend expects them via Form(...)
      formData.append('first_name', userToUpdate.first_name || '');
      formData.append('last_name', userToUpdate.last_name || '');
      formData.append('username', userToUpdate.username || ''); // Assuming username is also required
      formData.append('email', userToUpdate.email || '');
      formData.append('phone', userToUpdate.phone || '');
      formData.append('role', userToUpdate.role || '');

      // Department ID: Handle nullable and UUID conversion for FormData
      if (userToUpdate.department_id) {
        formData.append('department_id', userToUpdate.department_id);
      } else {
        // If department_id is null/undefined in the user object, and it's required for non-admin roles,
        // you might need to send an empty string or a specific default if allowed by backend.
        // For now, sending an empty string if null, assuming backend can handle it for non-admins if role is changed.
        formData.append('department_id', '');
      }

      // has_government_license: Convert boolean to string "true" or "false"
      formData.append('has_government_license', String(userToUpdate.has_government_license || false));

      // license_expiry_date: Convert Date object to YYYY-MM-DD or send empty string
      if (userToUpdate.license_expiry_date) {
        const date = new Date(userToUpdate.license_expiry_date);
        const formattedDate = date.toISOString().split('T')[0]; // YYYY-MM-DD
        formData.append('license_expiry_date', formattedDate);
      } else {
        formData.append('license_expiry_date', '');
      }

      // **Now append the fields you are actually changing:**
      const { is_blocked, block_expires_at } = this.blockUserForm.value;
      formData.append('is_blocked', String(is_blocked)); // Convert boolean to string

      if (block_expires_at) {
        // FastAPI expects YYYY-MM-DDTHH:MM for datetime
        formData.append('block_expires_at', block_expires_at);
      } else {
        formData.append('block_expires_at', ''); // Send empty string to clear it
      }

      // If you had a file input in this form (e.g., license_file), you'd append it here:
      // if (this.licenseFile) { // Assuming you have a property for the selected file
      //   formData.append('license_file', this.licenseFile, this.licenseFile.name);
      // }


      this.userService.updateUser(userIdToUpdate, formData).subscribe({
        next: () => {
          this.isSubmitting = false;
          this.closeEditModal();
          this.loadUsers(); // Reload users to get the updated block status
          this.toastservice.show('המשתמש נחסם/שוחרר בהצלחה ✅', 'success');
        },
        error: (err) => {
          this.isSubmitting = false;
          this.toastservice.show('שגיאה בחסימת המשתמש ❌', 'error');
          console.error('Error updating user:', err);
          console.error('Full error response:', err.error); // This will show the exact missing fields
        },
      });
    }
  }
}