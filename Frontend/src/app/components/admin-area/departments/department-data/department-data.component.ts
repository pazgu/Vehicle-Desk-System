import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import { DepartmentService } from '../../../../services/department_service';
import { ToastService } from '../../../../services/toast.service';
import { UserService } from '../../../../services/user_service';
import { NgPlaceholderTemplateDirective } from '@ng-select/ng-select';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmDialogComponent } from '../../../page-area/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-department-data',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule],
  templateUrl: './department-data.component.html',
  styleUrl: './department-data.component.css',
})
export class DepartmentDataComponent implements OnInit {
  constructor(
    private departmentService: DepartmentService,
    private fb: FormBuilder,
    private toastService: ToastService,
    private userService: UserService,
    private dialog: MatDialog

  ) {}

  departments: any[] = [];
  users: any[] = [];
  editSupervisors: any[] = [];
  isNewDepartmentMode: boolean = false;
  newDepartmentForm!: FormGroup;
  isEditModalOpen: boolean = false;
  editDepartmentForm!: FormGroup;
  editedDepartmentId: string | null = null;
  hoveredDepartmentId: string | null = null;
  isSubmitting: boolean = false;


  ngOnInit() {
    this.loadDepartments();
    this.loadUsers();

    this.newDepartmentForm = this.fb.group({
      name: ['', Validators.required],
      supervisor_id: ['', Validators.required],
    });

    this.editDepartmentForm = this.fb.group({
      department_id: ['', Validators.required],
      name: ['', Validators.required],
      supervisor_id: ['', Validators.required],
    });
  }

  loadDepartments() {
    this.departmentService.getDepartmentsWithSupervisors().subscribe({
      next: (departmentsdata) => {
        this.departments = departmentsdata;
        this.loadSupervisorNames();
      },
      error: () => console.error('Error fetching departments:'),
    });
  }

  loadUsers() {
    this.userService.getAllUsers().subscribe({
      next: (usersData) => {
        const allSupervisors = usersData.filter(
          (user) => user.role === 'supervisor' && !user.isRaan && !user.is_blocked
        );
        
        const assignedSupervisorIds = new Set(
          this.departments
            .filter(dep => dep.supervisor_id) 
            .map((dep) => dep.supervisor_id)
        );
        
        this.users = allSupervisors.filter(
          (supervisor) => !assignedSupervisorIds.has(supervisor.employee_id)
        );
      },
    });
  }

  supervisorNames: { [id: string]: string } = {};

  loadSupervisorNames() {
    this.departments.forEach((dep) => {
      if (dep.supervisor_id && !this.supervisorNames[dep.supervisor_id]) {
        this.userService.getUserById(dep.supervisor_id).subscribe((user) => {
          this.supervisorNames[
            dep.supervisor_id
          ] = `${user.first_name} ${user.last_name}`;
        });
      }
    });
  }

  isUnassignedDepartment(department: any): boolean {
    return department.name === 'Unassigned';
  }

  isVIPDepartment(department: any): boolean {
    return department.name === 'VIP';
  }

  isProtectedDepartment(department: any): boolean {
    return this.isUnassignedDepartment(department) || this.isVIPDepartment(department);
  }

  setHoveredDepartment(departmentId: string | null): void {
    this.hoveredDepartmentId = departmentId;
  }

