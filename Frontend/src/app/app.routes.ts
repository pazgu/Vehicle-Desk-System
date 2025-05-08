import { Routes } from '@angular/router';
import { LoginComponent } from './components/page-area/login-area/user-area/login/login.component';
import { Page404Component } from './components/page-area/page404/page404.component';
import { LayoutComponent } from './components/layout-area/layout/layout.component';
import { HomeComponent } from './components/page-area/home/home.component';
import { NewRideComponent } from './ride-area/new-ride/new-ride.component';
import { RegisterComponent } from './components/page-area/login-area/user-area/register/register.component';
import { FututreRideCardsComponent } from './ride-area/future-ride-cards/future-ride-cards.component';
import { PastRideCardsComponent } from './ride-area/past-ride-cards/past-ride-cards.component';

export const routes: Routes = [
    {path:"", redirectTo: "/home", pathMatch:"full"},
    {path: "login",component: LoginComponent},
    {path: "home",component: HomeComponent},
    {path: "new-ride", component: NewRideComponent },
    {path: "register",component:RegisterComponent},
    {path: "future-ride",component: FututreRideCardsComponent},
    {path: "past-ride",component: PastRideCardsComponent},
    {path: "**",component: Page404Component}
];