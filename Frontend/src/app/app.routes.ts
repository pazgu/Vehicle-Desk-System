import { Routes } from '@angular/router';
import { LoginComponent } from './components/page-area/login-area/user-area/login/login.component';
import { Page404Component } from './components/page-area/page404/page404.component';
import { LayoutComponent } from './components/layout-area/layout/layout.component';
import { HomeComponent } from './components/page-area/home/home.component';

export const routes: Routes = [
    {path:"", redirectTo: "/home", pathMatch:"full"},
    {path: "login",component: LoginComponent},
    {path: "home",component: HomeComponent},
    {path: "**",component: Page404Component}
];
