import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

export interface ConfirmState extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private subject = new Subject<ConfirmState | null>();

  readonly state$ = this.subject.asObservable();

  show(options: ConfirmOptions): Promise<boolean> {
    return new Promise((resolve) => {
      this.subject.next({
        ...options,
        confirmText: options.confirmText ?? 'Confirm',
        cancelText: options.cancelText ?? 'Cancel',
        resolve,
      });
    });
  }

  close(): void {
    this.subject.next(null);
  }

  confirm(value: boolean, resolve: (v: boolean) => void): void {
    this.subject.next(null);
    resolve(value);
  }
}
