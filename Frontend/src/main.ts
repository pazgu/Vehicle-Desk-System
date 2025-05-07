import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { DashboardAllOrdersComponent } from './app/components/supervisor-area/dashboard-all-orders/dashboard-all-orders.component';

bootstrapApplication(DashboardAllOrdersComponent, appConfig)
  .catch((err) => console.error(err));
