import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { ConfirmService, ConfirmState } from '../../services/confirm.service';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="state" class="confirm-overlay" (click)="cancel()">
      <div class="confirm-dialog" (click)="$event.stopPropagation()">
        <h3>{{ state.title }}</h3>
        <p>{{ state.message }}</p>
        <div class="confirm-actions">
          <button type="button" class="btn secondary-btn" (click)="cancel()">{{ state.cancelText }}</button>
          <button type="button" class="btn" [class.primary-btn]="!state.danger" [class.danger-btn]="state.danger" (click)="confirm()">{{ state.confirmText }}</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .confirm-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2000;
    }
    .confirm-dialog {
      background: white;
      padding: 24px;
      border-radius: 12px;
      max-width: 400px;
      width: 90%;
      box-shadow: 0 10px 40px rgba(0,0,0,0.3);
    }
    .confirm-dialog h3 { margin: 0 0 12px 0; }
    .confirm-dialog p { margin: 0 0 20px 0; color: #555; }
    .confirm-actions { display: flex; gap: 12px; justify-content: flex-end; }
    .btn { padding: 10px 20px; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; }
    .secondary-btn { background: #e5e7eb; color: #333; }
    .primary-btn { background: #667eea; color: white; }
    .danger-btn { background: #ef4444; color: white; }
  `]
})
export class ConfirmDialogComponent implements OnDestroy {
  state: ConfirmState | null = null;
  private sub: Subscription;

  constructor(private confirmService: ConfirmService) {
    this.sub = this.confirmService.state$.subscribe((s) => (this.state = s));
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  confirm(): void {
    if (this.state) {
      this.confirmService.confirm(true, this.state.resolve);
    }
  }

  cancel(): void {
    if (this.state) {
      this.confirmService.confirm(false, this.state.resolve);
    }
  }
}
