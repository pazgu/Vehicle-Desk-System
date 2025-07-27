import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule} from '@angular/router';
import { UserService } from '../../../../services/user_service';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { DepartmentService } from '../../../../services/department_service'; // adjust path if needed

@Component({
  selector: 'app-department-data',
  imports: [ CommonModule, RouterModule, ReactiveFormsModule
  ],
  templateUrl: './department-data.component.html',
  styleUrl: './department-data.component.css'
})export class DepartmentDataComponent {
  constructor(
    private userService: UserService,
    private departmentService: DepartmentService,
    private fb: FormBuilder
  ) {}

  departments: any[] = [];
  users: any[] = [];
  isEditMode: boolean = false;
  isNewDepartmentMode: boolean = false;

  newDepartmentForm!: FormGroup;

  ngOnInit() {
    this.loadDepartments();
    this.loadUsers();

    this.newDepartmentForm = this.fb.group({
   
      name: ['', Validators.required],
      supervisor_id: ['', Validators.required] // user id from dropdown
    });
  }

  loadDepartments() {
    this.userService.getDepartmentsWithSupervisors().subscribe({
      next: (departmentsdata) => this.departments = departmentsdata,
      error: (err) => console.error('Error fetching departments:', err)
    });
  }

  loadUsers() {
    this.userService.getSupervisors().subscribe({
      next: (usersData) => this.users = usersData,
      error: (err) => console.error('Error fetching supervisors:', err)
    });
  }

  toggleEditMode() {
    this.isEditMode = !this.isEditMode;
  }

  toggleNewDepartmentMode() {
    this.isNewDepartmentMode = !this.isNewDepartmentMode;
  }

  submitNewDepartment() {
    if (this.newDepartmentForm.valid) {
      
      const {  name, supervisor_id } = this.newDepartmentForm.value;
      console.log("Creating new department with data:", { name, supervisor_id });

      this.departmentService.createDepartment( name, supervisor_id).subscribe({
        next: () => {
          this.newDepartmentForm.reset();
          this.isNewDepartmentMode = false;
          this.loadDepartments();
        },
        error: (err) => {
          console.error('Error creating department:', err);
        }
      });
    }
  }
}
