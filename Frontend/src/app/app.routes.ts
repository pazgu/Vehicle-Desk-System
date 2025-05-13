import { Routes } from '@angular/router';
import { LoginComponent } from './components/page-area/login-area/user-area/login/login.component';
import { Page404Component } from './components/page-area/page404/page404.component';
import { HomeComponent } from './components/page-area/home/home.component';
import { NewRideComponent } from './ride-area/new-ride/new-ride.component';
import { RegisterComponent } from './components/page-area/login-area/user-area/register/register.component';
import { PastRideCardsComponent } from './ride-area/past-ride-cards/past-ride-cards.component';
import { DashboardAllOrdersComponent } from './components/supervisor-area/dashboard-all-orders/dashboard-all-orders.component';
import { OrderCardComponent } from './components/supervisor-area/order-card/order-card.component';
import { NotificationsComponent } from './components/page-area/notifications/notifications.component';

export const routes: Routes = [
    {path:"", redirectTo: "/home", pathMatch:"full"},
    {path: "login",component: LoginComponent},
    {path: "home",component: HomeComponent},
    {path: "new-ride", component: NewRideComponent},
    {path: "register",component:RegisterComponent},
    {path: "past-ride",component: PastRideCardsComponent},
    {path: "supervisor-dashboard",component: DashboardAllOrdersComponent},
    {path: "order-card/:id",component: OrderCardComponent},
    { path: 'notifications', component: NotificationsComponent},
    {path: "**",component: Page404Component}
];