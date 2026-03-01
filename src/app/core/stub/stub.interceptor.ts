import { Injectable } from '@angular/core';
import {
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
  HttpResponse
} from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { StubStoreService } from './stub-store.service';

@Injectable()
export class StubInterceptor implements HttpInterceptor {
  constructor(private readonly store: StubStoreService) {}

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    if (!req.url.startsWith('/api/')) {
      return next.handle(req);
    }

    if (req.method === 'GET' && req.url === '/api/me') {
      return of(new HttpResponse({ status: 200, body: this.store.getMe() }));
    }

    if (req.method === 'GET' && req.url === '/api/groups/current') {
      return of(new HttpResponse({ status: 200, body: this.store.getGroup() }));
    }

    if (req.method === 'GET' && req.url === '/api/bills') {
      return of(new HttpResponse({ status: 200, body: this.store.getBills() }));
    }

    if (req.method === 'POST' && req.url === '/api/bills') {
      try {
        return of(new HttpResponse({ status: 201, body: this.store.createBill(req.body as never) }));
      } catch (error) {
        return of(
          new HttpResponse({
            status: 400,
            body: { message: error instanceof Error ? error.message : 'Unable to create bill' }
          })
        );
      }
    }

    if (req.method === 'GET' && req.url === '/api/bills/current') {
      return of(new HttpResponse({ status: 200, body: this.store.getActiveBill() }));
    }

    if (req.method === 'POST' && req.url === '/api/bills/current') {
      const billId = (req.body as { billId?: string }).billId;
      if (!billId) {
        return of(new HttpResponse({ status: 400, body: { message: 'billId is required' } }));
      }

      const selected = this.store.setActiveBill(billId);
      if (!selected) {
        return of(new HttpResponse({ status: 404, body: { message: 'Bill not found' } }));
      }

      return of(new HttpResponse({ status: 200, body: selected }));
    }

    if (req.method === 'GET' && req.url === '/api/expenses') {
      return of(new HttpResponse({ status: 200, body: this.store.getExpenses() }));
    }

    if (req.method === 'POST' && req.url === '/api/expenses') {
      try {
        return of(new HttpResponse({ status: 201, body: this.store.addExpense(req.body as never) }));
      } catch (error) {
        return of(
          new HttpResponse({
            status: 400,
            body: { message: error instanceof Error ? error.message : 'Unable to add expense' }
          })
        );
      }
    }

    if (req.method === 'DELETE' && req.url.startsWith('/api/expenses/')) {
      const expenseId = req.url.replace('/api/expenses/', '');
      try {
        this.store.removeExpense(expenseId);
        return of(new HttpResponse({ status: 204, body: null }));
      } catch (error) {
        return of(
          new HttpResponse({
            status: 403,
            body: { message: error instanceof Error ? error.message : 'Unable to delete expense' }
          })
        );
      }
    }

    if (req.method === 'GET' && req.url === '/api/balances') {
      return of(new HttpResponse({ status: 200, body: this.store.getBalances() }));
    }

    if (req.method === 'POST' && req.url === '/api/reset') {
      this.store.reset();
      return of(new HttpResponse({ status: 200, body: { ok: true } }));
    }

    if (req.method === 'POST' && req.url === '/api/admin/reset-data') {
      this.store.reset();
      return of(new HttpResponse({ status: 200, body: null }));
    }

    return of(new HttpResponse({ status: 404, body: { message: 'Not found in stub API' } }));
  }
}
