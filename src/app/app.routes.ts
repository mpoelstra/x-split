import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/login/login.component').then((m) => m.LoginComponent)
  },
  {
    path: 'app',
    canActivate: [authGuard],
    loadComponent: () => import('./features/shell/app-shell.component').then((m) => m.AppShellComponent),
    children: [
      {
        path: 'bills',
        loadComponent: () =>
          import('./features/bills/bills.component').then((m) => m.BillsComponent)
      },
      {
        path: 'friends',
        loadComponent: () =>
          import('./features/friends/friends.component').then((m) => m.FriendsComponent)
      },
      {
        path: 'import',
        loadComponent: () =>
          import('./features/import/import.component').then((m) => m.ImportComponent)
      },
      {
        path: 'account',
        loadComponent: () =>
          import('./features/account/account.component').then((m) => m.AccountComponent)
      },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent)
      },
      {
        path: 'expenses',
        loadComponent: () =>
          import('./features/expenses/expenses-list.component').then((m) => m.ExpensesListComponent)
      },
      {
        path: 'expenses/new',
        loadComponent: () =>
          import('./features/expenses/expense-form.component').then((m) => m.ExpenseFormComponent)
      },
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'dashboard'
      }
    ]
  },
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'app/dashboard'
  },
  {
    path: '**',
    redirectTo: 'app/dashboard'
  }
];
