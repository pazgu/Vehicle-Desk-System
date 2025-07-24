import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule} from '@angular/router';
import { UserService } from '../../../../services/user_service';
import { Observable } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

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
  this.userService.getDepartmentsWithSupervisors().subscribe({
    next: (departmentsdata) => {
      console.log('Departments fetched successfully:', departmentsdata);
      this.departments = departmentsdata;
      
    },
    error: (err) => {
      console.error('Error fetching roles:', err);
    }
  });
}

userFullName: string = '';

getUserFullNameById(id: string): Observable<string> {
  return this.userService.getUserById(id).pipe(
    map(user => `${user.first_name} ${user.last_name}`),
    catchError(() => of('לא ידוע'))
  );
}


}
