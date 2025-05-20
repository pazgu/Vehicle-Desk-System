import { Routes } from '@angular/router';
import { LoginComponent } from './components/page-area/login-area/user-area/login/login.component';
import { Page404Component } from './components/page-area/page404/page404.component';
import { HomeComponent } from './components/page-area/home/home.component';
import { NewRideComponent } from './ride-area/new-ride/new-ride.component';
import { RegisterComponent } from './components/page-area/login-area/user-area/register/register.component';
import { DashboardAllOrdersComponent } from './components/supervisor-area/dashboard-all-orders/dashboard-all-orders.component';
import { OrderCardComponent } from './components/supervisor-area/order-card/order-card.component';
import { NotificationsComponent } from './components/page-area/notifications/notifications.component';
import { CarsComponent } from './components/admin-area/cars/cars.component';
import { DailyChecksComponent } from './components/admin-area/daily-checks/daily-checks.component';
import { RedirectByRoleComponent } from './services/redirect-by-role';
import { ProtectedRouteGuard } from './components/auth-area/protectedroute/protected-route.guard';
import { UserDataComponent } from './components/admin-area/user-data/user-data.component';
import { VehicleDashboardComponent } from './components/supervisor-area/vehicle-dashboard/vehicle-dashboard.component';
import { VehicleCardItemComponent } from './components/vehicle-card-item/vehicle-card-item.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'cars', component: CarsComponent, canActivate: [ProtectedRouteGuard] },
  { path: 'home', component: HomeComponent, canActivate: [ProtectedRouteGuard] },
  { path: 'new-ride', component: NewRideComponent, canActivate: [ProtectedRouteGuard] },
  {
  path: 'ride/edit/:id',
  loadComponent: () => import('./ride-area/edit-ride/edit-ride.component').then(m => m.EditRideComponent),
  canActivate: [ProtectedRouteGuard]
},
  { path: 'supervisor-dashboard', component: DashboardAllOrdersComponent, canActivate: [ProtectedRouteGuard] },
  { path: 'order-card/:ride_id', component: OrderCardComponent, canActivate: [ProtectedRouteGuard] },
  { path:'vehicle-dashboard', component: VehicleDashboardComponent },
  { path: 'notifications', component: NotificationsComponent, canActivate: [ProtectedRouteGuard] },
  { path: 'daily-checks', component: DailyChecksComponent, canActivate: [ProtectedRouteGuard] },
  { path: '', component: RedirectByRoleComponent, pathMatch: 'full' },
  { path: 'user-data', component: UserDataComponent }, 
  { path: 'vehicle-details/:id', component: VehicleCardItemComponent },
  { path: '**', component: Page404Component }
];


