import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./components/map/map.component').then(m => m.MapComponent)
  },
  {
    path: 'create-flight-plan',
    loadComponent: () => import('./components/create-flight-plan/create-flight-plan.component').then(m => m.CreateFlightPlanComponent)
  },
  {
    path: '**',
    redirectTo: ''
  }
];


