// src/app/components/user-data/user-data.component.ts
import { Component, OnInit } from '@angular/core';
import { User } from '../../../../models/user.model';
import { UserService } from '../../../../services/user_service';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms'; // Keep FormsModule if you have other template-driven forms
import { ConfirmDialogComponent } from '../../../page-area/confirm-dialog/confirm-dialog.component';
import { ToastService } from '../../../../services/toast.service';
import { SocketService } from '../../../../services/socket.service';
import { MatDialog } from '@angular/material/dialog';
import { ChangeDetectorRef } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule, // <-- Ensure this is imported for reactive forms
} from '@angular/forms';

@Component({
  selector: 'app-user-data',
  templateUrl: './user-data.component.html',
  styleUrls: ['./user-data.component.css'],
  imports: [RouterModule, CommonModule, FormsModule, ReactiveFormsModule], // Add ReactiveFormsModule
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
  license_expiry_date?: Date;
  licenceExpiredMap: { [userId: string]: boolean } = {};

  // --- New/Updated Properties for Blocking ---
  isBlockUserModalOpen: boolean = false; // Controls the block modal visibility
  isUnblockConfirmationModalOpen: boolean = false; // Controls the unblock modal visibility
  selectedUserForBlock: User | null = null; // Stores the user object selected for blocking/unblocking
  blockUserForm!: FormGroup; // Reactive Form for block duration
  isSubmitting: boolean = false; // To disable buttons during API calls

  constructor(
    private userService: UserService,
    private router: Router,
    private toastservice: ToastService,
    private socketservice: SocketService,
    private dialog: MatDialog, // MatDialog might not be needed if you're building custom modals
    private cdr: ChangeDetectorRef,
    private fb: FormBuilder // Inject FormBuilder
  ) {}

  ngOnInit(): void {
    // Initialize the reactive form for block user
    this.blockUserForm = this.fb.group({
      blockDuration: [14, [Validators.required, Validators.min(1)]], // Default 14 days, min 1
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

        // Listen for user_block_status_updated socket event
        this.socketservice.usersBlockStatus$.subscribe((update) => {
          const idx = this.users.findIndex((u) => u.employee_id === update.id);
          if (idx === -1) return;

          // Create a new user object to ensure immutability and trigger change detection
          const updatedUser = { ...this.users[idx], ...update };
          if (update.block_expires_at) {
            updatedUser.block_expires_at = new Date(update.block_expires_at);
          } else {
            updatedUser.block_expires_at = null; // Ensure it's null if cleared
          }

          // Update the user in the main array
          this.users[idx] = updatedUser;

          // Also update in filteredLogs if applicable
          const filteredIdx = this.filteredLogs.findIndex((u) => u.employee_id === update.id);
          if (filteredIdx !== -1) {
            this.filteredLogs[filteredIdx] = updatedUser;
          }

          // If a modal is open for this user, close it after successful update
          if (this.selectedUserForBlock?.employee_id === update.id) {
            this.closeBlockUserModal(); // Close either block or unblock modal
            this.closeUnblockConfirmationModal();
          }

          this.cdr.detectChanges(); // Manually trigger change detection if needed
        });

        // Also ensure your user_license_updated subscription correctly handles updates.
        // I'm assuming you have socketservice.usersLicense$ defined and working.
        this.socketservice.usersLicense$.subscribe((update) => {
          const idx = this.users.findIndex((u) => u.employee_id === update.id);
          if (idx === -1) return;

          const updatedUser = { ...this.users[idx], ...update };
          if (update.license_expiry_date) {
            updatedUser.license_expiry_date = new Date(update.license_expiry_date);
          }

          this.users[idx] = updatedUser;
          this.licenceExpiredMap[update.id] = updatedUser.license_expiry_date ? updatedUser.license_expiry_date < new Date() : false;

          // If the blocked user modal is open for this user, update its form values
          // (This part is less critical now as we reload users)
          // if (this.blockedUserId === update.id) { ... }

          this.cdr.detectChanges();
        });


      },
      error: (err) => console.error('Failed to fetch users', err),
    });
  }

  // --- Modal Control Methods ---
  openBlockUserModal(user: User) {
    this.selectedUserForBlock = user;
    this.isBlockUserModalOpen = true;
    this.blockUserForm.reset({ blockDuration: 14 }); // Reset with default
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

  // --- Block/Unblock Logic ---

  confirmBlockUser() {
    if (this.blockUserForm.invalid || !this.selectedUserForBlock) {
      this.toastservice.show('יש למלא את כל השדות הנדרשים ✅', 'error');
      return;
    }

    this.isSubmitting = true;
    const blockDuration = this.blockUserForm.get('blockDuration')?.value;
    const now = new Date();
    const blockExpiresAt = new Date(now.setDate(now.getDate() + blockDuration));

    // Prepare FormData with ALL required fields + the block/unblock changes
    const formData = this.createFormDataForUserUpdate(this.selectedUserForBlock, true, blockExpiresAt.toISOString().slice(0, 16)); // YYYY-MM-DDTHH:MM

    this.userService.updateUser(this.selectedUserForBlock.employee_id, formData).subscribe({
      next: () => {
        // Socket.IO will handle updating the UI for users table
        // We'll rely on the socket event to close the modal and show toast
        // this.loadUsers(); // Optional: if you don't use sockets for user list updates
      },
      error: (err) => {
        this.isSubmitting = false;
        this.toastservice.show('שגיאה בחסימת המשתמש ❌', 'error');
        console.error('Error blocking user:', err);
      },
    });
  }

  confirmUnblockUser() {
    if (!this.selectedUserForBlock) {
      return;
    }

    this.isSubmitting = true;

    // Prepare FormData with ALL required fields + the unblock changes
    const formData = this.createFormDataForUserUpdate(this.selectedUserForBlock, false, null); // Set is_blocked to false, block_expires_at to null

    this.userService.updateUser(this.selectedUserForBlock.employee_id, formData).subscribe({
      next: () => {
        // Socket.IO will handle updating the UI for users table
        // We'll rely on the socket event to close the modal and show toast
        // this.loadUsers(); // Optional: if you don't use sockets for user list updates
      },
      error: (err) => {
        this.isSubmitting = false;
        this.toastservice.show('שגיאה בשחרור חסימת המשתמש ❌', 'error');
        console.error('Error unblocking user:', err);
      },
    });
  }

  /**
   * Helper function to create FormData with all required user fields.
   * This is crucial because your backend endpoint expects all fields via Form(...).
   * @param user The current user object.
   * @param isBlocked The new value for is_blocked.
   * @param blockExpiresAt The new value for block_expires_at (YYYY-MM-DDTHH:MM string or null).
   * @returns FormData object.
   */
  private createFormDataForUserUpdate(
    user: User,
    isBlocked: boolean,
    blockExpiresAt: string | null
  ): FormData {
    const formData = new FormData();

    // Append ALL required fields from the existing user object
    formData.append('first_name', user.first_name || '');
    formData.append('last_name', user.last_name || '');
    formData.append('username', user.username || '');
    formData.append('email', user.email || '');
    formData.append('phone', user.phone || '');
    formData.append('role', user.role || '');

    // Department ID: Handle nullable and UUID conversion for FormData
    if (user.department_id) {
      formData.append('department_id', user.department_id);
    } else {
      formData.append('department_id', ''); // Send empty string if null
    }

    // has_government_license: Convert boolean to string "true" or "false"
    formData.append('has_government_license', String(user.has_government_license || false));

    // license_expiry_date: Convert Date object to YYYY-MM-DD or send empty string
    if (user.license_expiry_date) {
      const date = new Date(user.license_expiry_date);
      const formattedDate = date.toISOString().split('T')[0]; // YYYY-MM-DD
      formData.append('license_expiry_date', formattedDate);
    } else {
      formData.append('license_expiry_date', '');
    }

    // Append the SPECIFIC fields being updated
    formData.append('is_blocked', String(isBlocked)); // Boolean to string

    if (blockExpiresAt) {
      formData.append('block_expires_at', blockExpiresAt);
    } else {
      formData.append('block_expires_at', ''); // Send empty string to clear it (set to null on backend)
    }

    return formData;
  }


  // --- Existing Methods (keep them as they are) ---
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

  showToast(message: string, isError: boolean = false) {
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.className = `custom-toast ${isError ? 'error' : 'success'}`;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 3000);
  }


}