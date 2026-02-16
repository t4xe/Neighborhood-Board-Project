import { Injectable, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { io, Socket } from 'socket.io-client';

@Injectable({ providedIn: 'root' })
export class LiveService implements OnDestroy {
  private socket: Socket | null = null;
  private readonly postsChanged = new Subject<void>();
  private readonly reportsChanged = new Subject<void>();
  private readonly categoriesChanged = new Subject<void>();
  private readonly usersChanged = new Subject<void>();

  readonly onPostsChanged = this.postsChanged.asObservable();
  readonly onReportsChanged = this.reportsChanged.asObservable();
  readonly onCategoriesChanged = this.categoriesChanged.asObservable();
  readonly onUsersChanged = this.usersChanged.asObservable();

  connect(): void {
    if (this.socket?.connected) return;
    const url = typeof window !== 'undefined' ? window.location.origin : '';
    this.socket = io(url, { path: '/socket.io', transports: ['websocket', 'polling'] });
    this.socket.on('posts:changed', () => this.postsChanged.next());
    this.socket.on('reports:changed', () => this.reportsChanged.next());
    this.socket.on('categories:changed', () => this.categoriesChanged.next());
    this.socket.on('users:changed', () => this.usersChanged.next());
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  ngOnDestroy(): void {
    this.disconnect();
  }
}
