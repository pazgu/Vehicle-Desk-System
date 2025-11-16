import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-delete-log',
  templateUrl: './delete-log.component.html',
  imports:[CommonModule,FormsModule],
  styleUrls: ['./delete-log.component.css']
})
export class DeleteDataDisplayComponent {
  @Input() selectedLog: any;
  @Input() getCityName!: (id: string) => string;
  @Input() translateRideType!: (type: string) => string;
  @Input() translateRideStatus!: (status: string) => string;
  @Input() translateUserRole!: (role: string) => string;
  @Input() translateFuelType!: (fuel: string) => string;
  @Input() getDepartmentNameById!: (id: string) => string;
}
