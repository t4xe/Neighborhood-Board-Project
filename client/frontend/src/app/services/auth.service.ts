import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject, tap, timeout, catchError, throwError } from 'rxjs';
import { Router } from '@angular/router';

export interface User {
  user_id: number;
  email: string;
  display_name: string;
  roles: string;
  types: string;
  zone: string;
  status: string;
  created_at: string;
  roleList: string[];
  typeList: string[];
  isAdmin: boolean;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface RegisterRequest {
  email: string;
  password: string;
  displayName: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly API_URL = '/api';
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(
    private http: HttpClient,
    private router: Router
  ) {
    this.loadUserFromStorage();
  }

  private loadUserFromStorage(): void {
    const token = this.getToken();
    if (token) {
      this.getCurrentUser().subscribe({
        next: (user) => this.currentUserSubject.next(user),
        error: () => this.logout()
      });
    }
  }

  getToken(): string | null {
    const token = localStorage.getItem('token');
    return token ? token.trim() : null;
  }

  getAuthHeaders(): HttpHeaders {
    const token = this.getToken();
    if (!token) {
      return new HttpHeaders();
    }
    return new HttpHeaders({
      'Authorization': `Bearer ${token.replace(/['"]+/g, '').replace(/\s/g, '')}`
    });
  }

  register(data: RegisterRequest): Observable<any> {
    return this.http.post(`${this.API_URL}/authentication/register`, {
      email: data.email,
      password: data.password,
      displayName: data.displayName
    }).pipe(
      timeout(15000),
      catchError((err) => {
        const msg = err?.name === 'TimeoutError' || err?.message?.includes('timeout')
          ? 'Request timed out. Make sure the backend is running (port 3000) and the proxy is used (ng serve with proxyConfig).'
          : (err?.error?.message || err?.message || 'Registration failed.');
        return throwError(() => ({ error: { message: msg } }));
      })
    );
  }

  login(email: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.API_URL}/authentication/login`, {
      email,
      password
    }).pipe(
      tap((response) => {
        const cleanToken = response.token.toString().trim().replace(/['"]+/g, '').replace(/\s/g, '');
        localStorage.setItem('token', cleanToken);
        this.currentUserSubject.next(response.user);
      })
    );
  }

  logout(): void {
    const token = this.getToken();
    if (token) {
      this.http.post(`${this.API_URL}/authentication/logout`, {}, {
        headers: this.getAuthHeaders()
      }).subscribe({
        next: () => this.clearAuth(),
        error: () => this.clearAuth()
      });
    } else {
      this.clearAuth();
    }
  }

  private clearAuth(): void {
    localStorage.removeItem('token');
    this.currentUserSubject.next(null);
    this.router.navigate(['/login']);
  }

  getCurrentUser(): Observable<User> {
    return this.http.get<User>(`${this.API_URL}/users/me`, {
      headers: this.getAuthHeaders()
    }).pipe(
      tap((user) => this.currentUserSubject.next(user))
    );
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  isAdmin(): boolean {
    const user = this.currentUserSubject.value;
    return user?.isAdmin || false;
  }

  getCurrentUserValue(): User | null {
    return this.currentUserSubject.value;
  }
}