  openEditModal(department: any) {
    if (this.isUnassignedDepartment(department)) {
      this.toastService.show('לא ניתן לערוך את מחלקת "Unassigned"', 'error');
      return;
    }
    if (this.isVIPDepartment(department)) {
      this.toastService.show('לא ניתן לערוך את מחלקת "VIP"', 'error');
      return;
    }
    
    this.editedDepartmentId = department.id;
    
    this.editSupervisors = [];
    
    if (department.supervisor_id) {
      this.userService.getUserById(department.supervisor_id).subscribe({
        next: (currentSupervisor) => {
          const isValidSupervisor = currentSupervisor.role === 'supervisor' && 
                                    !currentSupervisor.isRaan;
          
          if (isValidSupervisor) {
            const supervisorExists = this.users.some(
              (s) => s.employee_id === currentSupervisor.employee_id
            );
            if (!supervisorExists) {
              const supervisorToAdd = {
                ...currentSupervisor,
                disabled: currentSupervisor.is_blocked
              };
              this.editSupervisors = [supervisorToAdd, ...this.users];
            } else {
              this.editSupervisors = [...this.users];
            }
            
            if (currentSupervisor.is_blocked) {
              const blockExpiresAt = currentSupervisor.block_expires_at 
                ? new Date(currentSupervisor.block_expires_at)
                : null;
              
              let warningMessage = 'מנהל המחלקה הנוכחי חסום';
              
              if (blockExpiresAt) {
                const day = blockExpiresAt.getDate().toString().padStart(2, '0');
                const month = (blockExpiresAt.getMonth() + 1).toString().padStart(2, '0');
                const year = blockExpiresAt.getFullYear();
                
                const formattedDate = `${day}/${month}/${year}`;
                warningMessage += ` עד ליום ${formattedDate}`;
              }
              
              this.toastService.show(warningMessage, 'warning');
            }
            
            this.editDepartmentForm.patchValue({
              department_id: department.id,
              name: department.name,
              supervisor_id: department.supervisor_id,
            });
          } else {
            this.editSupervisors = [...this.users];
            this.editDepartmentForm.patchValue({
              department_id: department.id,
              name: department.name,
              supervisor_id: '',
            });
          }
        },
        error: () => {
          this.editSupervisors = [...this.users];
          this.editDepartmentForm.patchValue({
            department_id: department.id,
            name: department.name,
            supervisor_id: '',
          });
        },
      });
    } else {
      this.editSupervisors = [...this.users];
      this.editDepartmentForm.patchValue({
        department_id: department.id,
        name: department.name,
        supervisor_id: '',
      });
    }
  
  this.isEditModalOpen = true;
}
  closeEditModal() {
    this.isEditModalOpen = false;
    this.editDepartmentForm.reset();
    this.editedDepartmentId = null;
    this.editSupervisors = []; 
  }

  updateDepartment() {
    const departmentIdToUpdate = this.editedDepartmentId;

    if (this.editDepartmentForm.valid && departmentIdToUpdate !== null) {
      const { name, supervisor_id } = this.editDepartmentForm.value;

      this.isSubmitting = true;
      this.departmentService
        .updateDepartment(String(departmentIdToUpdate), name, supervisor_id)
        .subscribe({
          next: () => {
            this.isSubmitting = false;
            this.closeEditModal();
            this.loadDepartments();
            this.loadUsers(); 
            this.toastService.show('המחלקה עודכנה בהצלחה', 'success');
          },
          error: (err) => {
            this.isSubmitting = false;
            
            let errorMessage = 'שגיאה בעדכון מחלקה';
            
            if (err.status === 409) {
              errorMessage = 'שם מחלקה כבר קיים במערכת';
            } else if (err.status === 400) {
              const errorText = JSON.stringify(err.error).toLowerCase();
              
              if (errorText.includes('supervisor') || errorText.includes('role')) {
                errorMessage = 'ניתן לשייך רק משתמש בתפקיד מנהל למחלקה';
              } else if (errorText.includes('name')) {
                errorMessage = 'שם המחלקה אינו תקין';
              } else if (err.error?.message) {
                errorMessage = err.error.message;
              } else if (err.error?.error) {
                errorMessage = err.error.error;
              } else if (err.error?.detail) {
                errorMessage = err.error.detail;
              } else if (typeof err.error === 'string') {
                errorMessage = err.error;
              } else {
                errorMessage = 'הנתונים שהוזנו אינם תקינים';
              }
            } else if (err.status === 404) {
              errorMessage = 'המחלקה או מנהל המחלקה לא נמצאו במערכת';
            } else if (err.error?.message) {
              errorMessage = err.error.message;
            } else if (err.error?.error) {
              errorMessage = err.error.error;
            }
            
            this.toastService.show(errorMessage, 'error');
          },
        });
    }
  }

