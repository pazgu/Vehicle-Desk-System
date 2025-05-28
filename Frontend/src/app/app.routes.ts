import { Routes } from '@angular/router';
import { LoginComponent } from './components/page-area/login-area/user-area/login/login.component';
import { Page404Component } from './components/page-area/page404/page404.component';
import { HomeComponent } from './components/page-area/home/home.component';
import { NewRideComponent } from './ride-area/new-ride/new-ride.component';
import { RegisterComponent } from './components/page-area/login-area/user-area/register/register.component';
import { DashboardAllOrdersComponent } from './components/supervisor-area/dashboard-all-orders/dashboard-all-orders.component';
import { OrderCardComponent } from './components/supervisor-area/order-card/order-card.component';
import { NotificationsComponent } from './components/page-area/notifications/notifications.component';
import { RedirectByRoleComponent } from './services/redirect-by-role';
import { ProtectedRouteGuard } from './components/auth-area/protectedroute/protected-route.guard';
import { UserDataComponent } from './components/admin-area/user-data/user-data.component';
import { UserDataEditComponent } from './components/admin-area/user-data-edit/user-data-edit.component';
import { UserCardComponent } from './components/admin-area/user-card/user-card.component';
import { VehicleCardItemComponent } from './components/admin-area/vehicle-card-item/vehicle-card-item.component';
import { VehicleDashboardComponent } from './components/admin-area/vehicle-dashboard/vehicle-dashboard.component';
import { RideCompletionFormComponent } from './components/page-area/ride-completion-form/ride-completion-form.component';
import { AuditLogsComponent } from './components/admin-area/audit-logs/audit-logs.component';
import { AvailableAndFrozenCarsComponent } from './inspector-area/available-and-frozen-cars/available-and-frozen-cars.component';


export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'home', component: HomeComponent, canActivate: [ProtectedRouteGuard] },
  { path: 'new-ride', component: NewRideComponent, canActivate: [ProtectedRouteGuard] },
  {
  path: 'ride/edit/:id',
  loadComponent: () => import('./ride-area/edit-ride/edit-ride.component').then(m => m.EditRideComponent),
  canActivate: [ProtectedRouteGuard]
},
  { path: 'supervisor-dashboard', component: DashboardAllOrdersComponent, canActivate: [ProtectedRouteGuard] },
  { path: 'order-card/:ride_id', component: OrderCardComponent, canActivate: [ProtectedRouteGuard] },
  { path: 'notifications', component: NotificationsComponent, canActivate: [ProtectedRouteGuard] },
  { path: '', component: RedirectByRoleComponent, pathMatch: 'full' },
  
  { path: 'user-data-edit/:user_id', component: UserDataEditComponent,canActivate: [ProtectedRouteGuard] }, // Moved lower
  { path: 'user-card/:user_id', component: UserCardComponent,canActivate: [ProtectedRouteGuard] }, // Moved lower
  { path: 'user-data', component: UserDataComponent,canActivate: [ProtectedRouteGuard] }, 
  { path: 'vehicle-details/:id', component: VehicleCardItemComponent },
  { path: 'vehicle-dashboard', component: VehicleDashboardComponent },
  { path: 'ride-completion-form/:ride_id', component: RideCompletionFormComponent },
  { path: 'audit-logs', component: AuditLogsComponent },
{
  path: 'ride/details/:id',
  loadComponent: () => import('./ride-area/ride-details/ride-details.component').then(m => m.RideDetailsComponent)
},
{
  path: 'archived-orders',
  loadComponent: () =>
    import('./ride-area/archived-orders/archived-orders.component').then(m => m.ArchivedOrdersComponent)
},
{
  path: 'inspector/inspection',
  loadComponent: () =>
    import('./inspector-area/vehicle-inspection/vehicle-inspection.component').then(m => m.VehicleInspectionComponent)
},

{
  path: 'admin/daily-inspections',
  loadComponent: () =>
    import('./components/admin-area/admin-inspections/admin-inspections.component')
      .then(m => m.AdminInspectionsComponent),
  canActivate: [ProtectedRouteGuard]
},
{
  path: 'inspector/vehicles',
  component: AvailableAndFrozenCarsComponent
},


  { path: '**', component: Page404Component }
];


