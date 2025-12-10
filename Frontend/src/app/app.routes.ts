import { Routes } from '@angular/router';
import { LoginComponent } from './components/page-area/login-area/user-area/login/login.component';
import { Page404Component } from './components/page-area/page404/page404.component';
import { AllRidesComponent } from './ride-area/all-rides/all-rides.component';
import { NewRideComponent } from './components/page-area/home/home.component';
import { RegisterComponent } from './components/page-area/login-area/user-area/register/register.component';
import { DashboardAllOrdersComponent } from './components/supervisor-area/dashboard-all-orders/dashboard-all-orders.component';
import { OrderCardComponent } from './components/supervisor-area/order-card/order-card.component';
import { NotificationsComponent } from './components/page-area/notifications/notifications.component';
import { RedirectByRoleComponent } from './services/redirect-by-role';
import { ProtectedRouteGuard } from './components/auth-area/protectedroute/protected-route.guard';
import { UserDataComponent } from './components/admin-area/users/user-data/user-data.component';
import { UserDataEditComponent } from './components/admin-area/users/user-data-edit/user-data-edit.component';
import { UserCardComponent } from './components/admin-area/users/user-card/user-card.component';
import { VehicleCardItemComponent } from './components/vehicle-area/vehicle-card-item/vehicle-card-item.component';
import { VehicleDashboardComponent } from './components/vehicle-area/vehicle-dashboard/vehicle-dashboard.component';
import { RideCompletionFormComponent } from './components/page-area/ride-completion-form/ride-completion-form.component';
import { AuditLogsComponent } from './components/admin-area/audit-logs/audit-logs.component';
import { ForgotPasswordComponent } from './components/auth-area/forgot-password/forgot-password.component';
import { ResetPasswordComponent } from './components/auth-area/reset-password/reset-password.component';
import { AdminAnalyticsComponent } from './components/admin-area/admin-analytics/admin-analytics.component';
import { AddNewUserComponent } from './components/admin-area/users/add-new-user/add-new-user.component';
import { AddVehicleComponent } from './components/vehicle-area/add-vehicle/add-vehicle.component';
import { ArchivedVehiclesComponent } from './components/vehicle-area/archived-vehicles/archived-vehicles.component';
import { DepartmentDataComponent } from './components/admin-area/departments/department-data/department-data.component';
import { EditRideComponent } from './ride-area/edit-ride/edit-ride.component';
import { LoginRedirectGuard } from './components/auth-area/login-redirect/login-redirect.component';
import { provideRouter, withInMemoryScrolling } from '@angular/router';

export const routes: Routes = [
  {
    path: 'login',
    component: LoginComponent,
    canActivate: [LoginRedirectGuard],
  },
  {
    path: 'register',
    component: RegisterComponent,
    canActivate: [LoginRedirectGuard],
  },

  {
    path: 'home',
    component: NewRideComponent,
    canActivate: [ProtectedRouteGuard],
  },
  {
    path: 'all-rides',
    component: AllRidesComponent,
    canActivate: [ProtectedRouteGuard],
  },


  {
    path: 'ride/edit/:id',
    component: EditRideComponent,
    canActivate: [ProtectedRouteGuard],
  },
  {
    path: 'supervisor-dashboard',
    component: DashboardAllOrdersComponent,
    canActivate: [ProtectedRouteGuard],
  },
  {
    path: 'order-card/:ride_id',
    component: OrderCardComponent,
    canActivate: [ProtectedRouteGuard],
  },
  {
    path: 'notifications',
    component: NotificationsComponent,
    canActivate: [ProtectedRouteGuard],
  },
  { path: '', component: RedirectByRoleComponent, pathMatch: 'full' },

  {
    path: 'user-data-edit/:user_id',
    component: UserDataEditComponent,
    canActivate: [ProtectedRouteGuard],
  },
  {
    path: 'user-card/:user_id',
    component: UserCardComponent,
    canActivate: [ProtectedRouteGuard],
  },
  {
    path: 'user-data',
    component: UserDataComponent,
    canActivate: [ProtectedRouteGuard],
  },
  {
    path: 'vehicle-details/:id',
    component: VehicleCardItemComponent,
    canActivate: [ProtectedRouteGuard],
  },
  {
    path: 'vehicle-dashboard',
    component: VehicleDashboardComponent,
    canActivate: [ProtectedRouteGuard],
  },
  {
    path: 'vehicle-dashboard/new-vehicle',
    component: AddVehicleComponent,
    canActivate: [ProtectedRouteGuard],
  },
  {
    path: 'department-data',
    component: DepartmentDataComponent,
    canActivate: [ProtectedRouteGuard],
  },

  {
    path: 'ride-completion-form/:ride_id',
    component: RideCompletionFormComponent,
    canActivate: [ProtectedRouteGuard],
  },
  {
    path: 'audit-logs',
    component: AuditLogsComponent,
    canActivate: [ProtectedRouteGuard],
  },
  { path: 'forgot-password', component: ForgotPasswordComponent },
  {
    path: 'reset-password/:token',
    component: ResetPasswordComponent,
    canActivate: [ProtectedRouteGuard],
  },
  {
    path: 'archived-vehicles',
    component: ArchivedVehiclesComponent,
    canActivate: [ProtectedRouteGuard],
  },
  {
    path: 'admin/analytics',
    component: AdminAnalyticsComponent,
    canActivate: [ProtectedRouteGuard],
  },
  {
    path: 'admin/guidelines',
    loadComponent: () =>
      import(
        './components/admin-area/admin-guidelines/admin-guidelines.component'
      ).then((m) => m.AdminGuidelinesComponent),
    canActivate: [ProtectedRouteGuard],
  },

  {
    path: 'ride/details/:id',
    loadComponent: () =>
      import('./ride-area/ride-details/ride-details.component').then(
        (m) => m.RideDetailsComponent
      ),
    canActivate: [ProtectedRouteGuard],
  },
  {
    path: 'inspector/inspection',
    loadComponent: () =>
      import(
        './inspector-area/vehicle-inspection/vehicle-inspection.component'
      ).then((m) => m.VehicleInspectionComponent),
    canActivate: [ProtectedRouteGuard],
  },

  {
    path: 'admin/critical-issues',
    loadComponent: () =>
      import(
        './components/admin-area/admin-inspections/admin-inspections.component'
      ).then((m) => m.AdminInspectionsComponent),
    canActivate: [ProtectedRouteGuard],
  },

  {
    path: 'vehicle-details/:id/timeline',
    loadComponent: () =>
      import(
        './components/vehicle-area/vehicle-timeline/vehicle-timeline.component'
      ).then((m) => m.VehicleTimelineComponent),
    canActivate: [ProtectedRouteGuard],
  },

  {
    path: 'admin/add-new-user',
    loadComponent: () =>
      import(
        './components/admin-area/users/add-new-user/add-new-user.component'
      ).then((m) => m.AddNewUserComponent),
    canActivate: [ProtectedRouteGuard], 
  },

  { path: '**', component: Page404Component },
];

export const appRouterProviders = [
  provideRouter(
    routes,
    withInMemoryScrolling({
      scrollPositionRestoration: 'top',
    })
  )
];