  openDeleteModal(department: any) {
  if (this.isUnassignedDepartment(department)) {
    this.toastService.show('לא ניתן למחוק את מחלקת "Unassigned"', 'error');
    return;
  }
  if (this.isVIPDepartment(department)) {
    this.toastService.show('לא ניתן למחוק את מחלקת "VIP"', 'error');
    return;
  }

  const dialogRef = this.dialog.open(ConfirmDialogComponent, {
    data: {
      title: 'אישור מחיקה',
      message: `האם את/ה בטוח שברצונך למחוק את המחלקה "${department.name}"? כל המשתמשים שהיו משויכים למחלקה יועברו למחלקת "Unassigned".`,
      noRestoreText: 'פעולה זו אינה ניתנת לביטול',
      confirmText: 'מחק',
      cancelText: 'ביטול',
      isDestructive: true,
    },
    disableClose: true,
    autoFocus: false,
    panelClass: 'confirm-dialog-panel', // optional if you want
  });

  dialogRef.afterClosed().subscribe((confirmed: boolean) => {
    if (!confirmed) return;
    this.confirmDelete(department);
  });
}



  confirmDelete(department: any) {
  if (!department) return;

  this.isSubmitting = true;

  this.departmentService.deleteDepartment(department.id).subscribe({
    next: () => {
      this.isSubmitting = false;
      this.loadDepartments();
      this.toastService.show('מחלקה נמחקה בהצלחה', 'success');
    },
    error: (err) => {
      this.isSubmitting = false;
      let errorMessage = 'שגיאה במחיקת מחלקה';

      if (err.status === 404) {
        errorMessage = 'המחלקה לא נמצאה במערכת';
      } else if (err.status === 403) {
        errorMessage = 'אין הרשאה למחוק מחלקה זו';
      } else if (err.error?.message) {
        errorMessage = err.error.message;
      } else if (err.error?.error) {
        errorMessage = err.error.error;
      }

      this.toastService.show(errorMessage, 'error');
    },
  });
}


    toggleNewDepartmentMode() {
      this.isNewDepartmentMode = !this.isNewDepartmentMode;
      if (!this.isNewDepartmentMode) {
        this.newDepartmentForm.reset();
      } else {
        this.loadUsers();
      }
    }
  submitNewDepartment() {
    if (this.newDepartmentForm.valid) {
      const { name, supervisor_id } = this.newDepartmentForm.value;

      this.isSubmitting = true;
      this.departmentService.createDepartment(name, supervisor_id).subscribe({
        next: () => {
          this.newDepartmentForm.reset();
          this.isNewDepartmentMode = false;
          this.isSubmitting = false;
          this.loadDepartments();
          this.toastService.show('המחלקה נוספה בהצלחה', 'success');
        },
        error: (err) => {
          this.isSubmitting = false;
          
          let errorMessage = 'שגיאה ביצירת מחלקה';
          
          if (err.status === 409) {
            errorMessage = 'שם מחלקה כבר קיים במערכת';
          } else if (err.status === 400) {
            const errorText = JSON.stringify(err.error).toLowerCase();
            
            if (errorText.includes('supervisor') || errorText.includes('role')) {
              errorMessage = 'ניתן לשייך רק משתמש בתפקיד מנהל מחלקה';
            } else if (errorText.includes('name')) {
              errorMessage = 'שם המחלקה אינו תקין';
            } else if (err.error?.message) {
              errorMessage = err.error.message;
            } else if (err.error?.error) {
              errorMessage = err.error.error;
            } else if (err.error?.detail) {
              errorMessage = err.error.detail;
            } else if (typeof err.error === 'string') {
              errorMessage = err.error;
            } else {
              errorMessage = 'הנתונים שהוזנו אינם תקינים';
            }
          } else if (err.status === 404) {
            errorMessage = 'המנהל שנבחר לא נמצא במערכת';
          } else if (err.error?.message) {
            errorMessage = err.error.message;
          } else if (err.error?.error) {
            errorMessage = err.error.error;
          }
          
          this.toastService.show(errorMessage, 'error');
        },
      });
    }
  }
}
