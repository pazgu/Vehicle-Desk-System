import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { translateFuelType,translateVehicleStatus
  ,translateFreezeReason,translateRideStatus
  ,translateRideType,translateUserRole,getDepartmentNameById,getVehicleModel,
  getPlateNumber,getUserFullNameById,getUsernameById,formatRouteFromChangeData
 } from '../../audit-logs-utils/helpers';

 import { rideFieldLabels } from '../../audit-logs-utils/entities-fields';
import { Router } from '@angular/router';
@Component({
  selector: 'app-insert-log',
  imports:[CommonModule, FormsModule],
  templateUrl: './insert-log.component.html',
  styleUrls: ['./insert-log.component.css']
})
export class InsertLogComponent {
  @Input() log: any;
  @Input() cityMap!: Record<string, string>;
  @Input() departments!: { id: string; name: string }[];
  @Input() users!: { id: string; first_name: string; last_name: string; user_name: string }[];
  @Input() vehicles!: { id: string; vehicle_model: string; plate_number: string }[];

  objectKeys = Object.keys;

  constructor(private router:Router){}

translateUserRole=translateUserRole
translateVehicleStatus=translateVehicleStatus
translateFuelType=translateFuelType
translateFreezeReason=translateFreezeReason
translateRideType=translateRideType
translateRideStatus=translateRideStatus
getDeptName(id: string | null | undefined) {
    return getDepartmentNameById(id, this.departments);
  }
  getUsername(id: string) {
    return getUsernameById(id, this.users);
  }

  getPlateNumberById(id: string) {
    return getPlateNumber(id, this.vehicles);
  }
  getVehicleModelById(id: string) {
    return getVehicleModel(id, this.vehicles);
  }

  getUserFullName(id: string) {
    return getUserFullNameById(id, this.users);
  }

 getRideFieldLabel(key: string): string {
    return rideFieldLabels[key] || key;
  }


vehicleRedirect(vehicleId: string) {
    if (vehicleId) {
      this.router.navigate(['/vehicle-details', vehicleId]);
    }
  }


  formatRoute(changeData: any) {
    return formatRouteFromChangeData(changeData, this.cityMap);
  }
}
