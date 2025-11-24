import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import { DepartmentService } from '../../../../services/department_service';
import { ToastService } from '../../../../services/toast.service';
import { UserService } from '../../../../services/user_service';
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
    private userService: UserService
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
    this.departmentService.getDepartmentsWithSupervisors().subscribe({
      next: (departmentsdata) => {
        this.departments = departmentsdata;
        this.loadSupervisorNames();
      },
      error: () => console.error('Error fetching departments:'),
    });
  }

  loadUsers() {
    this.departmentService.getSupervisors().subscribe({
      next: (usersData) => (this.users = usersData),
      error: (err) => console.error('Error fetching supervisors:', err),
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

  setHoveredDepartment(departmentId: string | null): void {
    this.hoveredDepartmentId = departmentId;
  }

  openEditModal(department: any) {
    if (this.isUnassignedDepartment(department)) {
      this.toastService.show('לא ניתן לערוך את מחלקת "Unassigned"', 'error');
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
            this.toastService.show('המחלקה עודכנה בהצלחה', 'success');
          },
          error: (err) => {
            this.isSubmitting = false;
            if (err.status === 409) {
              this.toastService.show('שם מחלקה כבר קיים', 'error');
            } else {
              this.toastService.show('שגיאה בעדכון מחלקה', 'error');
            }
          },
        });
    }
  }

  openDeleteModal(department: any) {
    if (this.isUnassignedDepartment(department)) {
      this.toastService.show('לא ניתן למחוק את מחלקת "Unassigned"', 'error');
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
    this.departmentService
      .deleteDepartment(this.departmentToDelete.id)
      .subscribe({
        next: () => {
          this.isSubmitting = false;
          this.closeDeleteModal();
          this.loadDepartments();
          this.toastService.show('מחלקה נמחקה בהצלחה', 'success');
        },
        error: (err) => {
          this.isSubmitting = false;
          this.toastService.show('שגיאה במחיקת מחלקה', 'error');
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
          this.toastService.show('המחלקה נוספה בהצלחה', 'success');
        },
        error: (err) => {
          this.isSubmitting = false;
          if (err.status === 409) {
            this.toastService.show('שם מחלקה כבר קיים', 'error');
          } else {
            this.toastService.show('שגיאה ביצירת מחלקה', 'error');
          }
        },
      });
    }
  }
}
