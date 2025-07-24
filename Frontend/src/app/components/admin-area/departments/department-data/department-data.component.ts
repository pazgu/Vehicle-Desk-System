import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule} from '@angular/router';
import { UserService } from '../../../../services/user_service';

@Component({
  selector: 'app-department-data',
  imports: [ CommonModule, RouterModule
  ],
  templateUrl: './department-data.component.html',
  styleUrl: './department-data.component.css'
})
export class DepartmentDataComponent {
constructor(private userService: UserService) {}
departments: any[] = [];

ngOnInit() {
  this.userService.getDepartments().subscribe({
    next: (departmentsdata) => {
      console.log('Departments fetched successfully:', departmentsdata);
      this.departments = departmentsdata;
    },
    error: (err) => {
      console.error('Error fetching roles:', err);
    }
  });
}
}
