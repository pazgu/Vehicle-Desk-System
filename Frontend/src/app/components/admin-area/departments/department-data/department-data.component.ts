import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { UserService } from '../../../../services/user_service';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import { DepartmentService } from '../../../../services/department_service';

@Component({
  selector: 'app-department-data',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule],
  templateUrl: './department-data.component.html',
  styleUrl: './department-data.component.css',
})
export class DepartmentDataComponent implements OnInit {
  constructor(
    private userService: UserService,
    private departmentService: DepartmentService,
    private fb: FormBuilder,
    private router: Router
  ) {}

  departments: any[] = [];
  users: any[] = [];
  isNewDepartmentMode: boolean = false;
  newDepartmentForm!: FormGroup;
  isEditModalOpen: boolean = false;
  editDepartmentForm!: FormGroup; 
  editedDepartmentId: string | null = null; 
  hoveredDepartmentId: string | null = null;
  isSubmitting: boolean = false; 

  isDeleteModalOpen: boolean = false;
  departmentToDelete: any = null;

  deleteModalMessage: string = ''; 



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
    this.userService.getDepartmentsWithSupervisors().subscribe({
      next: (departmentsdata) => {
        this.departments = departmentsdata;
      },
      error: () => console.error('Error fetching departments:'),
    });
  }

  loadUsers() {
    this.userService.getSupervisors().subscribe({
      next: (usersData) => (this.users = usersData),
      error: (err) => console.error('Error fetching supervisors:', err),
    });
  }

  getSupervisorName(supervisorId: string): string {
    const supervisor = this.users.find(user => user.employee_id === supervisorId);
    return supervisor ? `${supervisor.first_name} ${supervisor.last_name}` : 'לא ידוע';
  }
  isUnassignedDepartment(department: any): boolean {
    return department.name === 'Unassigned';
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

  setHoveredDepartment(departmentId: string | null): void {
    this.hoveredDepartmentId = departmentId;
  }


  openEditModal(department: any) {
    if (this.isUnassignedDepartment(department)) {
      this.showToast('לא ניתן לערוך את מחלקת "Unassigned"', true);
      return;
    }
    this.editedDepartmentId = department.id;
    this.editDepartmentForm.patchValue({
      department_id: department.id,
      name: department.name,
      supervisor_id: department.supervisor_id,
    });
    this.isEditModalOpen = true;
  }



  closeEditModal() {
    this.isEditModalOpen = false;
    this.editDepartmentForm.reset();
    this.editedDepartmentId = null;
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
            this.showToast('המחלקה עודכנה בהצלחה');
          },
          error: (err) => {
            this.isSubmitting = false;
            if (err.status === 409) {
              this.showToast('שם מחלקה כבר קיים', true);
            } else {
              console.error('Error updating department:', err);
              this.showToast('שגיאה בעדכון מחלקה', true);
            }
          },
        });
    }
  }

  openDeleteModal(department: any) {
    if (this.isUnassignedDepartment(department)) {
      this.showToast('לא ניתן למחוק את מחלקת "Unassigned"', true);
      return;
    }

    this.departmentToDelete = department;
    this.isDeleteModalOpen = true;
    this.deleteModalMessage = `האם אתה בטוח שברצונך למחוק את המחלקה "${department.name}"? כל המשתמשים שהיו משויכים למחלקה יועברו למחלקת "Unassigned".`;
  }

  closeDeleteModal() {
    this.isDeleteModalOpen = false;
    this.departmentToDelete = null;
  }

  confirmDelete() {
    if (!this.departmentToDelete) return;

    this.isSubmitting = true;
    this.departmentService.deleteDepartment(this.departmentToDelete.id).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.closeDeleteModal();
        this.showToast('המחלקה נמחקה בהצלחה. מעביר לעמוד נתוני משתמשים.');
        this.router.navigate(['/user-data']);
      },
      error: (err) => {
        this.isSubmitting = false;
        console.error('Error deleting department:', err);
        this.showToast('שגיאה במחיקת מחלקה', true);
        this.closeDeleteModal();
      },
    });
  }

  toggleNewDepartmentMode() {
    this.isNewDepartmentMode = !this.isNewDepartmentMode;
    if (!this.isNewDepartmentMode) {
      this.newDepartmentForm.reset();
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
          this.showToast('המחלקה נוספה בהצלחה');
        },
        error: (err) => {
          this.isSubmitting = false;
          if (err.status === 409) {
            this.showToast('שם מחלקה כבר קיים', true);
          } else {
            console.error('Error creating department:', err);
            this.showToast('שגיאה ביצירת מחלקה', true);
          }
        },
      });
    }
  }

}