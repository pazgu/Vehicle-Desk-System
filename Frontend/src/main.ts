import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { LayoutComponent } from './app/components/layout-area/layout/layout.component';

import { registerLocaleData } from '@angular/common';
import localeHe from '@angular/common/locales/he';
registerLocaleData(localeHe);

import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
} from 'chart.js';

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement
);

bootstrapApplication(LayoutComponent, appConfig).catch((err) =>
  console.error(err)
);
