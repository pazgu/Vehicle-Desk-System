import { Component, Input } from '@angular/core';
import { getUserAuditRows, getRideAuditRows, getVehicleAuditRows, getDepartmentAuditRows,getDepartmentNameById } from '../../audit-logs-utils/helpers';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-update-log',
  templateUrl: './update-log.component.html',
  imports:[CommonModule,FormsModule],
  styleUrls: ['./update-log.component.css']
})
export class UpdateLogComponent {
  @Input() cityMap!: Record<string, string>;
  @Input() selectedLog: any;
  @Input() departments!: { id: string; name: string }[];
  @Input() users!: { id: string; first_name: string; last_name: string; user_name: string }[];
  @Input() vehicles!: { id: string; vehicle_model: string; plate_number: string }[];

  objectKeys = Object.keys;

   
  getAuditRows() {
    const { selectedLog } = this;
    if (!selectedLog?.change_data) return [];

    switch (selectedLog.entity_type) {
      case 'User':
        return getUserAuditRows(selectedLog.change_data.old, selectedLog.change_data.new,this.departments);
      case 'Ride':
        return getRideAuditRows(selectedLog.change_data.old, selectedLog.change_data.new,this.cityMap,this.users,this.vehicles);
      case 'Vehicle':
        return getVehicleAuditRows(selectedLog.change_data.old, selectedLog.change_data.new,this.getDeptName.bind(this));
      case 'Department':
        return getDepartmentAuditRows(selectedLog.change_data.old, selectedLog.change_data.new,this.users);
      default:
        return [];
    }
  }

getDeptName(id: string | null | undefined) {
    return getDepartmentNameById(id, this.departments);
  }
}
