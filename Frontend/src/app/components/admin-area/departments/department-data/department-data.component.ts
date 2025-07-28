// department-data.component.ts

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
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
    private fb: FormBuilder
  ) {}

  departments: any[] = [];
  users: any[] = [];
  isNewDepartmentMode: boolean = false;
  newDepartmentForm!: FormGroup;

  // For the edit modal
  isEditModalOpen: boolean = false;
  editDepartmentForm!: FormGroup; // Single form for the modal
  editedDepartmentId: string | null = null; // To store the ID of the department being edited

  hoveredDepartmentId: string | null = null;

  ngOnInit() {
    this.loadDepartments();
    this.loadUsers();

    this.newDepartmentForm = this.fb.group({
      name: ['', Validators.required],
      supervisor_id: ['', Validators.required],
    });

    this.editDepartmentForm = this.fb.group({
      department_id: ['', Validators.required], // This will be set when opening the modal
      name: ['', Validators.required],
      supervisor_id: ['', Validators.required],
    });
  }

  loadDepartments() {
    this.userService.getDepartmentsWithSupervisors().subscribe({
      next: (departmentsdata) => (this.departments = departmentsdata),
      error: (err) => console.error('Error fetching departments:', err),
    });
  }

  loadUsers() {
    this.userService.getSupervisors().subscribe({
      next: (usersData) => (this.users = usersData),
      error: (err) => console.error('Error fetching supervisors:', err),
    });
  }

  setHoveredDepartment(departmentId: string | null): void {
    this.hoveredDepartmentId = departmentId;
  }

  // --- New Modal Logic ---

  openEditModal(department: any) {
  this.editedDepartmentId = department.id; // ✅ ADD THIS LINE

  this.editDepartmentForm.patchValue({
    department_id: department.id, // still fine to keep this
    name: department.name,
    supervisor_id: department.supervisor_id,
  });

  this.isEditModalOpen = true;
}


  closeEditModal() {
    this.isEditModalOpen = false; // Close the modal
    this.editDepartmentForm.reset(); // Reset the form in the modal
    this.editedDepartmentId = null; // Clear the edited department ID
  }

  updateDepartment() {
    // Re-check editedDepartmentId is not null or undefined here,
    // and store it in a local constant for safer use.
    const departmentIdToUpdate = this.editedDepartmentId;

    if (this.editDepartmentForm.valid && departmentIdToUpdate !== null) {
      const { name, supervisor_id, department_id } = this.editDepartmentForm.value;
      console.log('Updating department with data:', {
        department_id,
        name,
        supervisor_id,
      });
     
      this.departmentService
        .updateDepartment(String(departmentIdToUpdate), name, supervisor_id) // Explicitly cast to String
        .subscribe({
          next: () => {
            this.closeEditModal(); // Close modal and reset form on success
            this.loadDepartments(); // Reload departments to reflect changes
          },
          error: (err) => {
            console.error('Error updating department:', err);
            // Optionally, handle error display in the modal
          },
        });
    } else {
      // This block will be hit if editedDepartmentId is null or the form is invalid
      console.error('Cannot update department: editedDepartmentId is null or form is invalid.', {
  
        formValid: this.editDepartmentForm.valid,
        formValue: this.editDepartmentForm.value
      });
      // Optionally, show a user-friendly error message
    }
  }

  // --- Existing New Department Logic ---

  toggleNewDepartmentMode() {
    this.isNewDepartmentMode = !this.isNewDepartmentMode;
    if (!this.isNewDepartmentMode) {
      this.newDepartmentForm.reset();
    }
  }

  submitNewDepartment() {
    if (this.newDepartmentForm.valid) {
      const { name, supervisor_id } = this.newDepartmentForm.value;
      console.log('Creating new department with data:', { name, supervisor_id });

      this.departmentService.createDepartment(name, supervisor_id).subscribe({
        next: () => {
          this.newDepartmentForm.reset();
          this.isNewDepartmentMode = false;
          this.loadDepartments();
        },
        error: (err) => {
          console.error('Error creating department:', err),
            // Optionally, handle error for user feedback
            alert('Failed to create department. Please try again.');
        },
      });
    }
  }
}